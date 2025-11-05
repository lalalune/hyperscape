---
name: api-gateway-configurator
description: Configure and manage API gateways including Kong, Tyk, AWS API Gateway, and Apigee. Activates when users need help setting up API gateways, rate limiting, authentication, request transformation, or API management.
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob]
---

# API Gateway Configurator

Enterprise skill for configuring and managing API gateways for microservices architectures.

## When to Use

This skill should be used when:
- Setting up API gateway for microservices
- Configuring rate limiting and throttling
- Implementing API authentication and authorization
- Setting up request/response transformation
- Configuring API routing and load balancing
- Implementing API versioning strategies
- Setting up API monitoring and analytics
- Managing API documentation and developer portals

## Instructions

### Step 1: Choose API Gateway Platform

Select the appropriate API gateway based on requirements:

**Kong Gateway (Open Source/Enterprise):**
- Best for: Kubernetes-native, plugin ecosystem
- Strengths: Performance, extensibility, cloud-native
- Use cases: Microservices, multi-cloud, hybrid cloud

**AWS API Gateway:**
- Best for: AWS-native applications, serverless
- Strengths: AWS integration, managed service, scalability
- Use cases: Lambda functions, AWS services, serverless APIs

**Tyk:**
- Best for: GraphQL, multi-cloud, analytics
- Strengths: Developer portal, analytics, open source
- Use cases: GraphQL federation, API analytics

**Apigee (Google Cloud):**
- Best for: Enterprise API management, monetization
- Strengths: Analytics, developer portal, API products
- Use cases: External APIs, partner APIs, API monetization

### Step 2: Configure Core Features

#### Kong Configuration Example:

```yaml
# kong.yml - Declarative configuration
_format_version: "3.0"

services:
  - name: user-service
    url: http://user-service:8080
    routes:
      - name: user-routes
        paths:
          - /api/v1/users
        methods:
          - GET
          - POST
        strip_path: false
    plugins:
      - name: rate-limiting
        config:
          minute: 100
          policy: local
      - name: jwt
        config:
          claims_to_verify:
            - exp
      - name: cors
        config:
          origins:
            - "*"
          methods:
            - GET
            - POST
          headers:
            - Accept
            - Authorization
          max_age: 3600

  - name: order-service
    url: http://order-service:8080
    routes:
      - name: order-routes
        paths:
          - /api/v1/orders
    plugins:
      - name: rate-limiting
        config:
          minute: 50
      - name: request-transformer
        config:
          add:
            headers:
              - "X-Gateway:Kong"

# Global plugins
plugins:
  - name: prometheus
    config:
      per_consumer: true
  - name: correlation-id
    config:
      header_name: X-Correlation-ID
      generator: uuid
```

#### AWS API Gateway Configuration:

```yaml
# serverless.yml for AWS API Gateway
provider:
  name: aws
  runtime: nodejs18.x
  apiGateway:
    apiKeys:
      - name: premium-api-key
        value: ${env:API_KEY}
    usagePlan:
      - premium:
          quota:
            limit: 5000
            period: MONTH
          throttle:
            burstLimit: 200
            rateLimit: 100
    resourcePolicy:
      - Effect: Allow
        Principal: "*"
        Action: execute-api:Invoke
        Resource:
          - execute-api:/*/*/*

functions:
  getUsers:
    handler: users.getUsers
    events:
      - http:
          path: users
          method: get
          cors: true
          authorizer:
            name: jwtAuthorizer
            type: request
          request:
            parameters:
              querystrings:
                page: false
                limit: false
          throttling:
            maxRequestsPerSecond: 100
            maxConcurrentRequests: 50

  createUser:
    handler: users.createUser
    events:
      - http:
          path: users
          method: post
          cors: true
          authorizer: jwtAuthorizer
```

### Step 3: Implement Authentication & Authorization

#### JWT Authentication (Kong):

```yaml
# Create JWT consumer
consumers:
  - username: mobile-app
    jwt_credentials:
      - key: mobile-app-key
        algorithm: HS256
        secret: ${JWT_SECRET}

# Apply JWT plugin to service
services:
  - name: protected-service
    plugins:
      - name: jwt
        config:
          header_names:
            - Authorization
          claims_to_verify:
            - exp
            - nbf
```

