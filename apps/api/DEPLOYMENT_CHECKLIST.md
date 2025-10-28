# Asset Forge API - Deployment Checklist

Use this checklist to ensure a smooth deployment to Railway.

## Pre-Deployment

### ☐ 1. Environment Preparation

- [ ] Create Railway account at https://railway.app
- [ ] Install Railway CLI: `npm install -g @railway/cli`
- [ ] Gather all API keys and credentials
- [ ] Review `.env.production.example` for required variables
- [ ] Update `FRONTEND_URL` with actual frontend domain

### ☐ 2. Code Review

- [ ] All tests passing locally
- [ ] No sensitive data in codebase
- [ ] `.gitignore` includes `.env` files
- [ ] Database migrations are up to date
- [ ] Dependencies are up to date (`npm audit`)

### ☐ 3. Database Preparation

- [ ] PostgreSQL schema is current
- [ ] Migration scripts are ready:
  - [ ] `npm run migrate:manifests`
  - [ ] `npm run seed:manifests`
- [ ] Backup any existing data (if applicable)

## Railway Deployment

### ☐ 4. Create Railway Project

**Via CLI:**
```bash
cd apps/api
railway login
railway init
```

**Via Dashboard:**
- Go to https://railway.app/dashboard
- Click "New Project"
- Select deployment method (CLI or GitHub)

### ☐ 5. Add PostgreSQL Database

**Via CLI:**
```bash
railway add --database postgresql
```

**Via Dashboard:**
- In project, click "+ New"
- Select "Database" → "PostgreSQL"
- Wait for provisioning (~30 seconds)

### ☐ 6. Enable pgvector Extension

```bash
railway run psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Or via Railway dashboard → PostgreSQL → Query tab:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### ☐ 7. Configure Environment Variables

Copy from `.env.production.example` to Railway:

**Required Variables:**
```bash
railway variables set NODE_ENV=production
railway variables set PORT=3004
railway variables set FRONTEND_URL=https://your-frontend.vercel.app
railway variables set OPENAI_API_KEY=sk-proj-...
railway variables set MESHY_API_KEY=msy_...
railway variables set ELEVENLABS_API_KEY=...
railway variables set PRIVY_APP_ID=...
railway variables set PRIVY_APP_SECRET=...
```

**Database (auto-configured):**
- `DATABASE_URL` is automatically set by Railway
- Verify in Variables tab: `${{Postgres.DATABASE_URL}}`

**Optional Variables:**
```bash
railway variables set AI_GATEWAY_API_KEY=...
railway variables set ANTHROPIC_API_KEY=...
railway variables set OPENROUTER_API_KEY=...
railway variables set IMAGE_SERVER_URL=https://your-api.railway.app
```

### ☐ 8. Deploy Application

**Via CLI:**
```bash
railway up
```

**Via GitHub:**
- Connect repository in Railway dashboard
- Select `apps/api` as root directory
- Push to main branch for auto-deploy

### ☐ 9. Run Database Migrations

After first successful deployment:

```bash
railway run npm run migrate:manifests
railway run npm run seed:manifests
```

Or via Railway dashboard → Deployments → Run Command

### ☐ 10. Verify Deployment

```bash
# Get your Railway URL
railway domain

# Test health endpoint
curl https://your-project.railway.app/api/health

