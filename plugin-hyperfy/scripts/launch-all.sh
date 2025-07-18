#!/bin/bash

echo "🚀 Launching Among Us Full Stack"
echo "================================"
echo

# Start Vite in background
echo "1. Starting Vite server..."
npm run minigames &
VITE_PID=$!

# Wait for Vite to start
sleep 5

# Start WebSocket server in background
echo "2. Starting WebSocket server..."
node scripts/simple-ws-server.js &
WS_PID=$!

# Wait a bit
sleep 2

# Find the port Vite is using
PORT=$(lsof -ti:3000 >/dev/null 2>&1 && echo "3000" || lsof -ti:3001 >/dev/null 2>&1 && echo "3001" || lsof -ti:3002 >/dev/null 2>&1 && echo "3002" || echo "3002")

echo
echo "✅ Everything is running!"
echo
echo "📍 URLs:"
echo "- Observer: http://localhost:$PORT/observer.html"
echo "- Game: http://localhost:$PORT/amongus.html"
echo "- WebSocket: ws://localhost:3001"
echo
echo "Press Ctrl+C to stop all services"
echo

# Function to cleanup on exit
cleanup() {
    echo
    echo "Shutting down..."
    kill $VITE_PID 2>/dev/null
    kill $WS_PID 2>/dev/null
    exit 0
}

# Set trap for cleanup
trap cleanup INT TERM

# Keep script running
wait 