#### OAuth2 (Kong):

```yaml
plugins:
  - name: oauth2
    config:
      scopes:
        - read
        - write
        - admin
      mandatory_scope: true
      enable_authorization_code: true
      enable_client_credentials: true
      enable_implicit_grant: false
      token_expiration: 3600
      refresh_token_ttl: 2592000
```

### Step 4: Configure Rate Limiting & Throttling

```yaml
# Kong - Multiple rate limiting strategies
plugins:
  # Per-consumer rate limiting
  - name: rate-limiting
    consumer: mobile-app
    config:
      second: 10
      minute: 100
      hour: 1000
      policy: redis
      redis:
        host: redis-cluster
        port: 6379
        database: 0

  # Advanced rate limiting
  - name: rate-limiting-advanced
    config:
      limit:
        - minute: 100
        - hour: 1000
      window_size:
        - 60
        - 3600
      sync_rate: 10
      strategy: cluster
      dictionary_name: kong_rate_limiting_counters
```

### Step 5: Set Up Request/Response Transformation

```yaml
# Request transformation
plugins:
  - name: request-transformer
    config:
      add:
        headers:
          - "X-Request-ID:$(uuid)"
          - "X-Forwarded-For:$(client_ip)"
        querystring:
          - "version:v1"
      remove:
        headers:
          - "Authorization"  # Don't pass to backend
      replace:
        headers:
          - "Host:backend-service"

# Response transformation
plugins:
  - name: response-transformer
    config:
      add:
        headers:
          - "X-Response-Time:$(latency)"
          - "X-Gateway:Kong"
      remove:
        headers:
          - "X-Internal-Secret"
      replace:
        json:
          - "$.metadata.source:api-gateway"
```

### Step 6: Implement API Versioning

```yaml
# URL path versioning
services:
  - name: user-service-v1
    url: http://user-service-v1:8080
    routes:
      - paths:
          - /api/v1/users

  - name: user-service-v2
    url: http://user-service-v2:8080
    routes:
      - paths:
          - /api/v2/users

# Header-based versioning
routes:
  - name: versioned-route
    paths:
      - /api/users
    plugins:
      - name: request-transformer
        config:
          add:
            headers:
              - "X-API-Version:$(header.Accept-Version)"
```

### Step 7: Configure Monitoring & Analytics

```yaml
# Prometheus metrics
plugins:
  - name: prometheus
    config:
      per_consumer: true
      status_code_metrics: true
      latency_metrics: true
      bandwidth_metrics: true
      upstream_health_metrics: true

# Logging
plugins:
  - name: file-log
    config:
      path: /var/log/kong/access.log
      reopen: true

  - name: http-log
    config:
      http_endpoint: http://log-aggregator:8080/logs
      method: POST
      content_type: application/json
      timeout: 10000
      keepalive: 60000

# Datadog integration
plugins:
  - name: datadog
    config:
      host: datadog-agent
      port: 8125
      metrics:
        - name: request_count
          stat_type: counter
        - name: latency
          stat_type: timer
```

## Best Practices

### Security:
- ✅ Always use HTTPS/TLS for API gateway
- ✅ Implement JWT or OAuth2 for authentication
- ✅ Use API keys for external partners
- ✅ Enable CORS with specific origins
- ✅ Implement request size limits
- ✅ Add security headers (HSTS, CSP, etc.)

### Performance:
- ✅ Enable caching for GET requests
- ✅ Use Redis for distributed rate limiting
- ✅ Configure connection pooling to backends
- ✅ Set appropriate timeouts
- ✅ Enable gzip compression
- ✅ Use CDN for static content

### Reliability:
- ✅ Configure health checks for backends
- ✅ Implement circuit breakers
- ✅ Set up retry policies
- ✅ Configure fallback responses
- ✅ Use multiple gateway instances
- ✅ Monitor gateway metrics

### Operations:
- ✅ Use declarative configuration (GitOps)
- ✅ Version control gateway configs
- ✅ Implement blue-green deployments
- ✅ Set up comprehensive logging
- ✅ Configure alerts for anomalies
- ✅ Regular security audits

## Examples

