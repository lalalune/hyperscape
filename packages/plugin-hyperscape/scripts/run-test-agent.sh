#!/usr/bin/env bash
# Run Test Agent Script
# Launches the Timber test agent for interactive or automated testing

set -e

echo "🌲 Launching Timber Test Agent"
echo "================================"

# Load test environment
if [ -f .env.test ]; then
    echo "Loading .env.test..."
    export $(cat .env.test | grep -v '^#' | xargs)
else
    echo "❌ .env.test not found. Run ./scripts/setup-test-env.sh first."
    exit 1
fi

# Check required variables
if [ -z "$HYPERSCAPE_TEST_WORLD" ]; then
    echo "❌ HYPERSCAPE_TEST_WORLD not set in .env.test"
    exit 1
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY not set in .env.test"
    exit 1
fi

# Set character file
export CHARACTER_PATH="./characters/woodcutter-test.json"

echo "✅ Configuration loaded"
echo ""
echo "Agent: Timber (Woodcutter Test Agent)"
echo "World: $HYPERSCAPE_TEST_WORLD"
echo "Model: ${MODEL:-gpt-4o-mini}"
echo ""

# Check if we're in interactive or test mode
MODE="${1:-interactive}"

if [ "$MODE" = "test" ]; then
    echo "🧪 Running automated tests..."
    echo ""

    # Run bug-finding tests
    bun test rpg-action-bugs

elif [ "$MODE" = "interactive" ]; then
    echo "💬 Starting interactive mode..."
    echo ""
    echo "You can now interact with Timber."
    echo "Example commands:"
    echo "  • 'chop trees'"
    echo "  • 'check inventory'"
    echo "  • 'what's your skill level?'"
    echo "  • 'test the CHOP_TREE action'"
    echo ""
    echo "Press Ctrl+C to exit"
    echo ""

    # Run ElizaOS with the character
    # Note: This assumes elizaos CLI is available
    if command -v elizaos &> /dev/null; then
        elizaos --character "$CHARACTER_PATH"
    else
        echo "❌ elizaos CLI not found. Install it with: npm install -g @elizaos/cli"
        echo ""
        echo "Alternative: Use the ElizaOS runtime directly:"
        echo "  cd /root/hyperscape"
        echo "  bun run packages/cli/src/index.ts --character packages/plugin-hyperscape/characters/woodcutter-test.json"
        exit 1
    fi

elif [ "$MODE" = "validate" ]; then
    echo "✅ Running validation checks..."
    echo ""

    # Validate character file
    if [ ! -f "$CHARACTER_PATH" ]; then
        echo "❌ Character file not found: $CHARACTER_PATH"
        exit 1
    fi

    echo "✅ Character file exists"

    # Validate JSON syntax
    if command -v jq &> /dev/null; then
        if jq empty "$CHARACTER_PATH" 2>/dev/null; then
            echo "✅ Character JSON is valid"
        else
            echo "❌ Character JSON is invalid"
            exit 1
        fi
    else
        echo "⚠️  jq not found, skipping JSON validation"
    fi

    # Check plugin sequence
    echo ""
    echo "Plugin sequence:"
    if command -v jq &> /dev/null; then
        jq -r '.plugins[]' "$CHARACTER_PATH" | nl
    fi

    echo ""
    echo "✅ Validation complete"

else
    echo "❌ Unknown mode: $MODE"
    echo ""
    echo "Usage: $0 [interactive|test|validate]"
    echo ""
    echo "Modes:"
    echo "  interactive  - Launch interactive chat with Timber"
    echo "  test         - Run automated bug-finding tests"
    echo "  validate     - Validate character configuration"
    exit 1
fi
