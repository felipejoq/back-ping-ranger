#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Running Better Auth migrations..."
./node_modules/.bin/better-auth migrate --config src/auth/auth.service.ts --yes

echo "Starting application..."
exec node dist/main
