# Hyperia Branding Assets

Official logo files for Hyperia. All assets are exported from Adobe Illustrator.

## Logo Variants

| Variant | Description | Use Case |
|---------|-------------|----------|
| `hyperia_logo_color` | Full wordmark, gold gradient | Primary logo on dark backgrounds |
| `hyperia_logo_black` | Full wordmark, solid black | Print and light backgrounds |
| `hyperia_logo_white` | Full wordmark, solid white | Dark backgrounds, overlays |
| `hyperia_logo_icon_color` | "HS" icon, gold gradient | Favicons, app icons, small spaces |

## Formats

| Format | Purpose | Tracked by |
|--------|---------|------------|
| `.svg` | Web, UI, scalable usage | Git (text) |
| `.eps` | Print production | Git LFS |
| `.pdf` | Print-ready distribution | Git LFS |
| `.png` | Raster with transparency | Git LFS |
| `.jpg` | Raster without transparency | Git LFS |
| `.ai` | Illustrator source template | Git LFS |

**SVGs are the source of truth** for most digital uses. Raster and print formats are provided for workflows that require them. Binary files (`.ai`, `.eps`, `.pdf`, `.png`, `.jpg`) are stored via [Git LFS](https://git-lfs.com/) to avoid bloating the repository.

## Usage Guidelines

- Maintain the original aspect ratio; do not stretch or distort.
- Use the **color** variant as the primary logo whenever possible.
- Use **white** on dark backgrounds and **black** on light backgrounds.
- Minimum width for the full wordmark: 120px (digital) / 30mm (print).
- Minimum size for the icon: 32px (digital) / 8mm (print).
- Do not alter colors, add effects, or place over busy imagery without sufficient contrast.

## Naming Convention

```
hyperia_logo_{variant}_{color}.{ext}
```

- `variant`: `(none)` for full wordmark, `icon` for the HS mark, `template_icon` for the Illustrator source
- `color`: `color` (gold gradient), `black`, or `white`
