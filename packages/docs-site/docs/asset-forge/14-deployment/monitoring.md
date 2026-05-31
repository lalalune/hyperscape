# Monitoring and Performance Tracking

Comprehensive monitoring strategy for Asset Forge covering logging, error tracking, performance metrics, health checks, and API monitoring to ensure reliable production operation.

## Table of Contents

1. [Logging Strategy](#logging-strategy)
2. [Error Tracking](#error-tracking)
3. [Performance Metrics](#performance-metrics)
4. [Health Checks](#health-checks)
5. [API Monitoring](#api-monitoring)
6. [Alerting](#alerting)
7. [Dashboard Setup](#dashboard-setup)
8. [Incident Response](#incident-response)

## Logging Strategy

### Structured Logging

**File:** `src/utils/logger.ts`

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogEntry {
  timestamp: string
  level: string
  context: string
  message: string
  data?: any
  error?: {
    name: string
    message: string
    stack?: string
  }
}

class Logger {
  private level: LogLevel
  private context: string

  constructor(context: string, level: LogLevel = LogLevel.INFO) {
    this.context = context
    this.level = level
  }

  private log(level: LogLevel, message: string, data?: any, error?: Error) {
    if (level < this.level) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      context: this.context,
      message,
      data,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    }

    // Console output (development)
    if (process.env.NODE_ENV !== 'production') {
      const color = {
        DEBUG: '\x1b[36m', // Cyan
        INFO: '\x1b[32m',  // Green
        WARN: '\x1b[33m',  // Yellow
        ERROR: '\x1b[31m'  // Red
      }[LogLevel[level]]

      console.log(
        `${color}[${entry.timestamp}] ${entry.level}\x1b[0m [${entry.context}] ${entry.message}`,
        entry.data || ''
      )

      if (error) {
        console.error(error)
      }
    }

    // JSON output (production)
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(entry))
    }

    // Write to file
    this.writeToFile(entry)
  }

  private writeToFile(entry: LogEntry) {
    const fs = require('fs')
    const path = require('path')

    const logDir = process.env.LOG_DIR || './logs'
    const logFile = path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`)

    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }

    // Append to log file
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n')
  }

  debug(message: string, data?: any) {
    this.log(LogLevel.DEBUG, message, data)
  }

  info(message: string, data?: any) {
    this.log(LogLevel.INFO, message, data)
  }

  warn(message: string, data?: any) {
    this.log(LogLevel.WARN, message, data)
  }

  error(message: string, error?: Error, data?: any) {
    this.log(LogLevel.ERROR, message, data, error)

    // Send to error tracking service
    if (process.env.NODE_ENV === 'production' && error) {
      this.reportError(error, { message, ...data })
    }
  }

  private reportError(error: Error, context: any) {
    // Send to Sentry, LogRocket, etc.
    // Implementation depends on chosen service
  }
}

// Export factory function
export function createLogger(context: string): Logger {
  const level = process.env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG :
                process.env.LOG_LEVEL === 'warn' ? LogLevel.WARN :
                process.env.LOG_LEVEL === 'error' ? LogLevel.ERROR :
                LogLevel.INFO

  return new Logger(context, level)
}

// Usage
const logger = createLogger('AssetService')
logger.info('Loading asset', { assetId: '123' })
logger.error('Failed to load asset', new Error('Network timeout'), { assetId: '123' })
```

### Log Rotation

**File:** `scripts/rotate-logs.sh`

```bash
#!/bin/bash

LOG_DIR="./logs"
MAX_AGE_DAYS=30
MAX_SIZE_MB=100

# Compress old logs
find $LOG_DIR -name "*.log" -mtime +7 -exec gzip {} \;

# Delete logs older than MAX_AGE_DAYS
find $LOG_DIR -name "*.log.gz" -mtime +$MAX_AGE_DAYS -delete

# Check total log size
TOTAL_SIZE=$(du -sm $LOG_DIR | cut -f1)

if [ $TOTAL_SIZE -gt $MAX_SIZE_MB ]; then
  echo "Warning: Log directory exceeds ${MAX_SIZE_MB}MB"
  # Delete oldest compressed logs
  find $LOG_DIR -name "*.log.gz" -type f -printf '%T+ %p\n' | sort | head -n -10 | cut -d' ' -f2- | xargs rm
fi

echo "Log rotation complete"
```

### PM2 Logs

```bash
# View logs
pm2 logs asset-forge-api

# View last N lines
pm2 logs asset-forge-api --lines 100

# View error logs only
pm2 logs asset-forge-api --err

# Flush logs
pm2 flush

# Rotate logs
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## Error Tracking

### Sentry Integration

```bash
# Install Sentry
npm install @sentry/browser @sentry/node
```

**File:** `src/utils/sentry.ts`

```typescript
import * as Sentry from '@sentry/browser'
import { BrowserTracing } from '@sentry/tracing'

// Initialize Sentry
if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [new BrowserTracing()],
    tracesSampleRate: 0.1, // 10% of transactions
    environment: process.env.NODE_ENV,
    release: process.env.npm_package_version,

    beforeSend(event, hint) {
      // Filter out non-critical errors
      if (event.exception?.values?.[0]?.value?.includes('Network request failed')) {
        // Log but don't send to Sentry
        console.warn('Network error filtered:', hint.originalException)
        return null
      }

      return event
    }
  })
}

// Error boundary wrapper
export function captureError(error: Error, context?: Record<string, any>) {
  console.error('Captured error:', error, context)

  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      tags: {
        component: context?.component || 'unknown'
      },
      extra: context
    })
  }
}

// Performance monitoring
export function trackPerformance(name: string, duration: number) {
  Sentry.addBreadcrumb({
    category: 'performance',
    message: `${name} took ${duration}ms`,
    level: 'info',
    data: { duration }
  })

  if (duration > 1000) {
    console.warn(`Slow operation: ${name} took ${duration}ms`)
  }
}
```

### Error Boundary (React)

```typescript
import { Component, ErrorInfo, ReactNode } from 'react'
import { captureError } from '@/utils/sentry'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error boundary caught error:', error, errorInfo)

    captureError(error, {
      component: 'ErrorBoundary',
      componentStack: errorInfo.componentStack
    })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// Usage
function App() {
  return (
    <ErrorBoundary>
      <AssetForge />
    </ErrorBoundary>
  )
}
```

## Performance Metrics

### Custom Metrics Collector

```typescript
interface Metric {
  name: string
  value: number
  unit: string
  timestamp: number
  tags?: Record<string, string>
}

class MetricsCollector {
  private metrics: Metric[] = []
  private flushInterval: number = 60000 // 1 minute

  constructor() {
    this.startFlushTimer()
  }

  record(name: string, value: number, unit: string = 'ms', tags?: Record<string, string>) {
    this.metrics.push({
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags
    })
  }

  private startFlushTimer() {
    setInterval(() => {
      this.flush()
    }, this.flushInterval)
  }

  private flush() {
    if (this.metrics.length === 0) return

    // Send to monitoring service (e.g., CloudWatch, Datadog, Grafana)
    this.sendToMonitoringService(this.metrics)

    // Clear metrics
    this.metrics = []
  }

  private async sendToMonitoringService(metrics: Metric[]) {
    // Implementation depends on monitoring service
    console.log('Flushing metrics:', metrics.length)

    // Example: Send to custom endpoint
    try {
      await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics })
      })
    } catch (error) {
      console.error('Failed to send metrics:', error)
    }
  }
}

