# syntax=docker/dockerfile:1
# Analizador de partidas: Next.js + SQLite (node:sqlite). Needs a persistent volume for /data.
FROM node:26-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm i -g pnpm@10.34.9
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production DB_PATH=/data/fatuescacs.db PORT=3000
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["pnpm", "start"]
