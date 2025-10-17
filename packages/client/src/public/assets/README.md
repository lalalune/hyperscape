# Public Assets

This folder contains public assets for the Hyperscape client (website/game).

## Directory Structure

```
assets/
├── images/          # Image assets (backgrounds, logos, etc.)
├── fonts/           # Custom fonts
└── icons/           # Icon assets
```

## Images

### Login Background
- **Path**: `assets/images/login-background.jpg` or `login-background.png`
- **Description**: Cyberpunk city background image for the login screen
- **Recommended Size**: 1920x1080 or larger
- **Format**: JPG or PNG

### Logo
- **Path**: `assets/images/logo.png` ✅ (Already added)
- **Description**: Hyperscape game logo
- **Format**: PNG with transparency

## Usage

Assets in this folder are served from the `/` root path when the app is built.

Example:
```tsx
<img src="/assets/images/logo.png" alt="Logo" />
```

Or with CSS:
```css
background-image: url('/assets/images/login-background.jpg');
```
