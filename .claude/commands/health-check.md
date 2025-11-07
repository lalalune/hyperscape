Run comprehensive health checks on application and dependencies.

## Instructions

```bash
echo "🏥 Running Health Checks..."
echo ""

FAILED=0

# 1. Application health
echo "🔍 Checking application..."
APP_URL=${1:-http://localhost:3000}
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $APP_URL/health)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Application responding"
else
  echo "❌ Application not responding (HTTP $HTTP_CODE)"
  FAILED=$((FAILED + 1))
fi

# 2. Database connectivity
echo "🗄️  Checking database..."
if [ -f ".env" ]; then
  DB_URL=$(grep "^DATABASE_URL=" .env | cut -d'=' -f2-)

  if command -v psql &> /dev/null; then
    psql "$DB_URL" -c "SELECT 1;" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
      echo "✅ Database connected"
    else
      echo "❌ Database connection failed"
      FAILED=$((FAILED + 1))
    fi
  fi
fi

# 3. Redis/Cache
echo "📦 Checking cache..."
if command -v redis-cli &> /dev/null; then
  redis-cli ping > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "✅ Redis responding"
  else
    echo "⚠️  Redis not responding"
  fi
fi

# 4. Disk space
echo "💾 Checking disk space..."
DISK_USAGE=$(df -h . | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 90 ]; then
  echo "✅ Disk space OK ($DISK_USAGE%)"
else
  echo "⚠️  Disk space critical ($DISK_USAGE%)"
fi

# 5. Memory
echo "🧠 Checking memory..."
if command -v free &> /dev/null; then
  MEM_USAGE=$(free | grep Mem | awk '{print ($3/$2) * 100.0}' | cut -d'.' -f1)
  echo "Memory usage: $MEM_USAGE%"
fi

# Summary
echo ""
if [ $FAILED -eq 0 ]; then
  echo "✅ All health checks passed"
else
  echo "❌ $FAILED health check(s) failed"
  exit 1
fi
```