# Expected response:
# {"status":"healthy","timestamp":"...","uptime":...}
```

## Post-Deployment

### ☐ 11. Test All Endpoints

- [ ] Health check: `GET /api/health`
- [ ] Material presets: `GET /api/material-presets`
- [ ] Legacy assets: `GET /api/assets`
- [ ] Database assets: `GET /api/v2/assets`
- [ ] Voice generation: `GET /api/voice/models` (with auth)
- [ ] Generation pipeline: `POST /api/generation/pipeline`

### ☐ 12. Monitor Initial Traffic

- [ ] Check Railway logs: `railway logs -f`
- [ ] Monitor database connections
- [ ] Watch for errors in Railway dashboard
- [ ] Verify memory/CPU usage is within limits

### ☐ 13. Update Frontend

Update frontend environment variables:

```env
VITE_API_URL=https://your-project.railway.app
```

Or for custom domain:
```env
VITE_API_URL=https://api.yourdomain.com
```

### ☐ 14. Configure Custom Domain (Optional)

**Railway Domain:**
- Railway provides: `your-project.railway.app`
- Or generate custom subdomain in Settings

**Custom Domain:**
1. Go to Railway → Settings → Domains
2. Click "Custom Domain"
3. Add your domain: `api.yourdomain.com`
4. Update DNS:
   ```
   CNAME api.yourdomain.com → your-project.railway.app
   ```
5. Wait for SSL certificate (automatic, ~5 minutes)
6. Update `IMAGE_SERVER_URL` environment variable

### ☐ 15. Set Up Storage (Choose One)

**Option A: Railway Volumes (Simple)**
- [ ] Add volume in Railway dashboard
- [ ] Mount at `/app/storage`
- [ ] Update file paths in code
- [ ] Redeploy

**Option B: Cloudflare R2 (Recommended)**
- [ ] Follow `docs/R2_INTEGRATION.md`
- [ ] Create R2 bucket
- [ ] Generate API tokens
- [ ] Add R2 environment variables
- [ ] Install `@aws-sdk/client-s3`
- [ ] Implement R2 client
- [ ] Test uploads
- [ ] Migrate existing assets

## Security Checklist

### ☐ 16. Security Review

- [ ] All API keys are in environment variables
- [ ] No secrets in codebase or logs
- [ ] CORS is configured correctly
- [ ] SSL/HTTPS is enabled (automatic with Railway)
- [ ] Database password is strong (Railway auto-generates)
- [ ] Rate limiting is configured (optional)
- [ ] Authentication is working (Privy)

### ☐ 17. Monitoring Setup

- [ ] Railway logs are accessible
- [ ] Set up log alerts (Railway Pro feature)
- [ ] Configure Sentry for error tracking (optional)
- [ ] Set up uptime monitoring (optional)

## Ongoing Maintenance

### ☐ 18. Regular Tasks

- [ ] Monitor Railway usage and costs
- [ ] Review logs weekly for errors
- [ ] Update dependencies monthly
- [ ] Backup database regularly
- [ ] Clean up old temp files/assets
- [ ] Review and rotate API keys quarterly

### ☐ 19. Scaling Preparation

- [ ] Monitor response times
- [ ] Watch database connection pool usage
- [ ] Track memory/CPU utilization
- [ ] Consider upgrading Railway plan if needed
- [ ] Plan for R2 migration if file storage grows

## Rollback Plan

### ☐ 20. If Deployment Fails

**Database Issues:**
```bash
# Rollback database
railway run psql $DATABASE_URL < backup.sql
```

**Code Issues:**
```bash
# Redeploy previous version
railway rollback
```

**Environment Issues:**
```bash
# Verify all variables are set
railway variables
```

## Cost Monitoring

### ☐ 21. Track Monthly Costs

**Railway:**
- [ ] Review usage in Dashboard → Usage
- [ ] Set billing alerts
- [ ] Monitor resource allocation

**Cloudflare R2 (if using):**
- [ ] Track storage GB
- [ ] Monitor request counts
- [ ] Review bandwidth usage

**Estimated Monthly:**
- Railway: $20-50
- R2 Storage: $0-15
- **Total: $20-65/month**

## Success Criteria

Deployment is successful when:

✅ Health endpoint returns 200 OK
✅ All environment variables are set
✅ Database connection is stable
✅ pgvector extension is enabled
✅ Migrations have run successfully
✅ Frontend can connect to API
✅ Authentication is working
✅ Static files are being served
✅ No errors in Railway logs
✅ Response times are acceptable (<500ms)

## Troubleshooting

### Common Issues

**Build Fails:**
- Check `railway.json` configuration
- Verify all dependencies are in `package.json`
- Review build logs for errors

**Database Connection Fails:**
- Verify PostgreSQL is running in Railway
- Check `DATABASE_URL` is set
- Ensure pgvector extension is enabled

**Environment Variables Missing:**
- List all variables: `railway variables`
- Compare with `.env.production.example`
- Add missing variables via CLI or dashboard

**Out of Memory:**
- Reduce connection pool size
- Upgrade Railway plan
- Optimize queries

## Support Resources

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Hono Docs:** https://hono.dev
- **PostgreSQL Docs:** https://www.postgresql.org/docs/

---

## Deployment Completed! 🎉

Date: _______________
Deployed by: _______________
Railway URL: _______________
Custom Domain: _______________
Frontend URL: _______________

**Notes:**
_______________________________________
_______________________________________
_______________________________________