### Example 1: Microservices E-Commerce Gateway

```yaml
# Kong configuration for e-commerce platform
services:
  - name: product-catalog
    url: http://catalog-service:8080
    routes:
      - paths: ["/api/v1/products"]
    plugins:
      - name: rate-limiting
        config:
          minute: 1000
      - name: cors
      - name: jwt
      - name: response-cache
        config:
          strategy: memory
          memory:
            dictionary_name: kong_cache

  - name: shopping-cart
    url: http://cart-service:8080
    routes:
      - paths: ["/api/v1/cart"]
    plugins:
      - name: rate-limiting
        config:
          minute: 100
      - name: jwt
      - name: request-size-limiting
        config:
          allowed_payload_size: 10

  - name: checkout
    url: http://checkout-service:8080
    routes:
      - paths: ["/api/v1/checkout"]
    plugins:
      - name: rate-limiting
        config:
          minute: 50
      - name: jwt
      - name: bot-detection
      - name: ip-restriction
        config:
          allow:
            - 10.0.0.0/8
```

### Example 2: AWS API Gateway with Lambda

```yaml
# API Gateway with Lambda integration
functions:
  getUserProfile:
    handler: handlers/users.getProfile
    events:
      - http:
          path: users/{userId}/profile
          method: get
          cors:
            origin: 'https://app.example.com'
            headers:
              - Content-Type
              - Authorization
          authorizer:
            arn: arn:aws:lambda:us-east-1:123456789:function:authorizer
            resultTtlInSeconds: 300
            identitySource: method.request.header.Authorization
          request:
            parameters:
              paths:
                userId: true
          caching:
            enabled: true
            ttlInSeconds: 300
            dataEncrypted: true
```

## Common Mistakes to Avoid

- ❌ Not implementing rate limiting
- ❌ Exposing internal service URLs
- ❌ No authentication on public APIs
- ❌ Missing CORS configuration
- ❌ No monitoring or logging
- ❌ Hardcoding credentials in config
- ❌ Not versioning APIs
- ❌ Single gateway instance (no HA)
- ❌ No request/response validation
- ❌ Missing error handling

✅ **Correct approach:**
- Implement multi-layer rate limiting
- Use service discovery internally
- JWT/OAuth2 authentication
- Proper CORS with allowed origins
- Comprehensive monitoring
- Use environment variables/secrets
- Version APIs from day one
- Deploy in HA configuration
- Validate all inputs/outputs
- Implement circuit breakers

## Tips

- 💡 Start with managed API gateway for faster setup
- 💡 Use declarative configuration for repeatability
- 💡 Implement caching to reduce backend load
- 💡 Monitor gateway metrics continuously
- 💡 Use API gateway for security boundary
- 💡 Implement request tracing for debugging
- 💡 Version APIs early, migrate gradually
- 💡 Test rate limiting before production

## Related Skills/Commands

### Skills:
- `microservices-orchestrator` - Microservices architecture
- `service-mesh-integrator` - Service mesh integration
- `distributed-tracing-setup` - Request tracing

### Commands:
- `/dependency-graph` - Visualize API dependencies
- `/load-test-suite` - Test API gateway performance
- `/security-posture` - Security assessment

### Agents:
- `enterprise-architect` - Architecture design
- `security-architect` - Security configuration
- `sre-consultant` - SLO/SLI setup

## Notes

**API Gateway Selection Criteria:**
- ✅ **Kong**: Best for Kubernetes, open source, plugin ecosystem
- ✅ **AWS API Gateway**: Best for AWS Lambda, managed service
- ✅ **Tyk**: Best for GraphQL, analytics, multi-cloud
- ✅ **Apigee**: Best for enterprise API management

**Common Patterns:**
- Backend for Frontend (BFF) pattern
- API composition
- API aggregation
- Protocol translation (REST to gRPC)
- Request/response transformation

**Production Checklist:**
- [ ] TLS/HTTPS enabled
- [ ] Authentication configured
- [ ] Rate limiting implemented
- [ ] CORS configured
- [ ] Monitoring enabled
- [ ] Logging configured
- [ ] Health checks set up
- [ ] High availability (3+ instances)
- [ ] Backup and disaster recovery
- [ ] Documentation updated
