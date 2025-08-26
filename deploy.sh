#!/bin/bash
set -e

# Detect docker compose command (new or old)
if command -v docker compose >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "❌ docker-compose not installed!"
  exit 1
fi

echo "🚀 Pulling latest code..."
git fetch origin main
git reset --hard origin/main

echo "🛑 Stopping old containers..."
$DC down || true

echo "🔨 Rebuilding and starting containers..."
$DC build --no-cache
$DC up -d

echo "✅ Deployment finished!"
