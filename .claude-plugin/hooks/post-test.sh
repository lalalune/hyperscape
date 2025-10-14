#!/bin/bash
# Post-test hook: Collect test logs and generate summary

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_DIR=".claude-plugin/test-results/$TIMESTAMP"

echo "📊 Collecting test results..."

# Create results directory
mkdir -p "$RESULTS_DIR"

# Copy logs if they exist
if [ -d "logs" ]; then
    cp -r logs/* "$RESULTS_DIR/" 2>/dev/null || true
    echo "✅ Copied logs to $RESULTS_DIR"
fi

# Copy screenshots if they exist
if [ -d "screenshots" ]; then
    cp -r screenshots/* "$RESULTS_DIR/" 2>/dev/null || true
    echo "✅ Copied screenshots to $RESULTS_DIR"
fi

# Generate summary
SUMMARY_FILE="$RESULTS_DIR/summary.txt"
echo "Test Summary" > "$SUMMARY_FILE"
echo "============" >> "$SUMMARY_FILE"
echo "Timestamp: $(date)" >> "$SUMMARY_FILE"
echo "Git Commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'N/A')" >> "$SUMMARY_FILE"
echo "Git Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'N/A')" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

# Count log files by type
ERROR_LOGS=$(find "$RESULTS_DIR" -name "*.log" -exec grep -l "Error" {} \; 2>/dev/null | wc -l || echo "0")
echo "Error logs: $ERROR_LOGS" >> "$SUMMARY_FILE"

echo "✅ Test summary generated: $SUMMARY_FILE"
echo ""
echo "📁 Results location: $RESULTS_DIR"

exit 0
