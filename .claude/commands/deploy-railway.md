# Deploy to Railway

Deploy the current project to Railway with proper configuration, environment variable setup, and deployment verification.

## Tasks

1. **Verify Railway Setup**
   - Check if Railway CLI is installed
   - Verify authentication status
   - Confirm project is linked

2. **Pre-Deployment Checks**
   - Review environment variables configuration
   - Verify railway.json configuration (if exists)
   - Check for uncommitted changes (warn user)
   - Validate build configuration

3. **Deploy Application**
   - Determine target environment (production, staging, development)
   - Deploy using `railway up`
   - Show deployment progress

4. **Post-Deployment Verification**
   - Monitor deployment logs
   - Verify service health
   - Display deployment URL
   - Check for any deployment errors

5. **Summary**
   - Show deployment status
   - Provide access URLs
   - Suggest next steps (migrations, monitoring, etc.)

## Expected Output

- Railway deployment status
- Service URL and health check
- Any warnings or errors encountered
- Suggestions for post-deployment actions (e.g., run migrations, seed database)
