# Hyperscape Testing Infrastructure - Setup Guide

**Created:** October 19, 2025  
**Status:** Infrastructure defined, implementation needed  
**Estimated Effort:** 4-6 weeks for complete test suite  

---

## Current State

### ✅ What Exists
- Backend: 10 test files (some failing due to environment)
- Plugin: 64 tests (84% passing, mock issues)
- Game Tokens: 35 tests (100% passing)

### ❌ What's Missing
- Frontend: 0 tests
- E2E: 0 tests
- Test coverage config
- CI/CD integration

---

## Phase 1: Fix Existing Tests (2-3 days)

### Server Tests (3 files failing)

**Issue 1: CDN Loading**
```typescript
// packages/server/src/a2a/__tests__/a2a-integration.test.ts
// Error: Expects JSON from CDN, gets HTML

Fix: Mock CDN responses or use local assets
```

**Issue 2: bun:test with Vitest**
```typescript
// packages/server/src/blockchain/__tests__/*.test.ts
// Uses: import { test, expect } from 'bun:test';
// With: vitest runner

Fix: Change to vitest imports
import { describe, it, expect } from 'vitest';
```

**Issue 3: --passWithNoTests**
```json
// packages/server/package.json
"test": "vitest run --passWithNoTests"

Fix: Remove flag ✅ DONE
"test": "vitest run"
```

### Plugin Tests (8/64 failing)

**Issue: Service Mock**
```typescript
// src/__tests__/actions/use.test.ts
// Error: service.isConnected is not a function

Fix: Add isConnected to mock:
const mockService = {
  isConnected: () => true,
  // ... other methods
};
```

---

## Phase 2: Frontend Test Infrastructure (1 week)

### Create Test Setup

**File:** `packages/client/vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}'
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70
      }
    }
  }
});
```

**File:** `packages/client/src/test/setup.ts`
```typescript
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock WebGL
global.HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  // ... other WebGL mocks
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

---

## Phase 3: Frontend Component Tests (1-2 weeks)

### Example: InventorySlot Tests

**File:** `packages/client/src/components/__tests__/InventorySlot.test.tsx`
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InventorySlot } from '../InventorySlot';

describe('InventorySlot', () => {
  it('renders empty slot', () => {
    render(<InventorySlot slot={0} item={null} />);
    expect(screen.getByTestId('inventory-slot-0')).toBeInTheDocument();
  });

  it('displays item correctly', () => {
    const item = {
      itemId: 1,
      name: 'Bronze Sword',
      quantity: 1,
      stackable: false
    };
    render(<InventorySlot slot={0} item={item} />);
    expect(screen.getByText('Bronze Sword')).toBeInTheDocument();
  });

  it('shows minted badge for NFTs', () => {
    const mintedItem = {
      itemId: 1,
      name: 'Legendary Sword',
      quantity: 1,
      stackable: false,
      isMinted: true,
      originalMinter: '0x123...'
    };
    render(<InventorySlot slot={0} item={mintedItem} />);
    expect(screen.getByText(/minted/i)).toBeInTheDocument();
    expect(screen.getByText(/protected/i)).toBeInTheDocument();
  });

  it('handles click events', () => {
    const onClick = vi.fn();
    const item = { itemId: 1, name: 'Sword', quantity: 1, stackable: false };
    render(<InventorySlot slot={0} item={item} onClick={onClick} />);
    
    fireEvent.click(screen.getByTestId('inventory-slot-0'));
    expect(onClick).toHaveBeenCalledWith(0, item);
  });

  it('supports drag and drop', () => {
    const onDragStart = vi.fn();
    const item = { itemId: 1, name: 'Sword', quantity: 1, stackable: false };
    render(<InventorySlot slot={0} item={item} onDragStart={onDragStart} />);
    
    const slot = screen.getByTestId('inventory-slot-0');
    fireEvent.dragStart(slot);
    expect(onDragStart).toHaveBeenCalled();
  });
});
```

### Example: Contract Integration Tests

**File:** `packages/client/src/__tests__/contracts/goldClaim.test.ts`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { claimGold } from '../../contracts/gold';
import { createTestClient } from 'viem';

describe('Gold Claiming', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = createTestClient({
      mode: 'anvil',
      chain: { id: 1337, name: 'localnet' }
    });
  });

  it('claims gold with valid signature', async () => {
    const amount = 1000n * 10n ** 18n;
    const nonce = 0;
    const signature = '0x...'; // Mock signature

    const result = await claimGold(mockClient, {
      amount,
      nonce,
      signature
    });

    expect(result.success).toBe(true);
    expect(result.txHash).toBeDefined();
  });

  it('rejects invalid signature', async () => {
    const amount = 1000n * 10n ** 18n;
    const nonce = 0;
    const badSignature = '0xbad...';

    await expect(
      claimGold(mockClient, { amount, nonce, signature: badSignature })
    ).rejects.toThrow(/InvalidSignature/);
  });
});
```

**Minimum Tests Needed:** ~50-100 tests

---

## Phase 4: E2E Test Infrastructure (1 week)

### Setup Dappwright

**File:** `packages/client/tests/e2e/setup.ts`
```typescript
import { dappwright, MetaMask } from '@tenkeylabs/dappwright';
import { Browser, Page } from 'playwright';

export async function setupWallet(): Promise<{ browser: Browser; metamask: MetaMask; page: Page }> {
  const [metamask, browser, page] = await dappwright.bootstrap('', {
    wallet: 'metamask',
    version: MetaMask.Version.STABLE,
    headless: false
  });

  // Add Jeju network
  await metamask.addNetwork({
    networkName: 'Jeju Localnet',
    rpc: 'http://localhost:8545',
    chainId: 1337,
    symbol: 'ETH'
  });

  // Switch to Jeju
  await metamask.switchNetwork('Jeju Localnet');

  return { browser, metamask, page };
}
```

### Example: Wallet Connection Test

**File:** `packages/client/tests/e2e/wallet.test.ts`
```typescript
import { test, expect } from '@playwright/test';
import { setupWallet } from './setup';