export const metrics = new MetricsCollector()

// Usage
metrics.record('asset_load_time', 1234, 'ms', { assetType: 'weapon' })
metrics.record('api_request_count', 1, 'count', { endpoint: '/api/assets' })
```

### Performance Monitoring

```typescript
// Track function performance
function trackPerformance(fn: Function, name: string) {
  return async function(...args: any[]) {
    const start = performance.now()

    try {
      const result = await fn.apply(this, args)
      const duration = performance.now() - start

      metrics.record(`${name}_duration`, duration, 'ms')

      if (duration > 1000) {
        logger.warn(`Slow operation: ${name} took ${duration}ms`)
      }

      return result
    } catch (error) {
      const duration = performance.now() - start
      metrics.record(`${name}_error`, 1, 'count')
      logger.error(`Operation failed: ${name}`, error as Error, { duration })
      throw error
    }
  }
}

// Usage
class AssetService {
  @trackPerformance
  async loadAsset(id: string) {
    // ... implementation ...
  }
}
```

## Health Checks

### Application Health Endpoint

**File:** `server/api.mjs`

```javascript
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: process.memoryUsage().heapUsed / 1024 / 1024,
      total: process.memoryUsage().heapTotal / 1024 / 1024,
      rss: process.memoryUsage().rss / 1024 / 1024
    },
    services: {
      meshy: !!process.env.MESHY_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      database: await checkDatabaseHealth(),
      imageServer: await checkImageServerHealth()
    }
  }

  // Determine overall health
  const allServicesHealthy = Object.values(health.services).every(v => v === true)

  if (!allServicesHealthy) {
    health.status = 'degraded'
    res.status(503)
  }

  res.json(health)
})

async function checkDatabaseHealth() {
  try {
    // Simple query to check database
    const result = await db.query('SELECT 1')
    return result !== null
  } catch {
    return false
  }
}

async function checkImageServerHealth() {
  try {
    const response = await fetch(`${process.env.IMAGE_SERVER_URL}/health`, {
      timeout: 5000
    })
    return response.ok
  } catch {
    return false
  }
}
```

### System Health Monitoring

**File:** `scripts/health-monitor.sh`

```bash
#!/bin/bash

# Check API health
API_HEALTH=$(curl -s http://localhost:3004/api/health | jq -r '.status')

if [ "$API_HEALTH" != "healthy" ]; then
  echo "$(date) - API unhealthy: $API_HEALTH" >> logs/health-monitor.log
  # Restart if degraded
  if [ "$API_HEALTH" == "degraded" ]; then
    pm2 restart asset-forge-api
  fi
fi

# Check CPU usage
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)

