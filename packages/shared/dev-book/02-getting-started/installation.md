# Installation Guide

[← Back to Index](../README.md)

---

## Prerequisites

Before installing Hyperia Shared, ensure you have:

- **Node.js** 18.0+ or **Bun** 1.0+
- **npm** or **yarn** or **pnpm**
- **TypeScript** 5.3+ (for development)
- Modern browser with WebGPU support (Chrome 113+, Safari 17+)

---

## Installation Methods

### Method 1: NPM/Yarn/PNPM

```bash
# NPM
npm install @hyperforge/shared three

# Yarn
yarn add @hyperforge/shared three

# PNPM
pnpm add @hyperforge/shared three
```

### Method 2: Bun

```bash
bun add @hyperforge/shared three
```

### Method 3: From Source (Development)

```bash
# Clone the repository
git clone https://github.com/PlayHyperia/hyperia.git
cd hyperia

# Install dependencies
npm install

# Build shared package
cd packages/shared
npm run build
```

---

## Verify Installation

Create a test file to verify installation:

```typescript
import { createClientWorld } from '@hyperforge/shared';

console.log('Hyperia Shared installed successfully!');
```

Run with:

```bash
npx tsx test.ts  # TypeScript
# or
node test.js     # JavaScript
```

---

## Development Dependencies

For development, install additional tools:

```bash
npm install -D typescript vite @types/three
```

---

[← Back to Index](../README.md) | [Next: Configuration →](configuration.md)
