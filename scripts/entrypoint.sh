#!/bin/sh
set -e

echo "[entrypoint] Aplicando migrations do Prisma..."
prisma migrate deploy

echo "[entrypoint] Iniciando servidor Next.js..."
exec node server.js
