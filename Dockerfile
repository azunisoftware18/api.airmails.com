# Build image
FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++ openssl

COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --progress=false

COPY . .

# 🔥 Generate Prisma client at build time
RUN npx prisma generate

EXPOSE 3000

# Runtime: run migrations then start app
CMD npx prisma migrate deploy && node src/index.js
