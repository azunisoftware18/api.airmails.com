#!/bin/bash
set -e

# Detect compose command
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "❌ Neither 'docker compose' nor 'docker-compose' found."
  exit 1
fi

echo "🧩 Using: $DC"

echo "🚀 Pulling latest code..."
git fetch origin main
git reset --hard origin/main

echo "🛑 Stopping old containers..."
$DC down || true

echo "🧪 Validating compose file..."
$DC config -q

echo "🔨 Rebuilding and starting containers..."
$DC build --no-cache
$DC up -d

echo "✅ Deployment finished!"
