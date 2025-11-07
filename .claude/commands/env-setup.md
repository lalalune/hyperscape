Set up environment variables safely with validation and templates.

## What This Does

1. Creates .env file from template
2. Validates required variables
3. Generates secure random values
4. Ensures .env is in .gitignore

## Instructions

```bash
echo "🔧 Setting up environment variables..."

# 1. Ensure .env is in .gitignore
if [ ! -f ".gitignore" ]; then
  touch .gitignore
fi

if ! grep -q "^\.env$" .gitignore; then
  echo ".env" >> .gitignore
  echo "✅ Added .env to .gitignore"
fi

# 2. Create .env.example if it doesn't exist
if [ ! -f ".env.example" ]; then
  cat > .env.example << 'EOF'
# Application
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Authentication
JWT_SECRET=generate-with-openssl
SESSION_SECRET=generate-with-openssl

# External APIs
API_KEY=your-api-key-here

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password

# Optional
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
EOF
  echo "✅ Created .env.example template"
fi

# 3. Copy to .env if it doesn't exist
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "✅ Created .env from template"
else
  echo "⚠️  .env already exists"
  read -p "Overwrite? (y/N): " confirm
  if [ "$confirm" = "y" ]; then
    cp .env.example .env
    echo "✅ Overwrote .env"
  fi
fi

# 4. Generate secure secrets
echo ""
echo "🔐 Generating secure secrets..."

# Generate JWT secret
JWT_SECRET=$(openssl rand -hex 32)
sed -i '' "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
echo "✅ Generated JWT_SECRET"

# Generate session secret
SESSION_SECRET=$(openssl rand -hex 32)
sed -i '' "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" .env
echo "✅ Generated SESSION_SECRET"

# 5. Prompt for required values
echo ""
echo "📝 Please provide the following values:"

read -p "Database URL [postgresql://user:password@localhost:5432/dbname]: " db_url
if [ -n "$db_url" ]; then
  sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=$db_url|" .env
fi

read -p "API Key (press enter to skip): " api_key
if [ -n "$api_key" ]; then
  sed -i '' "s/API_KEY=.*/API_KEY=$api_key/" .env
fi

# 6. Validate .env
echo ""
echo "✅ Validating environment variables..."

# Check for placeholder values
if grep -q "your-.*-here\|generate-with-openssl" .env; then
  echo "⚠️  Warning: Some values still need to be configured"
fi

# Check required variables
REQUIRED_VARS=("NODE_ENV" "PORT" "DATABASE_URL" "JWT_SECRET")

for var in "${REQUIRED_VARS[@]}"; do
  if ! grep -q "^$var=" .env; then
    echo "❌ Missing required variable: $var"
  else
    echo "✅ $var is set"
  fi
done

# 7. Test database connection (optional)
echo ""
read -p "Test database connection? (y/N): " test_db
if [ "$test_db" = "y" ]; then
  if command -v psql &> /dev/null; then
    DB_URL=$(grep "^DATABASE_URL=" .env | cut -d'=' -f2-)
    psql "$DB_URL" -c "SELECT 1;" && echo "✅ Database connection successful" || echo "❌ Database connection failed"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ENVIRONMENT SETUP COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Files created:"
echo "  • .env (secrets - NOT in git)"
echo "  • .env.example (template - in git)"
echo ""
echo "⚠️  IMPORTANT:"
echo "  • Never commit .env to git"
echo "  • Keep .env.example updated"
echo "  • Use different values for each environment"
echo "  • Rotate secrets regularly"
```

## Best Practices

- Keep .env out of version control
- Update .env.example when adding variables
- Use different values per environment
- Rotate secrets regularly
- Validate required variables on startup
- Use strong random values for secrets
- Document all variables
