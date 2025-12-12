# Asset Forge Developer & User Guide

> **Complete documentation for the Asset Forge AI-powered 3D asset generation system**

Welcome to the comprehensive documentation for Asset Forge! This guide covers everything from getting started to advanced development topics.

---

## 📖 Quick Navigation

### 🚀 Getting Started
Perfect for new users and developers:
- [Installation Guide](02-getting-started/installation.md) - Set up your development environment
- [Configuration](02-getting-started/configuration.md) - Environment variables and settings
- [Quick Start](02-getting-started/quick-start.md) - Generate your first asset in minutes
- [Troubleshooting](02-getting-started/troubleshooting.md) - Common issues and solutions

### 👤 User Guides
Learn how to use each feature:
- [Asset Generation](03-user-guides/asset-generation.md) - Create 3D assets from text
- [Material Variants](03-user-guides/material-variants.md) - Generate bronze, steel, mithril variants
- [Hand Rigging](03-user-guides/hand-rigging.md) - Rig weapons to hands
- [Armor Fitting](03-user-guides/armor-fitting.md) - Fit armor to characters
- [Equipment System](03-user-guides/equipment-system.md) - Manage equipment sets
- [Sprite Generation](03-user-guides/sprite-generation.md) - Create 2D sprites from 3D models

### 🏗️ Architecture
Understand the system design:
- [System Overview](04-architecture/system-overview.md) - High-level architecture
- [Frontend Architecture](04-architecture/frontend-architecture.md) - React/Three.js structure
- [Backend Architecture](04-architecture/backend-architecture.md) - Express/Node.js design
- [State Management](04-architecture/state-management.md) - Zustand stores explained
- [Data Flow](04-architecture/data-flow.md) - Request/response patterns

### ⚛️ Frontend Development
Dive into the React/Three.js codebase:
- [Components Overview](05-frontend/components-overview.md) - All 77 components
- [Pages](05-frontend/pages.md) - Page structure and routing
- [Stores](05-frontend/stores.md) - Zustand state management
- [Hooks](05-frontend/hooks.md) - Custom React hooks
- [Three.js Integration](05-frontend/three-js-integration.md) - 3D rendering

### 🔧 Backend Development
Explore the server-side architecture:
- [API Reference](06-backend/api-reference.md) - All REST endpoints
- [Services](06-backend/services.md) - Business logic layer
- [AI Integrations](06-backend/ai-integrations.md) - OpenAI & Meshy.ai
- [File System](06-backend/file-system.md) - Asset storage

### 🤖 AI Pipeline
Understand the generation pipeline:
- [Generation Pipeline](07-ai-pipeline/generation-pipeline.md) - Complete workflow
- [Prompt Engineering](07-ai-pipeline/prompt-engineering.md) - AI prompts
- [Image Generation](07-ai-pipeline/image-generation.md) - OpenAI DALL-E
- [3D Conversion](07-ai-pipeline/3d-conversion.md) - Meshy.ai integration
- [Retexturing](07-ai-pipeline/retexturing.md) - Material variants
- [Rigging](07-ai-pipeline/rigging.md) - Character rigging

### 🎯 Features Deep Dive
Advanced feature documentation:
- [Asset Normalization](08-features/asset-normalization.md) - Model standardization
- [Hand Rigging Deep Dive](08-features/hand-rigging-deep-dive.md) - MediaPipe/TensorFlow
- [Armor Fitting Deep Dive](08-features/armor-fitting-deep-dive.md) - Mesh deformation
- [Sprite System](08-features/sprite-system.md) - 2D sprite generation
- [Animation System](08-features/animation-system.md) - Animation handling

### 📘 Type System
TypeScript types and interfaces:
- [Types Overview](09-type-system/types-overview.md) - All type definitions
- [Asset Types](09-type-system/asset-types.md) - Asset metadata
- [Generation Types](09-type-system/generation-types.md) - Pipeline types
- [Three.js Types](09-type-system/three-js-types.md) - 3D types

### ⚙️ Configuration
Settings and configuration:
- [Environment Variables](10-configuration/environment-variables.md) - All env vars
- [Constants](10-configuration/constants.md) - App constants
- [Material Presets](10-configuration/material-presets.md) - Material system
- [Prompts](10-configuration/prompts.md) - AI prompt templates

### 💻 Development
Build new features:
- [Setup Guide](11-development/setup-guide.md) - Dev environment
- [Code Standards](11-development/code-standards.md) - Coding conventions
- [Adding Features](11-development/adding-features.md) - Feature development
- [Adding Asset Types](11-development/adding-asset-types.md) - Extend types
- [Debugging](11-development/debugging.md) - Debug techniques

