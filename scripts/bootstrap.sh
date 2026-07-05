#!/usr/bin/env bash
set -euo pipefail

echo "Installing dependencies..."
if [ ! -d node_modules ]; then
  npm install
else
  echo "Dependencies already installed"
fi

if [ ! -f .env.local ] && [ -f .env.example ]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example"
fi

echo "Bootstrap complete. Run: npm run dev"
