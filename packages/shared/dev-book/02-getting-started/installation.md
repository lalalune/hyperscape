# Installation Guide

[← Back to Index](../README.md)

---

## Prerequisites

Before installing Hyperscape Shared, ensure you have:

- **Node.js** 18.0+ or **Bun** 1.0+
- **npm** or **yarn** or **pnpm**
- **TypeScript** 5.3+ (for development)
- Modern browser with WebGL 2.0+ support

---

## Installation Methods

### Method 1: NPM/Yarn/PNPM

```bash
# NPM
npm install @hyperscape/shared three

# Yarn
yarn add @hyperscape/shared three

# PNPM
pnpm add @hyperscape/shared three
```

### Method 2: Bun

```bash
bun add @hyperscape/shared three
```

### Method 3: From Source (Development)

```bash
# Clone the repository
git clone https://github.com/HyperscapeAI/hyperscape.git
cd hyperscape

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
import { createClientWorld } from '@hyperscape/shared';

console.log('Hyperscape Shared installed successfully!');
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
