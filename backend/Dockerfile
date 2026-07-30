FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++ openssl
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NPM_CONFIG_CACHE=/tmp/.npm
RUN apk add --no-cache openssl wget
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig*.json ./
COPY --from=build --chown=appuser:appgroup /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN mkdir -p uploads && chmod +x docker-entrypoint.sh && chown appuser:appgroup uploads docker-entrypoint.sh
USER appuser
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=10s --start-period=300s --retries=10 CMD wget -q --spider "http://localhost:${PORT:-5000}/health" || exit 1
CMD ["./docker-entrypoint.sh"]