### 📚 API Reference
Complete API documentation:
- [REST API](12-api-reference/rest-api.md) - All HTTP endpoints
- [Frontend API](12-api-reference/frontend-api.md) - Service layer
- [Utility Functions](12-api-reference/utility-functions.md) - Helpers

### 🧪 Testing
Testing strategies:
- [Testing Strategy](13-testing/testing-strategy.md) - Approach
- [Visual Testing](13-testing/visual-testing.md) - 3D testing
- [Debugging Tools](13-testing/debugging-tools.md) - DevTools

### 🚀 Deployment
Production deployment:
- [Build Process](14-deployment/build-process.md) - Production builds
- [Environment Setup](14-deployment/environment-setup.md) - Server setup
- [Monitoring](14-deployment/monitoring.md) - Performance tracking

### 📎 Appendix
Additional resources:
- [Glossary](15-appendix/glossary.md) - Terms and concepts
- [FAQ](15-appendix/faq.md) - Common questions
- [Resources](15-appendix/resources.md) - External resources
- [Changelog](15-appendix/changelog.md) - Version history

---

## 📊 Overview

### What is Asset Forge?

Asset Forge is a comprehensive AI-powered 3D asset generation and management system built for the Hyperscape RPG project. It combines multiple AI services to create a complete text-to-3D pipeline with advanced features like automatic rigging, armor fitting, hand rigging for weapons, and material variant generation.

### Key Features

- **🎨 Text-to-3D Generation**: Create 3D game assets from text descriptions
- **🔄 Material Variants**: Automatically generate bronze, steel, mithril, and custom variants
- **🦴 Character Rigging**: Auto-rig characters with animations (walking, running)
- **🛡️ Armor Fitting**: Fit armor pieces to character models
- **🤲 Hand Rigging**: Rig weapons to hand poses using AI-powered grip detection
- **🖼️ Sprite Generation**: Generate 2D sprites from 3D models
- **📚 Asset Library**: Comprehensive asset management with metadata

### Technology Stack

- **Frontend**: React 19.2, TypeScript 5.3, Three.js 0.178, Zustand 5.0, Tailwind CSS 3.3
- **Backend**: Node.js 18+, Express.js 4.18, Bun runtime
- **AI Services**: OpenAI GPT-4/DALL-E, Meshy.ai, MediaPipe Hands
- **Build Tools**: Vite 6.0, TypeScript Compiler, ESLint

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                   │
│  ┌────────────┐  ┌────────────┐  ┌───────────────┐ │
│  │   Pages    │  │ Components │  │  State Store  │ │
│  │  (Views)   │  │  (UI/UX)   │  │   (Zustand)   │ │
│  └────────────┘  └────────────┘  └───────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP/REST API
┌──────────────────────┴──────────────────────────────┐
│               Backend (Express.js)                   │
│  ┌────────────┐  ┌────────────┐  ┌───────────────┐ │
│  │   Routes   │  │  Services  │  │  Middleware   │ │
│  └────────────┘  └────────────┘  └───────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │ AI Services
┌──────────────────────┴──────────────────────────────┐
│  OpenAI GPT-4 │ DALL-E │ Meshy.ai │ MediaPipe      │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 Quick Start

### Prerequisites

- Node.js 18+ or Bun runtime
- OpenAI API key
- Meshy.ai API key

### Installation

```bash
# Navigate to asset-forge
cd packages/asset-forge

# Install dependencies
npm install  # or: bun install

# Configure environment
cp env.example .env
# Edit .env with your API keys
```

### Run Development Server

```bash
# Start both frontend and backend
npm run dev

# Or run separately:
npm run dev:frontend  # Port 3003
npm run dev:backend   # Port 3004 + 8081
```

Visit [http://localhost:3003](http://localhost:3003) to access Asset Forge.

### Generate Your First Asset

1. Click **Generate** in the navigation
2. Choose **Items** or **Avatars**
3. Fill in asset details (name, type, description)
4. Select quality level and options
5. Click **Start Generation**
6. Watch the pipeline progress
7. View your generated asset in the **Assets** tab

---

## 📈 Documentation Stats

- **Total Pages**: 60+ markdown files
- **Code Examples**: 200+ examples
- **Components Documented**: 77
- **Services Documented**: 17
- **Stores Documented**: 5
- **API Endpoints**: 25+
- **Type Definitions**: 200+

---

## 🤝 Contributing

See [Development Guide](11-development/setup-guide.md) for contributing guidelines.

---

## 📝 License

Part of the Hyperscape project.

---

## 🔗 Related Documentation

- [Hyperscape Main README](../../../README.md)
- [Hyperscape Package Docs](../../hyperscape/README.md)
- [Plugin Hyperscape Docs](../../plugin-hyperscape/README.md)

---

**Last Updated**: 2025-10-21
**Version**: 1.0.0
