Deploy application with comprehensive safety checks and verification.

## What This Does

1. Pre-deployment validation
2. Run tests and linting
3. Build application
4. Deploy to specified environment
5. Run post-deployment health checks
6. Rollback on failure

## Instructions

### 1. Parse Arguments

```bash
# Usage: /deploy [environment] [branch]
# Examples:
#   /deploy staging
#   /deploy production main
#   /deploy staging feature-x

ENVIRONMENT=${1:-staging}
BRANCH=${2:-$(git branch --show-current)}
```

### 2. Pre-Deployment Checks

```bash
echo "🔍 Pre-deployment validation..."

# Check git status
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Uncommitted changes detected"
  echo "Please commit or stash changes before deploying"
  exit 1
fi

# Check if branch is up to date
git fetch origin $BRANCH
LOCAL=$(git rev-parse $BRANCH)
REMOTE=$(git rev-parse origin/$BRANCH)

if [ "$LOCAL" != "$REMOTE" ]; then
  echo "❌ Local branch is not up to date with remote"
  echo "Run: git pull origin $BRANCH"
  exit 1
fi

# Verify environment
case $ENVIRONMENT in
  staging|production)
    echo "✅ Environment: $ENVIRONMENT"
    ;;
  *)
    echo "❌ Invalid environment: $ENVIRONMENT"
    echo "Valid options: staging, production"
    exit 1
    ;;
esac
```

### 3. Run Tests

```bash
echo "🧪 Running tests..."

# Detect test command
if [ -f "package.json" ]; then
  npm test
elif [ -f "pytest.ini" ] || [ -f "setup.py" ]; then
  pytest
elif [ -f "go.mod" ]; then
  go test ./...
else
  echo "⚠️  No test framework detected, skipping tests"
fi

if [ $? -ne 0 ]; then
  echo "❌ Tests failed - deployment aborted"
  exit 1
fi

echo "✅ All tests passed"
```

### 4. Run Linting

```bash
echo "🔍 Running linting..."

if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ]; then
  npm run lint
elif [ -f "pyproject.toml" ]; then
  black --check . && flake8
else
  echo "⚠️  No linter configured, skipping"
fi

if [ $? -ne 0 ]; then
  echo "❌ Linting failed - deployment aborted"
  exit 1
fi

echo "✅ Linting passed"
```

### 5. Build Application

```bash
echo "🔨 Building application..."

if [ -f "package.json" ]; then
  npm run build
elif [ -f "Makefile" ]; then
  make build
elif [ -f "Dockerfile" ]; then
  docker build -t app:$BRANCH .
else
  echo "⚠️  No build configuration found"
fi

if [ $? -ne 0 ]; then
  echo "❌ Build failed - deployment aborted"
  exit 1
fi

echo "✅ Build successful"
```

### 6. Deploy

```bash
echo "🚀 Deploying to $ENVIRONMENT..."

# Tag deployment
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
TAG="deploy-$ENVIRONMENT-$TIMESTAMP"
git tag $TAG
git push origin $TAG

# Deploy based on environment
case $ENVIRONMENT in
  staging)
    # Example: Deploy to staging
    if [ -f "deploy-staging.sh" ]; then
      ./deploy-staging.sh
    elif command -v netlify &> /dev/null; then
      netlify deploy --prod --dir=dist
    elif command -v vercel &> /dev/null; then
      vercel --prod
    else
      echo "❌ No deployment script found"
      exit 1
    fi
    ;;

  production)
    # Require confirmation for production
    echo "⚠️  PRODUCTION DEPLOYMENT"
    read -p "Type 'DEPLOY' to confirm: " confirm
    if [ "$confirm" != "DEPLOY" ]; then
      echo "❌ Deployment cancelled"
      exit 1
    fi

    if [ -f "deploy-production.sh" ]; then
      ./deploy-production.sh
    else
      echo "❌ No production deployment script found"
      exit 1
    fi
    ;;
esac

if [ $? -ne 0 ]; then
  echo "❌ Deployment failed"
  exit 1
fi

echo "✅ Deployment successful"
```

### 7. Health Checks

```bash
echo "🏥 Running health checks..."

sleep 5  # Wait for deployment to stabilize

# Determine health check URL
if [ "$ENVIRONMENT" = "staging" ]; then
  HEALTH_URL="https://staging.example.com/health"
elif [ "$ENVIRONMENT" = "production" ]; then
  HEALTH_URL="https://example.com/health"
fi

# Check health endpoint
for i in {1..5}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

  if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Health check passed ($i/5)"
    break
  else
    echo "⚠️  Health check attempt $i/5 failed (HTTP $HTTP_CODE)"
    if [ $i -eq 5 ]; then
      echo "❌ Health checks failed - consider rollback"
      exit 1
    fi
    sleep 10
  fi
done
```

### 8. Summary

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 DEPLOYMENT SUCCESSFUL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Environment: $ENVIRONMENT"
echo "Branch: $BRANCH"
echo "Tag: $TAG"
echo "URL: $HEALTH_URL"
echo "Time: $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  • Monitor logs: tail -f /var/log/app.log"
echo "  • Check metrics: open https://metrics.example.com"
echo "  • Rollback if needed: /rollback $TAG"
```

## Rollback Command

Create `/rollback` command for emergency rollback:

```bash
# /rollback [tag]
TAG=${1}

if [ -z "$TAG" ]; then
  echo "❌ Usage: /rollback <tag>"
  exit 1
fi

echo "⚠️  Rolling back to $TAG"
git checkout $TAG
# Run deployment with previous version
```

## Environment Variables

Ensure these are set:
- `DEPLOY_ENV` - Environment name
- `HEALTH_CHECK_URL` - Health check endpoint
- `SLACK_WEBHOOK` - For notifications (optional)

## Best Practices

- Always run in CI/CD for production
- Use blue-green or canary deployments
- Monitor metrics after deployment
- Have rollback plan ready
- Test in staging first
- Keep deployment logs
- Notify team of deployments
