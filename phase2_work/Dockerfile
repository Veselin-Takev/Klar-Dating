# syntax=docker/dockerfile:1.7
# Build with the repository's pinned Bun toolchain; never copy host node_modules.
FROM oven/bun:1.4.5@sha256:3aa040e5445efa09d75bb428a64ba50db13e2b3ac9b6b0c7f145615f62b2ee18 AS build

WORKDIR /app
ENV CI=true

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Keep development/test dependencies out of the runtime image.
RUN rm -rf node_modules \
  && bun install --frozen-lockfile --production

FROM node:22.23.3-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c AS runtime

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

