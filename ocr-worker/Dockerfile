FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.mjs ./

ENV PORT=8787
ENV NODE_ENV=production
EXPOSE 8787

CMD ["node", "server.mjs"]
