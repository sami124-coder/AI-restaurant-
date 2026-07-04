FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/data/restaurant.db

RUN mkdir -p /data

EXPOSE 3000
CMD ["npm", "start"]

