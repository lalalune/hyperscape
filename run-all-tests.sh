#!/bin/bash

# Comprehensive Hyperscape Test Runner
# Runs all test suites including plugin tests and e2e tests

set -e  # Exit on error

# Determine script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

echo "======================================"
echo "Hyperscape - Full Test Suite"
echo "======================================"
echo "Project root: $PROJECT_ROOT"
echo ""

# Track overall test status
OVERALL_EXIT_CODE=0

# ============================================
# 0. Pre-flight Checks
# ============================================
echo "======================================"
echo "0. Pre-flight Checks"
echo "======================================"

# Check Docker permissions
check_docker() {
    if command -v docker &> /dev/null; then
        if docker info &> /dev/null 2>&1; then
            echo "✓ Docker is available and accessible"
            return 0
        else
            echo "⚠ Docker installed but not accessible"
            echo "  Run: sudo chmod 666 /var/run/docker.sock"
            echo "  Or add user to docker group: sudo usermod -aG docker \$USER"
            return 1
        fi
    else
        echo "⚠ Docker not installed"
        return 1
    fi
}

DOCKER_OK=false
if check_docker; then
    DOCKER_OK=true
fi
echo ""

# ============================================
# 1. Plugin Tests (Unit + MCP/Eliza E2E)
# ============================================
echo ""
echo "======================================"
echo "1. Plugin Hyperscape Tests"
echo "======================================"
cd "$PROJECT_ROOT/packages/plugin-hyperscape"

echo "Running unit tests..."
if bun run test; then
    echo "✓ Unit tests passed"
else
    echo "✗ Unit tests failed"
    OVERALL_EXIT_CODE=1
fi

echo ""
echo "Running MCP/Eliza E2E tests..."
if bun run test:e2e; then
    echo "✓ MCP/Eliza tests passed"
else
    echo "✗ MCP/Eliza tests failed"
    OVERALL_EXIT_CODE=1
fi

# ============================================
# 2. Server + Production Tests (if server available)
# ============================================
echo ""
echo "======================================"
echo "2. Production Integration Tests"
echo "======================================"

cd "$PROJECT_ROOT"

# Check if server is already running
SERVER_STARTED_BY_US=false
if lsof -Pi :5555 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✓ Server already running on port 5555"
else
    echo "Attempting to start Hyperscape server..."
    
    # Check if Docker is available (use pre-flight check result)
    if [ "$DOCKER_OK" = true ]; then
        echo "Docker available, starting server..."
        cd "$PROJECT_ROOT/packages/server"
        
        # Start server in background
        bun run dev > "$PROJECT_ROOT/server.log" 2>&1 &
        SERVER_PID=$!
        SERVER_STARTED_BY_US=true
        echo "Server PID: $SERVER_PID"
        
        # Wait for server to start (up to 60 seconds for DB init)
        echo "Waiting for server to be ready (this may take a minute for DB setup)..."
        for i in {1..60}; do
            if lsof -Pi :5555 -sTCP:LISTEN -t >/dev/null 2>&1; then
                echo ""
                echo "✓ Server started successfully"
                break
            fi
            sleep 1
            echo -n "."
        done
        echo ""
        
        if ! lsof -Pi :5555 -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "⚠ Server failed to start. Check server.log for details:"
            tail -20 "$PROJECT_ROOT/server.log" 2>/dev/null || echo "  (no log available)"
            SERVER_STARTED_BY_US=false
        fi
    else
        echo "⚠ Docker not accessible. Skipping server auto-start."
        echo "  To fix Docker permissions:"
        echo "    sudo chmod 666 /var/run/docker.sock"
        echo "  Or add user to docker group:"
        echo "    sudo usermod -aG docker \$USER && newgrp docker"
    fi
fi

cd "$PROJECT_ROOT"

# Run production tests if server is running
if lsof -Pi :5555 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo ""
    echo "Running production tests..."
    cd "$PROJECT_ROOT/packages/plugin-hyperscape"
    if bun run test:production; then
        echo "✓ Production tests passed"
    else
        echo "✗ Production tests failed"
        OVERALL_EXIT_CODE=1
    fi
else
    echo "⚠ Skipping production tests (server not running)"
fi

# Cleanup: Stop server if we started it
if [ "$SERVER_STARTED_BY_US" = true ]; then
    echo ""
    echo "Stopping server we started..."
    kill $SERVER_PID 2>/dev/null || true
fi

# ============================================
# 3. Synpress Wallet Tests (if available)
# ============================================
echo ""
echo "======================================"
echo "3. Synpress Wallet Tests"
echo "======================================"

cd "$PROJECT_ROOT"
if [ -f "synpress.config.ts" ] && [ -d "tests/wallet" ]; then
    if lsof -Pi :5555 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "Running Synpress tests..."
        if bunx playwright test tests/wallet/ --config=synpress.config.ts --reporter=list; then
            echo "✓ Synpress tests passed"
        else
            echo "✗ Synpress tests failed"
            OVERALL_EXIT_CODE=1
        fi
    else
        echo "⚠ Skipping Synpress tests (server not running)"
    fi
else
    echo "⚠ Skipping Synpress tests (not configured)"
fi

# ============================================
# Summary
# ============================================
echo ""
echo "======================================"
echo "TEST SUMMARY"
echo "======================================"
if [ $OVERALL_EXIT_CODE -eq 0 ]; then
    echo "✓ ALL TESTS PASSED"
else
    echo "✗ SOME TESTS FAILED"
fi
echo "======================================"

exit $OVERALL_EXIT_CODE

