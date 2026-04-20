#!/bin/sh
set -e

echo "[entrypoint] Aplicando migrations do Prisma..."
node ./node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] Iniciando servidor Next.js..."
exec node server.js
