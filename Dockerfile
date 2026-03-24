# ---- Stage 1: Builder ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source and config
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript
RUN npm run build


# ---- Stage 2: Runner ----
FROM node:20-alpine AS runner

WORKDIR /app

# Copy production deps manifest
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy compiled output and generated Prisma client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/prisma ./prisma
COPY entrypoint.sh ./entrypoint.sh

# Run as non-root user
USER node

EXPOSE 3000

CMD ["sh", "entrypoint.sh"]
