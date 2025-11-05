Safely update dependencies with testing and rollback support.

## Instructions

```bash
echo "📦 Updating Dependencies..."

# Backup current lockfile
cp package-lock.json package-lock.json.backup 2>/dev/null || true
cp package.json package.json.backup 2>/dev/null || true

# Check for outdated packages
if [ -f "package.json" ]; then
  echo "Outdated npm packages:"
  npm outdated

  read -p "Update all dependencies? (y/N): " confirm
  if [ "$confirm" = "y" ]; then
    npm update
    npm audit fix

    echo "Running tests..."
    npm test

    if [ $? -ne 0 ]; then
      echo "❌ Tests failed - rolling back"
      mv package-lock.json.backup package-lock.json
      mv package.json.backup package.json
      npm install
      exit 1
    fi

    echo "✅ Dependencies updated successfully"
    rm *.backup
  fi
elif [ -f "requirements.txt" ]; then
  pip list --outdated
  pip install --upgrade -r requirements.txt
fi

echo "Don't forget to commit: git add package*.json && git commit -m 'chore: update dependencies'"
```
