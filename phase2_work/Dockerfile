# syntax=docker/dockerfile:1.7
# Build with the repository's pinned Bun toolchain; never copy host node_modules.
FROM oven/bun:1.4.2@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895 AS build

WORKDIR /app
ENV CI=true

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Keep development/test dependencies out of the runtime image.
RUN rm -rf node_modules \
  && bun install --frozen-lockfile --production

FROM node:26.10.0-bookworm-slim@sha256:3ffc19ea878019d9e9ae8971732ad4a03cda44f167107173174b60ed7c65bed3 AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/firebase-applet-config.json ./firebase-applet-config.json

USER node
EXPOSE 8080

CMD ["node", "dist/server.cjs"]
