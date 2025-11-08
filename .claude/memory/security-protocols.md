# Security Protocols

## Authentication
- Use Privy for all authentication (no custom auth)
- JWT tokens verified server-side only
- Never trust client-provided auth data
- Implement token expiration checks

## API Security
- Rate limiting on all public endpoints
- Input validation with TypeBox schemas
- SQL injection prevention via Drizzle ORM
- CORS configured for specific origins only

## Secrets Management
- Store all secrets in `.env` file (never commit)
- Use `process.env` to access secrets
- Rotate API keys quarterly
- Never log sensitive data (passwords, tokens, API keys)

## File Uploads
- Validate file types and sizes
- Scan uploads for malware (if applicable)
- Use signed URLs for S3/storage uploads
- Implement virus scanning for user uploads

## Security Headers
Required headers (configured in Elysia):
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HTTPS only)

## Known Security Issues
See `SECURITY_AUDIT.md` for current vulnerabilities and remediation plan.
