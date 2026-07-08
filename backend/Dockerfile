FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies required by bcrypt/prisma
RUN apk add --no-cache python3 make g++ openssl

COPY package*.json ./
RUN npm install

COPY prisma/ ./prisma/
RUN npx prisma generate

COPY . .

RUN npm run build

# ── Production image ──
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

# Copy built artifacts and node_modules (only production)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --from=builder /app/tsconfig*.json ./

RUN chmod +x docker-entrypoint.sh

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["./docker-entrypoint.sh"]