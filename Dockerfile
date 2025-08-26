FROM node:18-alpine

WORKDIR /app

# Build tools for native modules (node-gyp)
RUN apk add --no-cache python3 make g++ \
    && npm config set python /usr/bin/python3 \
    && npm config set registry https://registry.npmjs.org

# Install deps first for better caching
COPY package*.json ./

# Prefer ci when lockfile exists, else fallback to install
# Speed + fewer prompts:
RUN if [ -f package-lock.json ]; then \
    npm ci --legacy-peer-deps --no-audit --progress=false; \
    else \
    npm install --legacy-peer-deps --no-audit --progress=false; \
    fi

# App source
COPY . .

EXPOSE 3000
CMD ["node", "src/index.js"]
