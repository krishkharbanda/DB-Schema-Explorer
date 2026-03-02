#!/bin/bash
# Start both backend and frontend servers
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting backend server on http://localhost:8000 ..."
cd "$DIR/backend"
./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

echo "Starting frontend dev server on http://localhost:3000 ..."
cd "$DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend PID:  $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "Open http://localhost:3000 in your browser."
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
