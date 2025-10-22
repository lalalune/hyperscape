# Security Policy

## Overview

Asset Forge integrates with multiple third-party AI services that require API keys for authentication. This document outlines security best practices for managing sensitive credentials and what to do if API keys are exposed.

## API Keys Used by Asset Forge

Asset Forge requires the following API keys:

1. **OpenAI API Key** - For GPT-4 text generation and DALL-E image generation
2. **Meshy API Key** - For 3D model generation
3. **ElevenLabs API Key** - For AI voice generation (optional)
4. **OpenRouter API Key** - Alternative provider for AI dialogue generation (optional)

## Best Practices for API Key Management

### 1. Environment Variables

Always store API keys in environment variables, never in source code:

```bash
# Create .env file from template
cp .env.example .env

# Edit .env with your actual keys
# Never commit .env to version control
```

### 2. .gitignore Configuration

Ensure your `.gitignore` file includes:

```
.env
.env.local
.env.production
*.env
```

### 3. Access Control

- Store API keys in a secure password manager
- Share keys only through secure channels (never via email or chat)
- Use separate keys for development and production
- Implement key rotation policies (rotate keys every 90 days minimum)

### 4. Principle of Least Privilege

- Use API keys with the minimum required permissions
- Set up usage limits and billing alerts for each API provider
- Monitor API usage regularly for unusual activity

## What to Do If API Keys Are Exposed

If you discover that API keys have been committed to version control or otherwise exposed, take immediate action:

### Immediate Actions (Complete within 1 hour)

1. **Rotate All Exposed Keys Immediately**

   Visit each provider's dashboard and generate new API keys:

   - **OpenAI**: https://platform.openai.com/api-keys
     - Navigate to API Keys
     - Click "Create new secret key"
     - Delete the old key immediately

   - **Meshy**: https://app.meshy.ai/settings
     - Go to Settings > API Keys
     - Generate new API key
     - Revoke the old key

   - **ElevenLabs**: https://elevenlabs.io/app/settings/api-keys
     - Navigate to Profile > API Keys
     - Create new API key
     - Delete the exposed key

   - **OpenRouter**: https://openrouter.ai/keys
     - Go to Keys section
     - Create new API key
     - Delete the compromised key

2. **Update Environment Variables**

   Update your `.env` file with the new API keys:

   ```bash
   # Update .env with new keys
   nano .env  # or use your preferred editor

   # Verify the new keys work
   bun run dev:all
   ```

3. **Notify Your Team**

   If working in a team environment, notify all team members to:
   - Pull the latest changes
   - Update their local `.env` files with new keys
   - Never use the old keys

### Within 24 Hours

4. **Check for Unauthorized Usage**

   Review usage logs for each API provider:

   - **OpenAI**: https://platform.openai.com/usage
   - **Meshy**: Check your dashboard for usage history
   - **ElevenLabs**: Review usage in your account dashboard
   - **OpenRouter**: Check usage statistics

   Look for:
   - Unusual spikes in usage
   - Requests from unknown IP addresses
   - Unexpected API calls or patterns

5. **Clean Git History** (If Committed to Repository)

   If keys were committed to git, they exist in the repository history:

   ```bash
   # WARNING: This rewrites history. Coordinate with your team!

   # Use git-filter-repo (recommended) or BFG Repo-Cleaner
   # Install git-filter-repo
   pip install git-filter-repo

   # Remove .env file from history
   git filter-repo --path .env --invert-paths

   # Force push to remote (requires coordination with team)
   git push origin --force --all
   git push origin --force --tags
   ```

   **Important**:
   - This rewrites git history and requires team coordination
   - All team members must re-clone the repository
   - Any forks must also be updated
   - Consider creating a new repository if the exposure was severe

6. **Scan for Exposed Secrets**

   Use automated tools to check for other potential exposures:

   ```bash
   # Install gitleaks
   brew install gitleaks  # macOS

   # Scan repository
   gitleaks detect --source . --verbose

   # Scan specific file history
   gitleaks detect --source . --log-opts="--all -- .env"
   ```

