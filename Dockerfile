# Стадия 1: сборка Mini App (webapp)
FROM node:20-alpine AS webapp
WORKDIR /webapp
COPY webapp/package*.json ./
RUN npm ci
COPY webapp/ .
ENV NODE_OPTIONS=--max-old-space-size=512
RUN npm run build

# Стадия 2: backend
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

RUN npx prisma generate
COPY . .
RUN npm run build && test -f dist/main.js || (echo "ERROR: dist/main.js not found after build" && exit 1)

COPY --from=webapp /webapp/dist ./webapp/dist

RUN npm prune --production && npm cache clean --force

ENV NODE_ENV=production
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
