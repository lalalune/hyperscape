#!/usr/bin/env bash

# Hyperscape Plugin Validation Script
# This script validates all components of the plugin

set -e

echo "🔍 Hyperscape Plugin Validation Suite"
echo "======================================"
echo ""

PROJECT_ROOT="${HYPERSCAPE_PROJECT_ROOT:-$(pwd)}"
ERRORS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    ((ERRORS++))
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 1. Check environment variables
echo "1️⃣  Checking environment variables..."
if [ -z "$HYPERSCAPE_PROJECT_ROOT" ]; then
    print_warning "HYPERSCAPE_PROJECT_ROOT not set, using current directory"
else
    print_success "HYPERSCAPE_PROJECT_ROOT set to $HYPERSCAPE_PROJECT_ROOT"
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
    print_warning "ANTHROPIC_API_KEY not set (required for memory extraction)"
else
    print_success "ANTHROPIC_API_KEY is set"
fi

# 2. Check directory structure
echo ""
echo "2️⃣  Validating directory structure..."

REQUIRED_DIRS=(
    ".claude-plugin"
    ".claude-plugin/commands"
    ".claude-plugin/agents"
    ".claude-plugin/hooks"
    ".claude-plugin/mcp"
    ".claude-plugin/memory-tools"
    ".claude-plugin/scripts"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$PROJECT_ROOT/$dir" ]; then
        print_success "Directory exists: $dir"
    else
        print_error "Directory missing: $dir"
    fi
done

# 3. Check required files
echo ""
echo "3️⃣  Checking required files..."

REQUIRED_FILES=(
    ".claude-plugin/plugin.json"
    ".claude-plugin/marketplace.json"
    ".claude-plugin/README.md"
    ".claude-plugin/INSTALL.md"
    ".claude-plugin/USAGE.md"
    ".claude-plugin/ARCHITECTURE.md"
    ".claude-plugin/mcp/dist/server.js"
    ".claude-plugin/memory-tools/dist/chat-memory-extractor.js"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$PROJECT_ROOT/$file" ]; then
        print_success "File exists: $file"
    else
        print_error "File missing: $file"
    fi
done

# 4. Check slash commands
echo ""
echo "4️⃣  Validating slash commands..."

COMMAND_FILES=(
    "test-rpg.md"
    "test-visual.md"
    "run-agent.md"
    "check-types.md"
    "build-plugin.md"
    "create-action.md"
    "analyze-errors.md"
    "extract-memories.md"
)

for cmd in "${COMMAND_FILES[@]}"; do
    if [ -f "$PROJECT_ROOT/.claude-plugin/commands/$cmd" ]; then
        print_success "Command exists: $cmd"
    else
        print_error "Command missing: $cmd"
    fi
done

# 5. Check hooks are executable
echo ""
echo "5️⃣  Checking hook permissions..."

HOOK_FILES=(
    "validate-types.sh"
    "pre-commit.sh"
    "post-test.sh"
    "validate-write.sh"
)

for hook in "${HOOK_FILES[@]}"; do
    hook_path="$PROJECT_ROOT/.claude-plugin/hooks/$hook"
    if [ -f "$hook_path" ]; then
        if [ -x "$hook_path" ]; then
            print_success "Hook is executable: $hook"
        else
            print_error "Hook not executable: $hook"
        fi
    else
        print_error "Hook missing: $hook"
    fi
done

# 6. Test MCP server
echo ""
echo "6️⃣  Testing MCP server..."

MCP_SERVER="$PROJECT_ROOT/.claude-plugin/mcp/dist/server.js"
if [ -f "$MCP_SERVER" ]; then
    # Test that server starts (timeout after 2 seconds)
    timeout 2 node "$MCP_SERVER" 2>&1 | head -1 | grep -q "Hyperscape" && \
        print_success "MCP server starts successfully" || \
        print_warning "MCP server may have startup issues"
else
    print_error "MCP server not built"
fi

# 7. Test memory extraction tool
echo ""
echo "7️⃣  Testing memory extraction tool..."

MEMORY_TOOL="$PROJECT_ROOT/.claude-plugin/memory-tools/dist/chat-memory-extractor.js"
if [ -f "$MEMORY_TOOL" ]; then
    print_success "Memory extraction tool is built"

    # Test with example if it exists
    EXAMPLE_CHAT="$PROJECT_ROOT/.claude-plugin/memory-tools/example-chat.json"
    if [ -f "$EXAMPLE_CHAT" ] && [ ! -z "$ANTHROPIC_API_KEY" ]; then
        print_success "Example chat file exists, can test extraction"
    else
        print_warning "Cannot test extraction (missing API key or example)"
    fi
else
    print_error "Memory extraction tool not built"
fi

# 8. Validate JSON files
echo ""
echo "8️⃣  Validating JSON configuration..."

JSON_FILES=(
    ".claude-plugin/plugin.json"
    ".claude-plugin/marketplace.json"
    ".claude-plugin/mcp/package.json"
    ".claude-plugin/memory-tools/package.json"
)

# 8a. Check agent files
echo ""
echo "Checking AI agent files..."

AGENT_FILES=(
    "rpg-action-developer.md"
    "hyperscape-test-engineer.md"
    "typescript-enforcer.md"
    "visual-test-analyst.md"
)

for agent in "${AGENT_FILES[@]}"; do
    if [ -f "$PROJECT_ROOT/.claude-plugin/agents/$agent" ]; then
        print_success "Agent exists: $agent"
    else
        print_error "Agent missing: $agent"
    fi
done

for json_file in "${JSON_FILES[@]}"; do
    if [ -f "$PROJECT_ROOT/$json_file" ]; then
        if node -e "JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/$json_file', 'utf8'))" 2>/dev/null; then
            print_success "Valid JSON: $json_file"
        else
            print_error "Invalid JSON: $json_file"
        fi
    fi
done

# 9. Check dependencies
echo ""
echo "9️⃣  Checking dependencies..."

if [ -d "$PROJECT_ROOT/.claude-plugin/mcp/node_modules" ]; then
    print_success "MCP server dependencies installed"
else
    print_warning "MCP server dependencies not installed"
fi

if [ -d "$PROJECT_ROOT/.claude-plugin/memory-tools/node_modules" ]; then
    print_success "Memory tools dependencies installed"
else
    print_warning "Memory tools dependencies not installed"
fi

# 10. Test a hook
echo ""
echo "🔟 Testing type validation hook..."

if [ -x "$PROJECT_ROOT/.claude-plugin/hooks/validate-types.sh" ]; then
    # Create a temporary test file with 'any' type
    TEST_DIR="$PROJECT_ROOT/.test-validation"
    mkdir -p "$TEST_DIR"
    echo "const foo: any = 123;" > "$TEST_DIR/test.ts"

    if bash "$PROJECT_ROOT/.claude-plugin/hooks/validate-types.sh" "$TEST_DIR" 2>&1 | grep -q "any"; then
        print_success "Type validation hook detects violations"
    else
        print_error "Type validation hook not working correctly"
    fi

    rm -rf "$TEST_DIR"
else
    print_error "Type validation hook not executable"
fi

# Summary
echo ""
echo "======================================"
echo "📊 Validation Summary"
echo "======================================"

if [ $ERRORS -eq 0 ]; then
    print_success "All validations passed! Plugin is ready to use."
    echo ""
    echo "Next steps:"
    echo "1. Install plugin: /plugin install ./.claude-plugin"
    echo "2. Configure MCP server (see INSTALL.md)"
    echo "3. Test commands: /check-types"
    exit 0
else
    print_error "Found $ERRORS error(s) during validation"
    echo ""
    echo "Please fix the errors above before using the plugin."
    echo "See INSTALL.md for setup instructions."
    exit 1
fi
