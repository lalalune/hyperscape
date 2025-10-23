#!/bin/bash

# Comprehensive Hyperscape Economy Test Runner
# This script starts the server and runs all Synpress tests

set -e  # Exit on error

echo "======================================"
echo "Hyperscape Economy - Full Test Suite"
echo "======================================"
echo ""

# Check if server is already running
if lsof -Pi :5555 -sTCP:LISTEN -t >/dev/null ; then
    echo "✓ Server already running on port 5555"
else
    echo "Starting Hyperscape server..."
    cd /Users/shawwalters/jeju/vendor/hyperscape
    
    # Start server in background
    npm run dev:server > server.log 2>&1 &
    SERVER_PID=$!
    echo "Server PID: $SERVER_PID"
    
    # Wait for server to start
    echo "Waiting for server to be ready..."
    sleep 15
    
    # Check if server started successfully
    if ! lsof -Pi :5555 -sTCP:LISTEN -t >/dev/null ; then
        echo "❌ Server failed to start. Check server.log"
        cat server.log
        exit 1
    fi
    
    echo "✓ Server started successfully"
fi

echo ""
echo "Running Synpress test suite..."
echo "======================================"

# Run Synpress tests
cd /Users/shawwalters/jeju/vendor/hyperscape
npx playwright test tests/wallet/02-economy-minting.spec.ts --config=synpress.config.ts --reporter=list

TEST_EXIT_CODE=$?

echo ""
echo "======================================"
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ ALL TESTS PASSED"
else
    echo "❌ SOME TESTS FAILED (exit code: $TEST_EXIT_CODE)"
fi
echo "======================================"

exit $TEST_EXIT_CODE

