#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Running Better Auth migrations..."
npx @better-auth/cli migrate --config src/auth/auth.service.ts

echo "Starting application..."
exec node dist/main.js
