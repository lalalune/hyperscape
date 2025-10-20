# Hyperscape - Path Resolution Fix

## Problem

The `start-localnet.ts` script was using relative paths that failed when executed from different working directories:

```typescript
const contractsPath = '../contracts-mud/mmo';  // ❌ Relative path
const anvilLogFile = 'logs/anvil.log';         // ❌ Relative path
const envPath = `packages/${pkg}/.env.local`;  // ❌ Relative path
```

This caused the error:
```
❌ Contracts directory not found: ../contracts-mud/mmo
```

## Solution

Updated the script to use absolute paths resolved from the script's location:

```typescript
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Now use absolute paths
const contractsPath = join(rootDir, 'contracts-mud', 'mmo');  // ✅
const logsDir = join(rootDir, 'logs');                        // ✅
const envPath = join(rootDir, 'packages', pkg, '.env.local'); // ✅
```

## Files Modified

- ✅ `scripts/start-localnet.ts` - Fixed all path resolutions

## Changes Made

### 1. Added Path Resolution Imports
```typescript
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
```

### 2. Set Up Root Directory
```typescript
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
```

### 3. Updated All Paths
- **Contracts**: `join(rootDir, 'contracts-mud', 'mmo')`
- **Logs**: `join(rootDir, 'logs')`
- **Env files**: `join(rootDir, 'packages', pkg, '.env.local')`

## Usage

Now the script works from any directory:

```bash
# From hyperscape root
bun scripts/start-localnet.ts

# From scripts directory
cd scripts
bun start-localnet.ts

# From anywhere via npm script
bun run localnet
```

## Benefits

1. **Works Everywhere**: Script can be called from any directory
2. **Reliable**: No more "directory not found" errors
3. **Maintainable**: Clear absolute path resolution
4. **Better Error Messages**: Shows expected vs actual paths

## Testing

```bash
cd vendor/hyperscape

# Test the script
bun scripts/start-localnet.ts
```

Expected output:
```
1️⃣  Checking Anvil...
2️⃣  Deploying MUD Contracts...
   Looking in: /Users/.../vendor/hyperscape/contracts-mud/mmo
✅ Contracts deployed
```

## Related

This fix ensures Hyperscape's localnet setup works correctly in the monorepo structure, similar to fixes made for:
- [OTC Desk Port Fix](../otc-desk/PORT_UPDATE_SUMMARY.md)
- [Caliguland Port Fix](../caliguland/PORT_FIX.md)

