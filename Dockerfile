FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --production
COPY --from=build /app/dist ./dist
COPY src/public ./src/public

EXPOSE 3000
CMD ["node", "dist/server.js"]
