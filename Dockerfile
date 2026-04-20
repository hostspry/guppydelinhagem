# ===== Estágio 1: Dependências =====
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# ===== Estágio 2: Build =====
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Gera o Prisma Client no local configurado no schema (./lib/generated/prisma)
RUN corepack enable pnpm && pnpm prisma generate

# Build do Next.js (produz .next/standalone graças ao output: 'standalone')
RUN pnpm build

# ===== Estágio 3: Runner (imagem final, mínima) =====
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Usuário não-root por segurança
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 1. Output standalone do Next.js (inclui node_modules mínimo para o Next)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# 2. Assets estáticos e public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 3. Prisma: schema + config
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

# 4. Prisma Client gerado (custom output configurado no schema)
COPY --from=builder --chown=nextjs:nodejs /app/lib/generated/prisma ./lib/generated/prisma

# 5. Prisma CLI + engines + dependências transitivas
# (Prisma 7 + pnpm: COPY dereferencia symlinks, traz conteúdo real do .pnpm store)
# Lista baseada na discussão oficial prisma/prisma#28759
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/effect ./node_modules/effect
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/fast-check ./node_modules/fast-check
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pure-rand ./node_modules/pure-rand

# 6. Entrypoint
COPY --from=builder --chown=nextjs:nodejs /app/scripts/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs
EXPOSE 3000

CMD ["./entrypoint.sh"]
