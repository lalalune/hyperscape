#!/usr/bin/env bash
# Test Environment Setup Script
# Sets up the test environment for bug-finding tests

set -e

echo "🌲 Setting up Hyperscape Plugin Test Environment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.test exists
if [ ! -f .env.test ]; then
    echo ""
    echo "${YELLOW}⚠️  .env.test not found${NC}"
    echo ""
    echo "Creating .env.test from template..."
    cp .env.test.example .env.test
    echo ""
    echo "${GREEN}✅ Created .env.test${NC}"
    echo ""
    echo "${YELLOW}⚠️  ACTION REQUIRED:${NC}"
    echo "   Please edit .env.test and configure:"
    echo "   1. HYPERSCAPE_TEST_WORLD - Your test world URL"
    echo "   2. OPENAI_API_KEY - Your OpenAI API key"
    echo "   3. HYPERSCAPE_AUTH_TOKEN - (if your world requires auth)"
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Load .env.test
echo ""
echo "Loading .env.test configuration..."
source .env.test

# Validate required variables
MISSING_VARS=()

if [ -z "$HYPERSCAPE_TEST_WORLD" ]; then
    MISSING_VARS+=("HYPERSCAPE_TEST_WORLD")
fi

if [ -z "$OPENAI_API_KEY" ]; then
    MISSING_VARS+=("OPENAI_API_KEY")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo ""
    echo "${RED}❌ Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please edit .env.test and set these variables."
    exit 1
fi

echo "${GREEN}✅ All required variables configured${NC}"

# Create test data directory
echo ""
echo "Creating test data directory..."
mkdir -p ./test-data
echo "${GREEN}✅ Test data directory ready${NC}"

# Initialize SQLite database if using sqlite
if [ "$DATABASE_ADAPTER" = "sqlite" ]; then
    echo ""
    echo "Initializing SQLite database..."

    SQLITE_PATH="${SQLITE_FILE:-./test-data/timber.db}"

    if [ -f "$SQLITE_PATH" ]; then
        echo "${YELLOW}⚠️  Database already exists at $SQLITE_PATH${NC}"
        read -p "Do you want to reset it? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm "$SQLITE_PATH"
            echo "${GREEN}✅ Database reset${NC}"
        fi
    fi

    # Create database (ElizaOS will auto-initialize schema)
    touch "$SQLITE_PATH"
    echo "${GREEN}✅ SQLite database ready at $SQLITE_PATH${NC}"
fi

# Test Hyperscape world connection
echo ""
echo "Testing Hyperscape world connection..."

if [[ $HYPERSCAPE_TEST_WORLD == http* ]]; then
    # Extract host from URL
    HOST=$(echo "$HYPERSCAPE_TEST_WORLD" | sed -E 's|^https?://([^/]+).*|\1|')

    # Try to ping the host
    if command -v curl &> /dev/null; then
        if curl -s --head --max-time 5 "$HYPERSCAPE_TEST_WORLD" > /dev/null 2>&1; then
            echo "${GREEN}✅ Hyperscape world is reachable${NC}"
        else
            echo "${YELLOW}⚠️  Could not reach Hyperscape world at $HYPERSCAPE_TEST_WORLD${NC}"
            echo "   The world might be down or require authentication."
            echo "   Tests will fail if the world is not accessible."
        fi
    else
        echo "${YELLOW}⚠️  curl not found, skipping connectivity check${NC}"
    fi
else
    echo "${YELLOW}⚠️  Invalid HYPERSCAPE_TEST_WORLD URL format${NC}"
fi

# Verify OpenAI API key
echo ""
echo "Verifying OpenAI API key..."

if command -v curl &> /dev/null; then
    if curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
        -H "Authorization: Bearer $OPENAI_API_KEY" \
        https://api.openai.com/v1/models | grep -q "200"; then
        echo "${GREEN}✅ OpenAI API key is valid${NC}"
    else
        echo "${RED}❌ OpenAI API key validation failed${NC}"
        echo "   Please check your OPENAI_API_KEY in .env.test"
        exit 1
    fi
else
    echo "${YELLOW}⚠️  curl not found, skipping API key validation${NC}"
fi

# Export environment for tests
echo ""
echo "Exporting test environment variables..."
export $(cat .env.test | grep -v '^#' | xargs)
echo "${GREEN}✅ Environment variables exported${NC}"

# Summary
echo ""
echo "=================================================="
echo "${GREEN}✅ Test Environment Setup Complete!${NC}"
echo "=================================================="
echo ""
echo "Configuration:"
echo "  • Test World: $HYPERSCAPE_TEST_WORLD"
echo "  • Database: $DATABASE_ADAPTER"
echo "  • Character: characters/woodcutter-test.json"
echo ""
echo "Next steps:"
echo "  1. Ensure Hyperscape world is running and accessible"
echo "  2. Run tests: ${GREEN}bun test rpg-action-bugs${NC}"
echo "  3. Check TESTING.md for detailed test documentation"
echo ""
