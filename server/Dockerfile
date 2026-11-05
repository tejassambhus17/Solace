FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && mkdir -p /data && chown node:node /data
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production PORT=3001 DATABASE_PATH=/data/solace.sqlite
EXPOSE 3001
VOLUME ["/data"]
USER node
CMD ["node", "dist/index.js"]