### Within 1 Week

7. **Implement Prevention Measures**

   - Set up pre-commit hooks to prevent accidental commits:

     ```bash
     # Install pre-commit framework
     pip install pre-commit

     # Create .pre-commit-config.yaml
     cat > .pre-commit-config.yaml << EOF
     repos:
       - repo: https://github.com/gitleaks/gitleaks
         rev: v8.18.0
         hooks:
           - id: gitleaks
     EOF

     # Install the git hook scripts
     pre-commit install
     ```

   - Enable secret scanning on GitHub (if using GitHub):
     - Go to repository Settings > Security > Code security and analysis
     - Enable "Secret scanning"

   - Set up billing alerts for all API providers

   - Document the incident and lessons learned

## Checking Git History for Secrets

To check if sensitive data exists in your git history:

### Quick Check

```bash
# Search for potential API keys in git history
git log -p | grep -i "api[_-]key\|secret\|password" | head -20

# Search for specific patterns
git log -p -- .env

# Check specific file history
git log --all --full-history -- .env
```

### Comprehensive Scan

```bash
# Using gitleaks (recommended)
gitleaks detect --source . --verbose --report-path gitleaks-report.json

# Using truffleHog
docker run --rm -v "$PWD:/pwd" trufflesecurity/trufflehog:latest github --repo file:///pwd

# Using git-secrets
git secrets --scan-history
```

## Environment Variable Setup

### Development Environment

1. **Copy the example file**:
   ```bash
   cp .env.example .env
   ```

2. **Edit .env with your actual keys**:
   ```bash
   # Required keys
   VITE_OPENAI_API_KEY=sk-...
   VITE_MESHY_API_KEY=msy_...
   OPENAI_API_KEY=sk-...
   MESHY_API_KEY=msy_...

   # Optional keys
   ELEVENLABS_API_KEY=...
   OPENROUTER_API_KEY=...
   ```

3. **Verify .env is in .gitignore**:
   ```bash
   grep "\.env" .gitignore
   ```

### Production Environment

For production deployments:

1. **Use environment variable management services**:
   - Vercel: Use Environment Variables in project settings
   - Netlify: Use Environment Variables in site settings
   - Docker: Use secrets management
   - Kubernetes: Use Secrets objects

2. **Never commit production keys** to version control

3. **Use different keys** for development and production

4. **Implement key rotation** on a regular schedule

## Security Checklist

Before deploying or committing code, verify:

- [ ] No API keys in source code
- [ ] `.env` file is in `.gitignore`
- [ ] `.env.example` contains no real keys
- [ ] All team members use separate API keys
- [ ] API usage limits are configured
- [ ] Billing alerts are enabled
- [ ] Git history has been scanned for secrets
- [ ] Pre-commit hooks are installed (optional but recommended)
- [ ] Production uses separate keys from development
- [ ] Keys are stored in secure password manager

## Monitoring and Alerts

### Set Up Usage Alerts

Configure spending alerts for each API provider:

- **OpenAI**: Set up usage limits at https://platform.openai.com/account/limits
- **Meshy**: Monitor usage in dashboard
- **ElevenLabs**: Set up notifications for usage thresholds
- **OpenRouter**: Configure billing alerts

### Regular Security Audits

Perform monthly security audits:

1. Review API usage logs
2. Rotate API keys (quarterly minimum)
3. Scan git history for secrets
4. Verify .gitignore is working correctly
5. Update team on security best practices

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public GitHub issue
2. Contact the project maintainers privately
3. Provide detailed information about the vulnerability
4. Allow time for the issue to be addressed before public disclosure

## Additional Resources

- [OpenAI API Best Practices](https://platform.openai.com/docs/guides/safety-best-practices)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [Git-secrets Documentation](https://github.com/awslabs/git-secrets)
- [Gitleaks Documentation](https://github.com/gitleaks/gitleaks)

## Contact

For security-related questions or to report vulnerabilities, contact the project maintainers.

---

**Remember**: Security is everyone's responsibility. When in doubt, ask for help rather than risk exposing credentials.
