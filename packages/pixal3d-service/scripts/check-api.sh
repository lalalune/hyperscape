#!/usr/bin/env bash
set -euo pipefail

base_url="${1:-${PIXEL3D_GRADIO_BASE_URL:-http://127.0.0.1:7860}}"
base_url="${base_url%/}"

info="$(curl -fsS "${base_url}/gradio_api/info")"
missing=0

for endpoint in "/preprocess" "/generate_3d" "/extract_glb_api"; do
  if printf '%s' "${info}" | grep -q "\"${endpoint}\""; then
    printf 'ok: %s\n' "${endpoint}"
  else
    printf 'missing: %s\n' "${endpoint}" >&2
    missing=1
  fi
done

if [ "${missing}" -ne 0 ]; then
  printf 'Pixal3D Gradio API check failed for %s\n' "${base_url}" >&2
  exit 1
fi

printf 'Pixal3D Gradio API is ready at %s\n' "${base_url}"
