#!/bin/sh
set -e
 
echo "Waiting for database to be ready..."
 
# Extract host:port from DATABASE_URL (format: postgresql://user:pass@host:port/db)
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+):.*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
 
MAX_RETRIES=30
RETRY_COUNT=0
 
until node -e "
  const net = require('net');
  const socket = net.createConnection($DB_PORT, '$DB_HOST');
  socket.on('connect', () => { socket.end(); process.exit(0); });
  socket.on('error', () => process.exit(1));
" 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
    echo "Database did not become ready after $MAX_RETRIES attempts. Exiting."
    exit 1
  fi
  echo "Database not ready yet (attempt $RETRY_COUNT/$MAX_RETRIES), retrying in 2s..."
  sleep 2
done
 
echo "Database is reachable. Applying Prisma migrations..."
npx prisma migrate deploy
 
echo "Migrations applied. Starting server..."
exec node index.js
 