if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
  echo "$(date) - High CPU usage: $CPU_USAGE%" >> logs/health-monitor.log
fi

# Check memory usage
MEM_USAGE=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')

if (( $(echo "$MEM_USAGE > 80" | bc -l) )); then
  echo "$(date) - High memory usage: $MEM_USAGE%" >> logs/health-monitor.log
fi

# Check disk space
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | cut -d'%' -f1)

if [ $DISK_USAGE -gt 80 ]; then
  echo "$(date) - High disk usage: $DISK_USAGE%" >> logs/health-monitor.log
fi
```

## API Monitoring

### Request Logging Middleware

```javascript
import { createLogger } from './logger.mjs'

const logger = createLogger('API')

export function requestLoggingMiddleware(req, res, next) {
  const start = Date.now()

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent')
  })

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start

    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`
    })

    // Record metrics
    metrics.record('api_request_duration', duration, 'ms', {
      endpoint: req.path,
      method: req.method,
      status: res.statusCode.toString()
    })

    metrics.record('api_request_count', 1, 'count', {
      endpoint: req.path,
      method: req.method,
      status: res.statusCode.toString()
    })
  })

  next()
}
```

### Rate Limit Monitoring

```javascript
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path
    })

    metrics.record('rate_limit_exceeded', 1, 'count', {
      endpoint: req.path
    })

    res.status(429).json({
      error: 'Too many requests, please try again later'
    })
  }
})
```

## Alerting

### Alert Configuration

```typescript
interface AlertRule {
  name: string
  condition: () => boolean | Promise<boolean>
  severity: 'low' | 'medium' | 'high' | 'critical'
  action: () => void | Promise<void>
}

const alertRules: AlertRule[] = [
  {
    name: 'High Error Rate',
    condition: async () => {
      const errorRate = await getErrorRate()
      return errorRate > 0.05 // 5% error rate
    },
    severity: 'high',
    action: async () => {
      await sendAlert('High error rate detected', {
        errorRate: await getErrorRate()
      })
    }
  },
  {
    name: 'Low Memory',
    condition: () => {
      const memory = process.memoryUsage()
      return (memory.heapUsed / memory.heapTotal) > 0.9 // 90% memory usage
    },
    severity: 'medium',
    action: async () => {
      await sendAlert('Low memory warning', {
        memoryUsage: process.memoryUsage()
      })
    }
  },
  {
    name: 'API Down',
    condition: async () => {
      try {
        const response = await fetch('http://localhost:3004/api/health')
        return !response.ok
      } catch {
        return true
      }
    },
    severity: 'critical',
    action: async () => {
      await sendAlert('API is down', { timestamp: new Date().toISOString() })
      // Auto-restart
      exec('pm2 restart asset-forge-api')
    }
  }
]

// Check alerts every minute
setInterval(async () => {
  for (const rule of alertRules) {
    const triggered = await rule.condition()

    if (triggered) {
      logger.warn(`Alert triggered: ${rule.name}`, { severity: rule.severity })
      await rule.action()
    }
  }
}, 60000)

async function sendAlert(message: string, data: any) {
  // Send to Slack, PagerDuty, email, etc.
  console.log(`ALERT: ${message}`, data)

  // Example: Send to Slack webhook
  if (process.env.SLACK_WEBHOOK_URL) {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${message}\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\``
      })
    })
  }
}
```

## Dashboard Setup

### Grafana + Prometheus

```yaml
# docker-compose.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana

volumes:
  prometheus-data:
  grafana-data:
```

**File:** `prometheus.yml`

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'asset-forge-api'
    static_configs:
      - targets: ['localhost:3004']
```

## Incident Response

### Incident Response Playbook

1. **Detect**: Alert triggered or user report
2. **Assess**: Check logs, metrics, health endpoints
3. **Mitigate**: Restart services, rollback deploy, scale up
4. **Communicate**: Update status page, notify stakeholders
5. **Resolve**: Fix root cause
6. **Post-mortem**: Document incident and preventive measures

### Runbook Examples

**API Down:**
```bash
# 1. Check API status
curl http://localhost:3004/api/health

# 2. Check PM2 status
pm2 list

# 3. View logs
pm2 logs asset-forge-api --lines 100

# 4. Restart if needed
pm2 restart asset-forge-api

# 5. Verify recovery
curl http://localhost:3004/api/health
```

**High Memory Usage:**
```bash
# 1. Check memory
pm2 monit

# 2. Identify process
ps aux --sort=-%mem | head

# 3. Restart affected service
pm2 restart asset-forge-api

# 4. Monitor recovery
pm2 monit
```

## Conclusion

Comprehensive monitoring ensures Asset Forge operates reliably in production. Implement structured logging, error tracking, performance metrics, health checks, and alerting to quickly identify and resolve issues.

**Key Takeaways:**
- Implement structured JSON logging
- Use Sentry for error tracking
- Collect performance metrics
- Set up health check endpoints
- Configure alerting for critical issues
- Create runbooks for common incidents
- Monitor logs and dashboards regularly
