FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

RUN npx prisma generate
COPY . .
RUN npm run build

RUN npm prune --production && npm cache clean --force

ENV NODE_ENV=production
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
