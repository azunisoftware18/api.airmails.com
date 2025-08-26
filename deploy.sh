#!/bin/bash
set -e

echo "🚀 Pulling latest code..."
git fetch origin main
git reset --hard origin/main

echo "🛑 Stopping old containers..."
docker-compose down

echo "🔨 Rebuilding and starting containers..."
docker-compose build --no-cache
docker-compose up -d

echo "✅ Deployment finished!"
