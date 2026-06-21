#!/usr/bin/env bash
set -e

# ============================================================
#  StreamEngine Local Dev Server
#  Starts both server (port 3001) and client (port 3000)
#  without Docker.
# ============================================================

cleanup() {
  echo -e "\n🛑 Shutting down..."
  kill $SERVER_PID $CLIENT_PID 2>/dev/null
  wait $SERVER_PID $CLIENT_PID 2>/dev/null
  exit 0
}

trap cleanup SIGINT SIGTERM

# --- Ensure dependencies are installed ---
ensure_deps() {
  local dir=$1
  local name=$2
  if [ ! -d "$dir/node_modules" ]; then
    echo "📦 Installing $name dependencies..."
    (cd "$dir" && npm install)
  fi
}

ensure_deps server "server"
ensure_deps client "client"

# --- Ensure required env vars for local dev ---
export AGENT_KEY_SECRET="${AGENT_KEY_SECRET:-dev-local-secret-do-not-use-in-production}"

# --- Start server ---
echo "🚀 Starting server (port 3001)..."
(cd server && npm run dev) &
SERVER_PID=$!

# --- Start client ---
echo "🌐 Starting client (port 3000)..."
(cd client && npm run dev) &
CLIENT_PID=$!

echo ""
echo "✅ Both dev servers running (no Docker):"
echo "   Server: http://localhost:3001"
echo "   Client: http://localhost:3000"
echo ""
echo "   Press Ctrl+C to stop both."
echo ""

# Wait for either process to exit
wait
