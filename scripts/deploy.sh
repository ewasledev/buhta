#!/bin/bash
set -euo pipefail

echo "==> Pulling latest changes..."
git pull origin main

echo "==> Building and restarting container..."
docker compose up --build -d

echo "==> Removing dangling images..."
docker image prune -f

echo "==> Done. Container status:"
docker compose ps
