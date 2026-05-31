# Hyperscape Pixal3D Service

This package tracks the Hyperscape deployment wrapper for
[TencentARC/Pixal3D](https://github.com/TencentARC/Pixal3D). It does not vendor
the Pixal3D model, checkpoints, Hugging Face cache, generated GLBs, or local
secrets.

Asset Forge calls this Gradio service for the image-to-3D stage through:

```env
GENERATION_3D_PROVIDER=pixel3d-gradio
ASSET_FORGE_3D_PROVIDER=pixel3d-gradio
PIXEL3D_GRADIO_BASE_URL=http://192.168.1.177:7860
PIXEL3D_GRADIO_API_NAME=/generate_3d
PIXEL3D_RESOLUTION=1024
```

Leave `PIXEL3D_GRADIO_INPUTS` unset for the upstream Pixal3D app. The Asset
Forge adapter knows the `/generate_3d` API shape and follows with
`/extract_glb_api` to retrieve the GLB.

## What Is Tracked

- `Dockerfile` builds an image from upstream Pixal3D at a pinned commit.
- `docker-compose.yaml` runs the service with NVIDIA GPU access and persistent
  cache volumes.
- `patches/0001-bind-gradio-server.patch` makes the upstream Gradio server bind
  to `0.0.0.0:7860` without creating a public Gradio share URL by default.
- `scripts/check-api.sh` verifies that the expected Gradio API endpoints are
  live.

## What Is Not Tracked

Do not commit these:

- Hugging Face or PyTorch caches
- Pixal3D/TRELLIS model weights
- generated images, meshes, GLBs, or temporary state files
- `.env` files, tokens, API keys, or private URLs

The local `.gitignore` in this package excludes those paths.

## Build And Run

This Dockerfile targets the CUDA 12.4 / Python 3.10 wheel set used by the
upstream Hugging Face demo requirements. Different DGX images, drivers, CUDA
versions, or Python versions may need a matching wheel set.

```bash
cd packages/pixal3d-service
docker compose build
docker compose up -d
```

The service should become available at:

```text
http://localhost:7860
```

Check the API contract:

```bash
./scripts/check-api.sh http://localhost:7860
```

Expected named endpoints:

```text
/preprocess
/generate_3d
/extract_glb_api
```

## Coolify Notes

For a standalone Coolify service, use this package directory as the Docker
Compose context. Keep the cache volumes persistent so model downloads are not
repeated on every deploy.

Recommended runtime environment:

```env
GRADIO_SERVER_NAME=0.0.0.0
GRADIO_SERVER_PORT=7860
GRADIO_SHARE=0
LOW_VRAM=1
ATTN_BACKEND=flash_attn
HF_HOME=/models/huggingface
```

If the service runs on a different machine than Asset Forge, set
`PIXEL3D_GRADIO_BASE_URL` in the Asset Forge Coolify app to the LAN-reachable
URL for this service, for example `http://192.168.1.177:7860`.

## Upstream References

- Pixal3D upstream repo: `https://github.com/TencentARC/Pixal3D`
- Pinned upstream ref in this wrapper: `28efad66fdcbd8174a8538d9baf71fe34fe4b6d2`
- ComfyUI node reference: `https://github.com/Saganaki22/Pixal3D-ComfyUI`
