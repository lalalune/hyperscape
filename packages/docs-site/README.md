# Hyperscape Documentation Site

This directory contains the Docusaurus-based documentation site for Hyperscape, which automatically generates API documentation from TypeScript source code using TypeDoc.

## Overview

The documentation is built using:
- **TypeDoc** - Extracts API documentation from TypeScript source code and JSDoc comments
- **typedoc-plugin-markdown** - Converts TypeDoc output to Markdown format
- **Docusaurus** - Creates a beautiful, searchable documentation website

## Documentation Structure

The documentation covers three main packages:
- **Shared Package** (`packages/shared`) - Core shared utilities, entities, and systems
- **Client Package** (`packages/client`) - Frontend React application and 3D rendering
- **Server Package** (`packages/server`) - Backend server, networking, and database

## Local Development

### Generate Documentation

From the project root, run:

```bash
bun run docs:generate
```

This will:
1. Run TypeDoc on the client, server, and shared packages
2. Generate Markdown files in `packages/docs-site/docs/api/`

### Start Development Server

```bash
bun run docs:dev
```

This starts a local development server at `http://localhost:3000` with hot-reload.

### Build for Production

```bash
bun run docs:build
```

This will:
1. Generate the API documentation
2. Build the static Docusaurus site into `packages/docs-site/build/`

### Serve Production Build

```bash
bun run docs:serve
```

Serves the production build locally for testing.

## Deployment

The documentation is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

### GitHub Pages Setup

1. Go to your repository settings on GitHub
2. Navigate to **Settings** → **Pages**
3. Under **Build and deployment**, select:
   - **Source**: GitHub Actions
4. The workflow in `.github/workflows/deploy-docs.yml` will automatically deploy the docs

### Configuration

Update the following in `docusaurus.config.ts`:
- `url`: Your GitHub Pages URL (e.g., `https://username.github.io`)
- `baseUrl`: Your repository name (e.g., `/hyperscape-2/`)
- `organizationName`: Your GitHub username or organization
- `projectName`: Your repository name

## Writing Documentation

### TSDoc Comments

TypeDoc extracts documentation from TSDoc comments in your TypeScript code:

```typescript
/**
 * Represents a player entity in the game world.
 * 
 * @remarks
 * This class extends the base Entity and adds player-specific functionality
 * like inventory management, equipment, and stats.
 * 
 * @example
 * ```typescript
 * const player = new PlayerEntity(world, playerId);
 * player.health = 100;
 * player.addItem(itemId, quantity);
 * ```
 */
export class PlayerEntity extends Entity {
  /**
   * The player's current health points
   * 
   * @defaultValue 100
   */
  public health: number = 100;

  /**
   * Adds an item to the player's inventory
   * 
   * @param itemId - The unique identifier of the item
   * @param quantity - The number of items to add
   * @returns True if the item was successfully added
   */
  public addItem(itemId: string, quantity: number): boolean {
    // Implementation
  }
}
```

### Supported TSDoc Tags

- `@param` - Document function parameters
- `@returns` - Document return values
- `@throws` - Document exceptions
- `@example` - Provide code examples
- `@remarks` - Additional remarks
- `@see` - References to related items
- `@deprecated` - Mark as deprecated
- `@internal` - Mark as internal (excluded from docs)
- `@public`, `@private`, `@protected` - Visibility modifiers

### Custom Pages

Add custom documentation pages by creating `.md` or `.mdx` files in `packages/docs-site/docs/`.

## Configuration Files

- `typedoc.json` - TypeDoc configuration in the project root
- `docusaurus.config.ts` - Docusaurus site configuration
- `sidebars.ts` - Sidebar navigation structure
- `.github/workflows/deploy-docs.yml` - GitHub Actions deployment workflow

## Customization

### Styling

Edit `src/css/custom.css` to customize colors and styles.

### Homepage

Edit `src/pages/index.tsx` to customize the landing page.

### Sidebar

Edit `sidebars.ts` to customize the documentation navigation structure.

## Troubleshooting

### TypeDoc Errors

If TypeDoc fails to generate documentation:
1. Check for TypeScript compilation errors: `bun run build`
2. Review the `typedoc.json` configuration
3. Ensure all packages have valid `tsconfig.json` files

### Build Errors

If Docusaurus fails to build:
1. Clear the cache: `cd packages/docs-site && bun run clear`
2. Reinstall dependencies: `cd packages/docs-site && bun install`
3. Check for broken links in generated markdown

## Resources

- [TypeDoc Documentation](https://typedoc.org/)
- [typedoc-plugin-markdown](https://typedoc-plugin-markdown.org/)
- [Docusaurus Documentation](https://docusaurus.io/)
- [TSDoc Specification](https://tsdoc.org/)