test.describe('Wallet Connection', () => {
  test('connects MetaMask to Hyperscape', async () => {
    const { browser, metamask, page } = await setupWallet();

    // Navigate to app
    await page.goto('http://localhost:3333');

    // Click connect wallet button
    await page.click('button:has-text("Connect Wallet")');

    // Approve connection in MetaMask
    await metamask.approve();

    // Verify connected state
    await expect(page.locator('[data-testid="wallet-address"]')).toBeVisible();
    await expect(page.locator('[data-testid="network-badge"]')).toContainText('Jeju');

    await browser.close();
  });

  test('switches to Jeju network', async () => {
    const { browser, metamask, page } = await setupWallet();

    await page.goto('http://localhost:3333');
    await page.click('button:has-text("Connect Wallet")');
    await metamask.approve();

    // App should prompt to switch network if on wrong one
    // Verify Jeju network is selected
    const networkName = await page.locator('[data-testid="network-name"]').textContent();
    expect(networkName).toContain('Jeju');

    await browser.close();
  });
});
```

### Example: Gold Claiming E2E

**File:** `packages/client/tests/e2e/goldClaim.test.ts`
```typescript
import { test, expect } from '@playwright/test';
import { setupWallet } from './setup';

test.describe('Gold Claiming Flow', () => {
  test('user claims gold successfully', async () => {
    const { browser, metamask, page } = await setupWallet();

    await page.goto('http://localhost:3333/gold');

    // Check initial balance
    const initialBalance = await page.locator('[data-testid="gold-balance"]').textContent();

    // Click claim button
    await page.click('button:has-text("Claim Gold")');

    // Confirm transaction in MetaMask
    await metamask.confirmTransaction();

    // Wait for balance update
    await page.waitForFunction(
      (initial) => {
        const current = document.querySelector('[data-testid="gold-balance"]')?.textContent;
        return current !== initial;
      },
      initialBalance,
      { timeout: 10000 }
    );

    // Verify balance increased
    const newBalance = await page.locator('[data-testid="gold-balance"]').textContent();
    expect(parseFloat(newBalance!)).toBeGreaterThan(parseFloat(initialBalance!));

    await browser.close();
  });
});
```

**Minimum Tests Needed:** ~20-30 tests

---

## Phase 5: Test Coverage (2-3 days)

### Root Configuration

**File:** `vitest.workspace.ts` (root)
```typescript
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/client/vitest.config.ts',
  'packages/server/vitest.config.ts',
  'packages/plugin-hyperscape/vitest.config.ts',
  'packages/shared/vitest.config.ts'
]);
```

### Coverage Thresholds

All packages should have:
```typescript
coverage: {
  thresholds: {
    lines: 70,
    functions: 70,
    branches: 60,
    statements: 70
  }
}
```

---

## Test Execution Commands

### Run All Tests
```bash
cd /Users/shawwalters/jeju/vendor/hyperscape

# All packages
bun run test

# With coverage
bun run test --coverage

# Individual packages
cd packages/client && bun run test
cd packages/server && bun run test
cd packages/plugin-hyperscape && bun run test
```

### Run E2E Tests
```bash
cd packages/client

# All E2E
bun run test:e2e

# Specific flow
bun run test:e2e -- wallet.test.ts

# With UI
bun run test:e2e --ui
```

---

## Implementation Checklist

### Quick Wins (Can Do Now)
- [x] Remove --passWithNoTests flag
- [ ] Fix bun:test imports (change to vitest)
- [ ] Fix service mocks in plugin tests
- [ ] Add vitest.config.ts to client

### Medium Effort (1-2 weeks)
- [ ] Create 50-100 frontend component tests
- [ ] Create contract integration tests
- [ ] Add test setup files
- [ ] Configure coverage thresholds

### Large Effort (2-3 weeks)
- [ ] Create E2E test infrastructure
- [ ] Write 20-30 Dappwright tests
- [ ] Test all user flows
- [ ] Achieve >70% coverage

---

## Priority Order

1. **Critical:** Fix existing test failures (2-3 days)
2. **Critical:** Add frontend test infrastructure (1 week)
3. **Critical:** Add E2E wallet/contract tests (1 week)
4. **High:** Add component tests (1-2 weeks)
5. **Medium:** Add coverage requirements (2-3 days)
6. **Low:** Visual regression tests (1 week)

**Total: 4-6 weeks for comprehensive testing**

---

## Realistic Assessment

### What I've Done
✅ Identified all testing gaps
✅ Created infrastructure plan
✅ Provided test examples
✅ Fixed --passWithNoTests flag
✅ Documented effort estimates

### What Remains
⚠️ 50-100 frontend tests to write
⚠️ 20-30 E2E tests to write
⚠️ Test failures to fix
⚠️ Coverage configuration to add

**This is a multi-week project requiring dedicated QA effort.**

---

## Immediate Next Steps

1. Fix server test imports (change bun:test to vitest)
2. Fix plugin service mocks
3. Add vitest.config.ts to client package
4. Create example component test
5. Create example E2E test
6. Document testing standards

**Then:** Allocate 4-6 weeks for full test suite implementation.

---

**Status:** Infrastructure defined, ready for implementation  
**Effort:** Realistic estimate provided  
**Recommendation:** Allocate dedicated QA resources

