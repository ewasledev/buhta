FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

RUN npx prisma generate
COPY . .
RUN npm run build && test -f dist/main.js || (echo "ERROR: dist/main.js not found after build" && exit 1)

RUN npm prune --production && npm cache clean --force

ENV NODE_ENV=production
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
