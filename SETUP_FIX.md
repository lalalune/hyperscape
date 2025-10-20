# Hyperscape - Setup Fix for MUD Contracts

## Problem

Hyperscape was failing to start with the error:
```
sh: mud: command not found
error: Command failed: npm run build
```

**Root Cause**: MUD contract dependencies were not installed before trying to build contracts.

## Solution

Updated `scripts/start-localnet.ts` to automatically install MUD dependencies if not present:

```typescript
// Ensure MUD dependencies are installed
const nodeModulesPath = join(contractsPath, 'node_modules');
if (!existsSync(nodeModulesPath)) {
  console.log('⏳ Installing MUD dependencies...');
  await execAsync('npm install', { cwd: contractsPath });
  console.log('✅ Dependencies installed');
}
```

## What Was Fixed

1. **Path Resolution** (from previous fix):
   - Fixed relative paths to use absolute paths
   - Script now works from any directory

2. **Dependency Installation** (this fix):
   - Auto-detects if MUD dependencies are missing
   - Automatically runs `npm install` if needed
   - Proceeds to build only after dependencies are ready

## Usage

The setup is now fully automated:

```bash
cd vendor/hyperscape

# First time (installs dependencies automatically)
bun scripts/start-localnet.ts

# Or via npm script
bun run localnet

# Or as part of dev
bun run dev
```

## Expected Output

```
╔══════════════════════════════════════════════════════════════╗
║   🔧 HYPERSCAPE LOCALNET SETUP                               ║
║   Anvil + MUD Contracts + Configuration                     ║
╚══════════════════════════════════════════════════════════════╝

1️⃣  Checking Anvil...
✅ Anvil already running

2️⃣  Deploying MUD Contracts...
⏳ Installing MUD dependencies...
✅ Dependencies installed

   Building contracts...
   Deploying to localnet...
✅ Contracts deployed

3️⃣  Reading Deployment Info...
✅ World deployed
   Address: 0x...

4️⃣  Initializing World...
✅ World initialized

5️⃣  Writing Configuration...
✅ packages/server/.env.local
✅ packages/client/.env.local
✅ packages/shared/.env.local

6️⃣  Verifying Deployment...
✅ World is initialized

╔══════════════════════════════════════════════════════════════╗
║   ✅ LOCALNET READY FOR HYPERSCAPE                           ║
╚══════════════════════════════════════════════════════════════╝
```

## Manual Setup (Optional)

If you want to install dependencies manually:

```bash
cd vendor/hyperscape/contracts-mud/mmo
npm install

# Then run localnet setup
cd ../..
bun scripts/start-localnet.ts
```

## Related Fixes

1. **Path Resolution**: [PATH_FIX.md](./PATH_FIX.md)
   - Fixed relative paths in script
   - Works from any directory

2. **This Fix**: Automatic dependency installation
   - No manual setup required
   - Zero-configuration experience

## Benefits

1. **Zero Manual Setup**: Dependencies install automatically
2. **Idempotent**: Safe to run multiple times
3. **Fast Subsequent Runs**: Only installs if missing
4. **Clear Feedback**: Shows installation progress
5. **Works Everywhere**: Combined with path fix, works from any directory

## Troubleshooting

### MUD CLI Not Found

If you still see `mud: command not found`:

```bash
# Clean and reinstall
cd vendor/hyperscape/contracts-mud/mmo
rm -rf node_modules package-lock.json
npm install

# Verify mud is installed
npx mud --version
```

### Installation Fails

```bash
# Try with pnpm (MUD's preferred package manager)
cd vendor/hyperscape/contracts-mud/mmo
pnpm install

# Or use npm with legacy peer deps
npm install --legacy-peer-deps
```

### Build Errors

```bash
# Check MUD version compatibility
cd vendor/hyperscape/contracts-mud/mmo
npm list @latticexyz/cli

# Clean build artifacts
rm -rf out cache
npm run build
```

## Files Modified

- ✅ `scripts/start-localnet.ts` - Added dependency check and auto-install

## Testing

```bash
# Remove dependencies to test auto-install
cd vendor/hyperscape/contracts-mud/mmo
rm -rf node_modules

# Run localnet setup (should auto-install)
cd ../..
bun scripts/start-localnet.ts
```

Expected: Dependencies install automatically, then contracts build and deploy successfully.

---

**Hyperscape now has fully automated localnet setup with zero manual configuration!** 🎮

