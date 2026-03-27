# ---- Stage 1: Builder ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source and config
COPY . .

# Compile TypeScript (includes prisma generate via build script)
RUN npm run build


# ---- Stage 2: Runner ----
FROM node:20-alpine AS runner

WORKDIR /app

# Copy production deps manifest
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy compiled output (includes generated Prisma client in dist/generated)
COPY --from=builder /app/dist ./dist

# Copy source files needed for better-auth migrations
COPY --from=builder /app/src/auth ./src/auth

# Copy prisma config and schema
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/prisma ./prisma

# Copy entrypoint
COPY entrypoint.sh ./entrypoint.sh

# Run as non-root user
USER node

EXPOSE 3000

CMD ["sh", "entrypoint.sh"]
