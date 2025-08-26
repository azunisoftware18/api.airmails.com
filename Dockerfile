FROM node:18-alpine

WORKDIR /app

# Build tools for native addons
RUN apk add --no-cache python3 make g++

# npm v10+: node-gyp ko python batane ke liye env
ENV PYTHON=/usr/bin/python3

# Install deps first (better caching)
COPY package*.json ./
RUN if [ -f package-lock.json ]; then \
      npm ci --legacy-peer-deps --no-audit --progress=false; \
    else \
      npm install --legacy-peer-deps --no-audit --progress=false; \
    fi

# App source
COPY . .

EXPOSE 3000
CMD ["node", "src/index.js"]
