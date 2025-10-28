# Railway Deployment Diagnostic Report

## Configuration Files

### apps/api/railway.json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "nixpacksConfigPath": "nixpacks.toml"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300
  }
}

### apps/api/nixpacks.toml
[phases.setup]
nixPkgs = ['nodejs-18_x']

[phases.install]
cmds = ['npm install -g bun', 'bun install']

[phases.build]
cmds = [
  'node server/scripts/migrate-manifests-to-postgres.mjs || true'
]

[start]
cmd = 'bun run start'


### apps/api/package.json (scripts only)
{
  "dev": "node server/api.mjs",
  "start": "node server/api.mjs",
  "build:services": "node scripts/build-services.mjs",
  "assets:audit": "npx tsx scripts/audit-assets.ts",
  "assets:normalize": "npx tsx scripts/normalize-all-assets.ts",
  "count:lines": "node scripts/count-lines.mjs",
  "migrate:manifests": "node server/scripts/migrate-manifests-to-postgres.mjs",
  "seed:manifests": "node server/scripts/seed-preview-manifests.mjs",
  "test:setup": "node scripts/test-db-setup.mjs",
  "test": "npm run test:setup && node --test server/routes/__tests__/*.test.mjs",
  "test:crypto": "npm run test:setup && node --test server/routes/__tests__/users-api-keys.test.mjs",
  "test:auth-flow": "npm run test:setup && node --test server/routes/__tests__/auth-flow-integration.test.mjs",
  "typecheck": "tsc --noEmit"
}
