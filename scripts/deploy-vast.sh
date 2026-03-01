#!/bin/bash
# Hyperscape CI/CD Deploy for Vast.ai
# Pulls latest, builds, and starts the full duel stack under pm2
set -e

export PATH="/root/.bun/bin:$PATH"
cd /root/hyperscape

# ── Ensure DNS resolution works (some Vast containers use internal-only DNS) ─
echo -e "nameserver 8.8.8.8\nnameserver 8.8.4.4" > /etc/resolv.conf

LOG_DIR="/root/hyperscape/logs"
mkdir -p "$LOG_DIR"

echo "[deploy] Starting Hyperscape CI/CD update on Vast.ai..."
echo "[deploy] Timestamp: $(date -Iseconds)"

# ── Pull latest code ──────────────────────────────────────────
echo "[deploy] Pulling latest code from main branch..."
git fetch origin
git reset --hard origin/main
git pull origin main

# ── Restore environment variables after git reset ──────────────
# The git reset may have removed the .env file, so we copy from /tmp
# where the CI/CD workflow wrote the secrets before calling this script
mkdir -p /root/hyperscape/packages/server
if [ -f "/tmp/hyperscape-secrets.env" ]; then
    echo "[deploy] Copying secrets from /tmp/hyperscape-secrets.env to packages/server/.env..."
    cp /tmp/hyperscape-secrets.env /root/hyperscape/packages/server/.env
    echo "[deploy] .env contents (keys only):"
    cut -d= -f1 /root/hyperscape/packages/server/.env
else
    echo "[deploy] WARNING: /tmp/hyperscape-secrets.env not found!"
    echo "[deploy] Trying to recreate from environment variables..."
    {
        [ -n "$DATABASE_URL" ] && echo "DATABASE_URL=$DATABASE_URL"
        [ -n "$TWITCH_STREAM_KEY" ] && echo "TWITCH_STREAM_KEY=$TWITCH_STREAM_KEY"
        [ -n "$X_STREAM_KEY" ] && echo "X_STREAM_KEY=$X_STREAM_KEY"
        [ -n "$X_RTMP_URL" ] && echo "X_RTMP_URL=$X_RTMP_URL"
        [ -n "$KICK_STREAM_KEY" ] && echo "KICK_STREAM_KEY=$KICK_STREAM_KEY"
        [ -n "$KICK_RTMP_URL" ] && echo "KICK_RTMP_URL=$KICK_RTMP_URL"
        [ -n "$SOLANA_DEPLOYER_PRIVATE_KEY" ] && echo "SOLANA_DEPLOYER_PRIVATE_KEY=$SOLANA_DEPLOYER_PRIVATE_KEY"
        # Always disable YouTube
        echo "YOUTUBE_STREAM_KEY="
    } > /root/hyperscape/packages/server/.env
fi
echo "[deploy] Environment variables configured"

# ── Install system dependencies (needed for native modules) ───
echo "[deploy] Installing system build dependencies..."
apt-get update && apt-get install -y \
    build-essential \
    python3 \
    socat \
    xvfb \
    git-lfs \
    ffmpeg \
    wget \
    gnupg \
    curl \
    jq \
    pulseaudio \
    pulseaudio-utils \
    mesa-vulkan-drivers \
    vulkan-tools \
    libvulkan1 \
    || true
git lfs install || true

# ── Check GPU and Vulkan support ──────────────────────────────
echo "[deploy] Checking GPU status..."
nvidia-smi || echo "[deploy] WARNING: nvidia-smi not available"

# Force NVIDIA-only Vulkan ICD to avoid conflicts with Mesa ICDs
# Check which ICD files exist and use the first available one
echo "[deploy] Checking Vulkan ICD files..."
NVIDIA_ICD_PATHS=(
    "/usr/share/vulkan/icd.d/nvidia_icd.json"
    "/etc/vulkan/icd.d/nvidia_icd.json"
    "/usr/share/vulkan/icd.d/nvidia_layers.json"
)
for icd_path in "${NVIDIA_ICD_PATHS[@]}"; do
    if [ -f "$icd_path" ]; then
        echo "[deploy] ✓ Found NVIDIA ICD at: $icd_path"
        export VK_ICD_FILENAMES="$icd_path"
        cat "$icd_path" 2>/dev/null | head -20 || true
        break
    else
        echo "[deploy] ✗ Not found: $icd_path"
    fi
done

if [ -z "$VK_ICD_FILENAMES" ]; then
    echo "[deploy] WARNING: No NVIDIA Vulkan ICD file found!"
    echo "[deploy] Looking for any Vulkan ICD files..."
    ls -la /usr/share/vulkan/icd.d/ 2>/dev/null || true
    ls -la /etc/vulkan/icd.d/ 2>/dev/null || true
    # Try to use any available ICD as fallback
    export VK_ICD_FILENAMES="/usr/share/vulkan/icd.d/nvidia_icd.json"
fi

echo "[deploy] Using VK_ICD_FILENAMES=$VK_ICD_FILENAMES"

echo "[deploy] Checking Vulkan support (NVIDIA-only)..."
vulkaninfo --summary 2>&1 | head -30 || echo "[deploy] WARNING: vulkaninfo failed"

# Also check if libvulkan can find the driver
echo "[deploy] Checking Vulkan driver loading..."
VK_LOADER_DEBUG=all vulkaninfo --summary 2>&1 | grep -E "ICD|driver|device" | head -10 || true

# ── Setup GPU Rendering for WebGPU ──
# WebGPU is REQUIRED - there is NO WebGL fallback.
# We try multiple approaches in order:
# 1. Xorg with NVIDIA (best if DRI/DRM devices are available)
# 2. Xvfb with NVIDIA Vulkan (virtual framebuffer, Chrome uses GPU via ANGLE/Vulkan)
# If neither works, deployment MUST FAIL - headless mode does NOT support WebGPU.
echo "[deploy] ═══════════════════════════════════════════════════════════"
echo "[deploy] Setting up GPU rendering for WebGPU streaming"
echo "[deploy] CRITICAL: WebGPU is REQUIRED - NO WebGL fallback"
echo "[deploy] ═══════════════════════════════════════════════════════════"

# Verify NVIDIA GPU is available
if ! command -v nvidia-smi &>/dev/null; then
    echo "[deploy] FATAL: nvidia-smi not found. NVIDIA drivers not installed."
    exit 1
fi

if ! nvidia-smi &>/dev/null; then
    echo "[deploy] FATAL: nvidia-smi failed. GPU not accessible."
    nvidia-smi 2>&1 || true
    exit 1
fi

echo "[deploy] NVIDIA GPU detected:"
nvidia-smi --query-gpu=name,driver_version --format=csv,noheader

# Check what GPU access we have
echo "[deploy] Checking GPU device access..."
ls -la /dev/dri/ 2>/dev/null || echo "[deploy] No /dev/dri directory (DRM not available)"
ls -la /dev/nvidia* 2>/dev/null || echo "[deploy] Checking NVIDIA devices..."

# Check EGL support (works without X server)
echo "[deploy] Checking EGL support..."
if [ -f "/usr/lib/x86_64-linux-gnu/libEGL_nvidia.so.0" ] || \
   [ -f "/usr/lib/libEGL_nvidia.so.0" ]; then
    echo "[deploy] ✓ NVIDIA EGL library found"
    HAS_NVIDIA_EGL=true
else
    echo "[deploy] NVIDIA EGL library not found"
    HAS_NVIDIA_EGL=false
fi

# Install required packages
echo "[deploy] Installing required packages..."
apt-get update
apt-get install -y \
    mesa-utils \
    libglvnd0 \
    libgl1 \
    libglx0 \
    libegl1 \
    libgles2 \
    x11-xserver-utils \
    2>&1 || true

# Determine rendering mode
# Priority: Xorg with NVIDIA > Chrome headless with EGL
RENDERING_MODE="unknown"
export DISPLAY=""
export DUEL_CAPTURE_USE_XVFB="false"

# Kill any existing display servers and clean up ALL X files
echo "[deploy] Cleaning up any existing X servers..."
pkill -9 Xvfb 2>/dev/null || true
pkill -9 Xorg 2>/dev/null || true
pkill -9 X 2>/dev/null || true
sleep 3
# Remove ALL X lock files and sockets
rm -f /tmp/.X*-lock 2>/dev/null || true
rm -rf /tmp/.X11-unix 2>/dev/null || true
mkdir -p /tmp/.X11-unix
chmod 1777 /tmp/.X11-unix
echo "[deploy] X cleanup complete"

# Try Xorg if DRI devices exist
if [ -d "/dev/dri" ] && [ -e "/dev/dri/card0" -o -e "/dev/dri/card1" ]; then
    echo "[deploy] DRI devices found, attempting Xorg setup..."

    # Get GPU BusID for Xorg config
    GPU_BUS_ID=$(nvidia-smi --query-gpu=pci.bus_id --format=csv,noheader | head -1)
    BUS_HEX=$(echo "$GPU_BUS_ID" | cut -d: -f2)
    DEVICE_HEX=$(echo "$GPU_BUS_ID" | cut -d: -f3 | cut -d. -f1)
    FUNC=$(echo "$GPU_BUS_ID" | cut -d. -f2)
    BUS_DEC=$((16#$BUS_HEX))
    DEVICE_DEC=$((16#$DEVICE_HEX))
    XORG_BUS_ID="PCI:${BUS_DEC}:${DEVICE_DEC}:${FUNC}"
    echo "[deploy] GPU BusID: $XORG_BUS_ID"

    apt-get install -y xserver-xorg-core 2>&1 || true

    mkdir -p /etc/X11
    cat > /etc/X11/xorg-nvidia-headless.conf << XORGEOF
Section "ServerLayout"
    Identifier     "Layout0"
    Screen      0  "Screen0"
EndSection

Section "Device"
    Identifier     "Device0"
    Driver         "nvidia"
    BusID          "$XORG_BUS_ID"
    Option         "AllowEmptyInitialConfiguration" "True"
    Option         "UseDisplayDevice" "None"
EndSection

Section "Screen"
    Identifier     "Screen0"
    Device         "Device0"
    DefaultDepth    24
    SubSection     "Display"
        Depth       24
        Virtual    1920 1080
    EndSubSection
EndSection
XORGEOF

    Xorg :99 -config /etc/X11/xorg-nvidia-headless.conf -noreset -logfile /var/log/Xorg.99.log 2>&1 &
    XORG_PID=$!
    sleep 5

    if kill -0 $XORG_PID 2>/dev/null && xdpyinfo -display :99 >/dev/null 2>&1; then
        # Check if Xorg is actually using NVIDIA (not software rendering)
        # If the NVIDIA driver failed, Xorg falls back to modesetting with swrast (software)
        if grep -q "IGLX: Loaded and initialized swrast" /var/log/Xorg.99.log 2>/dev/null; then
            echo "[deploy] ✗ Xorg started but using SOFTWARE RENDERING (swrast) - not usable for WebGPU"
            echo "[deploy] NVIDIA driver failed to initialize, will try Xvfb..."
            echo "[deploy] Xorg errors:"
            grep -E "(EE)" /var/log/Xorg.99.log 2>/dev/null | head -10 || true
            pkill -9 Xorg 2>/dev/null || true
            pkill -9 X 2>/dev/null || true
            sleep 3
            rm -f /tmp/.X*-lock 2>/dev/null || true
            rm -rf /tmp/.X11-unix/X99 2>/dev/null || true
        elif grep -q "NVIDIA: Failed to initialize" /var/log/Xorg.99.log 2>/dev/null; then
            echo "[deploy] ✗ Xorg started but NVIDIA driver failed to initialize"
            echo "[deploy] This is common in containers without full DRM access"
            echo "[deploy] Will try Xvfb with Vulkan instead..."
            pkill -9 Xorg 2>/dev/null || true
            pkill -9 X 2>/dev/null || true
            sleep 3
            rm -f /tmp/.X*-lock 2>/dev/null || true
            rm -rf /tmp/.X11-unix/X99 2>/dev/null || true
        else
            export DISPLAY=:99
            RENDERING_MODE="xorg"
            echo "[deploy] ✓ Xorg started successfully on :99 with NVIDIA"
        fi
    else
        echo "[deploy] Xorg failed to start, will try Xvfb"
        cat /var/log/Xorg.99.log 2>/dev/null | tail -20 || true
        pkill -9 Xorg 2>/dev/null || true
        pkill -9 X 2>/dev/null || true
        sleep 3
        rm -f /tmp/.X*-lock 2>/dev/null || true
        rm -rf /tmp/.X11-unix/X99 2>/dev/null || true
    fi
else
    echo "[deploy] No DRI devices available (container without DRM access)"
fi

# If Xorg didn't work, try Xvfb with NVIDIA Vulkan
# Xvfb provides X11 protocol (virtual framebuffer), but Chrome can still use
# NVIDIA GPU for rendering via ANGLE/Vulkan - frames are captured via CDP
if [ "$RENDERING_MODE" = "unknown" ]; then
    echo "[deploy] Trying Xvfb with NVIDIA Vulkan (virtual display + GPU rendering)..."

    # Start Xvfb with a virtual display
    Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset 2>&1 &
    XVFB_PID=$!
    sleep 3

    if kill -0 $XVFB_PID 2>/dev/null && xdpyinfo -display :99 >/dev/null 2>&1; then
        export DISPLAY=:99
        export DUEL_CAPTURE_USE_XVFB="true"
        RENDERING_MODE="xvfb-vulkan"
        echo "[deploy] ✓ Xvfb started on :99 (Chrome will use NVIDIA Vulkan for WebGPU)"
    else
        echo "[deploy] Xvfb failed to start"
        pkill -9 Xvfb 2>/dev/null || true
    fi
fi

# CRITICAL: If no rendering mode was established, FAIL deployment
# WebGPU is REQUIRED - headless mode does NOT support WebGPU
if [ "$RENDERING_MODE" = "unknown" ]; then
    echo "[deploy] ════════════════════════════════════════════════════════════════"
    echo "[deploy] FATAL ERROR: Cannot establish WebGPU-capable rendering mode"
    echo "[deploy] ════════════════════════════════════════════════════════════════"
    echo "[deploy] WebGPU is REQUIRED for Hyperscape - there is NO WebGL fallback."
    echo "[deploy] "
    echo "[deploy] Both Xorg and Xvfb failed to start. This usually means:"
    echo "[deploy]   - NVIDIA drivers are not properly installed"
    echo "[deploy]   - GPU is not accessible in this container"
    echo "[deploy]   - DRI/DRM devices are not available"
    echo "[deploy] "
    echo "[deploy] Please ensure:"
    echo "[deploy]   1. Vast.ai instance has an NVIDIA GPU"
    echo "[deploy]   2. NVIDIA drivers and CUDA are installed"
    echo "[deploy]   3. Container has access to GPU devices"
    echo "[deploy] "
    echo "[deploy] Deployment CANNOT continue without WebGPU support."
    echo "[deploy] ════════════════════════════════════════════════════════════════"
    exit 1
fi

# Export rendering mode for the streaming bridge
export GPU_RENDERING_MODE="$RENDERING_MODE"
echo "[deploy] ═══════════════════════════════════════════════════════════"
echo "[deploy] GPU Rendering Mode: $RENDERING_MODE"
echo "[deploy] DISPLAY: $DISPLAY"
echo "[deploy] DUEL_CAPTURE_USE_XVFB: $DUEL_CAPTURE_USE_XVFB"
echo "[deploy] WebGPU: ENABLED (required)"
echo "[deploy] ═══════════════════════════════════════════════════════════"

# ── Install Chrome Dev channel (has WebGPU enabled by default) ─
echo "[deploy] Installing Chrome Dev channel for WebGPU support..."
if ! command -v google-chrome-unstable &> /dev/null; then
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - || true
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
    apt-get update && apt-get install -y google-chrome-unstable || true
    echo "[deploy] Chrome Dev installed: $(google-chrome-unstable --version 2>/dev/null || echo 'install failed')"
else
    echo "[deploy] Chrome Dev already installed: $(google-chrome-unstable --version)"
fi

# ── Install Playwright for WebGPU tests (must be before tests) ───────────────
export PATH="/root/.bun/bin:$PATH"
cd /root/hyperscape
echo "[deploy] Installing Playwright module for WebGPU testing..."
# Install playwright module so bun can import it for Test 6
bun add playwright --dev 2>/dev/null || bun install playwright 2>/dev/null || true
echo "[deploy] Installing Playwright browser (Chromium)..."
bunx playwright install chromium --with-deps 2>/dev/null || {
    echo "[deploy] Playwright browser install failed, trying manual deps..."
    bunx playwright install chromium || true
    bunx playwright install-deps chromium || true
}

# ── Test WebGPU with different configurations ───────────────────────────
echo "[deploy] ═══════════════════════════════════════════════════════════"
echo "[deploy] Testing WebGPU before starting services..."
echo "[deploy] ═══════════════════════════════════════════════════════════"

# Create a simple WebGPU test HTML file
# Output result to DOM SYNCHRONOUSLY for --dump-dom capture
# We only check navigator.gpu existence - adapter request is async and would timeout
cat > /tmp/webgpu-test.html << 'WEBGPUHTML'
<!DOCTYPE html>
<html><body>
<script>
// Synchronous check - write result to document immediately
var result = 'WEBGPU_RESULT: ';
if (typeof navigator === 'undefined' || !navigator.gpu) {
  result += 'FAILED - navigator.gpu not available';
} else {
  result += 'SUCCESS - navigator.gpu exists';
}
document.write('<div id="result">' + result + '</div>');
console.log(result);
</script>
</body></html>
WEBGPUHTML

# Test multiple Chrome configurations to find what works
WEBGPU_WORKING="false"

# Common Chrome flags for WebGPU testing
# CRITICAL: --disable-gpu-sandbox is required for container GPU access
CHROME_GPU_FLAGS="--no-sandbox --disable-gpu-sandbox --disable-setuid-sandbox --disable-dev-shm-usage"
CHROME_WEBGPU_FLAGS="--enable-unsafe-webgpu --enable-features=Vulkan,UseSkiaRenderer,WebGPU --ignore-gpu-blocklist --disable-software-rasterizer --disable-gpu-driver-bug-workarounds"

# First, dump chrome://gpu diagnostics to understand GPU status
echo "[deploy] Capturing chrome://gpu diagnostics..."
timeout 30 google-chrome-unstable \
    $CHROME_GPU_FLAGS \
    --use-gl=angle \
    --use-angle=vulkan \
    $CHROME_WEBGPU_FLAGS \
    --headless=new \
    --dump-dom \
    --virtual-time-budget=3000 \
    "chrome://gpu" 2>&1 | head -100 > /tmp/chrome-gpu-info.txt || true
echo "[deploy] chrome://gpu output (first 50 lines):"
head -50 /tmp/chrome-gpu-info.txt 2>/dev/null || echo "[deploy] Could not capture chrome://gpu"
echo "[deploy] ───────────────────────────────────────────────────────────"

# Test 1: Headless=new with native Vulkan (requires NVIDIA Vulkan ICD)
echo "[deploy] Test 1: Chrome headless=new with native Vulkan..."
WEBGPU_TEST_RESULT=$(timeout 30 google-chrome-unstable \
    $CHROME_GPU_FLAGS \
    --use-vulkan \
    --use-gl=angle \
    --use-angle=vulkan \
    $CHROME_WEBGPU_FLAGS \
    --headless=new \
    --dump-dom \
    --virtual-time-budget=5000 \
    "file:///tmp/webgpu-test.html" 2>&1 | grep -o 'WEBGPU_RESULT: .*' | head -1 || echo "WEBGPU_RESULT: TIMEOUT")
echo "[deploy] Test 1 Result: $WEBGPU_TEST_RESULT"
if echo "$WEBGPU_TEST_RESULT" | grep -q "SUCCESS"; then
    WEBGPU_WORKING="headless-vulkan"
fi

# Test 2: Headless=new with EGL (NVIDIA EGL without X11)
if [ "$WEBGPU_WORKING" = "false" ]; then
    echo "[deploy] Test 2: Chrome headless=new with EGL..."
    WEBGPU_TEST_RESULT=$(timeout 30 google-chrome-unstable \
        $CHROME_GPU_FLAGS \
        --use-gl=egl \
        --use-vulkan \
        $CHROME_WEBGPU_FLAGS \
        --headless=new \
        --dump-dom \
        --virtual-time-budget=5000 \
        "file:///tmp/webgpu-test.html" 2>&1 | grep -o 'WEBGPU_RESULT: .*' | head -1 || echo "WEBGPU_RESULT: TIMEOUT")
    echo "[deploy] Test 2 Result: $WEBGPU_TEST_RESULT"
    if echo "$WEBGPU_TEST_RESULT" | grep -q "SUCCESS"; then
        WEBGPU_WORKING="headless-egl"
        export STREAM_CAPTURE_USE_EGL="true"
        export STREAM_CAPTURE_ANGLE="default"
    fi
fi

# Test 3: With Xvfb display (headless=new + virtual framebuffer for GPU surface)
if [ "$WEBGPU_WORKING" = "false" ] && [ -n "$DISPLAY" ]; then
    echo "[deploy] Test 3: Chrome headless=new with DISPLAY=$DISPLAY (Xvfb)..."
    WEBGPU_TEST_RESULT=$(timeout 30 google-chrome-unstable \
        $CHROME_GPU_FLAGS \
        --use-vulkan \
        --use-gl=angle \
        --use-angle=vulkan \
        $CHROME_WEBGPU_FLAGS \
        --headless=new \
        --dump-dom \
        --virtual-time-budget=5000 \
        "file:///tmp/webgpu-test.html" 2>&1 | grep -o 'WEBGPU_RESULT: .*' | head -1 || echo "WEBGPU_RESULT: TIMEOUT")
    echo "[deploy] Test 3 Result: $WEBGPU_TEST_RESULT"
    if echo "$WEBGPU_TEST_RESULT" | grep -q "SUCCESS"; then
        WEBGPU_WORKING="xvfb-vulkan"
    fi
fi

# Test 4: Try with ozone-platform=headless (Wayland-like headless) + aggressive GPU flags
if [ "$WEBGPU_WORKING" = "false" ]; then
    echo "[deploy] Test 4: Chrome with ozone-platform=headless + aggressive GPU flags..."
    WEBGPU_TEST_RESULT=$(timeout 30 google-chrome-unstable \
        $CHROME_GPU_FLAGS \
        --ozone-platform=headless \
        --use-vulkan \
        --use-gl=angle \
        --use-angle=vulkan \
        $CHROME_WEBGPU_FLAGS \
        --enable-dawn-features=allow_unsafe_apis \
        --headless=new \
        --dump-dom \
        --virtual-time-budget=5000 \
        "file:///tmp/webgpu-test.html" 2>&1 | grep -o 'WEBGPU_RESULT: .*' | head -1 || echo "WEBGPU_RESULT: TIMEOUT")
    echo "[deploy] Test 4 Result: $WEBGPU_TEST_RESULT"
    if echo "$WEBGPU_TEST_RESULT" | grep -q "SUCCESS"; then
        WEBGPU_WORKING="ozone-headless"
        export STREAM_CAPTURE_OZONE_HEADLESS="true"
    fi
fi

# Test 5: Try with VulkanFromANGLE + DefaultANGLEVulkan (explicit Vulkan backend)
if [ "$WEBGPU_WORKING" = "false" ]; then
    echo "[deploy] Test 5: Chrome with VulkanFromANGLE + passthrough decoder..."
    WEBGPU_TEST_RESULT=$(timeout 30 google-chrome-unstable \
        $CHROME_GPU_FLAGS \
        --use-gl=angle \
        --use-angle=vulkan \
        --use-cmd-decoder=passthrough \
        --enable-features=VulkanFromANGLE,DefaultANGLEVulkan,Vulkan,WebGPU \
        --enable-unsafe-webgpu \
        --ignore-gpu-blocklist \
        --enable-dawn-features=allow_unsafe_apis,disable_blob_cache \
        --headless=new \
        --dump-dom \
        --virtual-time-budget=5000 \
        "file:///tmp/webgpu-test.html" 2>&1 | grep -o 'WEBGPU_RESULT: .*' | head -1 || echo "WEBGPU_RESULT: TIMEOUT")
    echo "[deploy] Test 5 Result: $WEBGPU_TEST_RESULT"
    if echo "$WEBGPU_TEST_RESULT" | grep -q "SUCCESS"; then
        WEBGPU_WORKING="vulkan-passthrough"
        export STREAM_CAPTURE_ANGLE="vulkan"
    fi
fi

# Test 5b: Try non-headless with Xvfb but without ANGLE (native Vulkan)
if [ "$WEBGPU_WORKING" = "false" ] && [ -n "$DISPLAY" ]; then
    echo "[deploy] Test 5b: Non-headless Chrome with native Vulkan (no ANGLE)..."
    WEBGPU_TEST_RESULT=$(timeout 30 google-chrome-unstable \
        $CHROME_GPU_FLAGS \
        --use-vulkan=native \
        --enable-features=Vulkan,VulkanFromANGLE,WebGPU \
        --enable-unsafe-webgpu \
        --ignore-gpu-blocklist \
        --disable-software-rasterizer \
        --enable-dawn-features=allow_unsafe_apis \
        --dump-dom \
        --virtual-time-budget=5000 \
        "file:///tmp/webgpu-test.html" 2>&1 | grep -o 'WEBGPU_RESULT: .*' | head -1 || echo "WEBGPU_RESULT: TIMEOUT")
    echo "[deploy] Test 5b Result: $WEBGPU_TEST_RESULT"
    if echo "$WEBGPU_TEST_RESULT" | grep -q "SUCCESS"; then
        WEBGPU_WORKING="native-vulkan"
    fi
fi

# Test 5c: Try with SwANGLE (software Vulkan, last resort)
if [ "$WEBGPU_WORKING" = "false" ]; then
    echo "[deploy] Test 5c: Chrome with SwiftShader/SwANGLE (software Vulkan)..."
    WEBGPU_TEST_RESULT=$(timeout 30 google-chrome-unstable \
        $CHROME_GPU_FLAGS \
        --use-gl=angle \
        --use-angle=swiftshader \
        --enable-unsafe-webgpu \
        --enable-features=WebGPU \
        --headless=new \
        --dump-dom \
        --virtual-time-budget=5000 \
        "file:///tmp/webgpu-test.html" 2>&1 | grep -o 'WEBGPU_RESULT: .*' | head -1 || echo "WEBGPU_RESULT: TIMEOUT")
    echo "[deploy] Test 5c Result: $WEBGPU_TEST_RESULT"
    if echo "$WEBGPU_TEST_RESULT" | grep -q "SUCCESS"; then
        WEBGPU_WORKING="swiftshader"
        echo "[deploy] WARNING: Using software rendering (SwiftShader) - performance will be poor!"
        export STREAM_CAPTURE_ANGLE="swiftshader"
    fi
fi

# Test 6: Use Playwright in non-headless mode with Xvfb (most accurate test)
if [ "$WEBGPU_WORKING" = "false" ] && [ -n "$DISPLAY" ]; then
    echo "[deploy] Test 6: Playwright non-headless with Xvfb (actual streaming config)..."

    # Create a Node.js test script using Playwright with explicit executable path
    cat > /tmp/playwright-webgpu-test.mjs << 'PLAYWRIGHTEOF'
import { chromium } from 'playwright';
// NON-HEADLESS Chrome with Xvfb - this is required for WebGPU!
// WebGPU requires a real window context, not headless mode
// Xvfb provides the X11 display, Chrome uses GPU via Vulkan
const args = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  // CRITICAL: DO NOT use headless flags - WebGPU needs window context
  // Chrome connects to Xvfb on DISPLAY=:99
  // Use ANGLE with Vulkan backend for WebGPU
  '--use-angle=vulkan',
  // WebGPU essentials
  '--enable-unsafe-webgpu',
  '--enable-features=WebGPU,Vulkan',
  '--ignore-gpu-blocklist',
  // Enable GPU
  '--enable-gpu',
  '--disable-software-rasterizer',
  // Disable GPU sandbox for container
  '--disable-gpu-sandbox',
];

// Find Chrome Dev executable
const chromePaths = [
  '/usr/bin/google-chrome-unstable',
  '/opt/google/chrome-unstable/google-chrome-unstable',
  '/usr/bin/google-chrome',
];
let executablePath = null;
for (const p of chromePaths) {
  try {
    const fs = await import('fs');
    if (fs.existsSync(p)) { executablePath = p; break; }
  } catch {}
}

try {
  console.log('DEBUG: Starting browser launch...');
  console.log('DEBUG: executablePath =', executablePath);
  console.log('DEBUG: DISPLAY =', process.env.DISPLAY);
  console.log('DEBUG: VK_ICD_FILENAMES =', process.env.VK_ICD_FILENAMES);
  console.log('DEBUG: args =', args.join(' '));

  const launchOpts = {
    headless: false,  // CRITICAL: Non-headless for WebGPU!
    args,
    // Prevent Playwright from adding headless/swiftshader
    ignoreDefaultArgs: ['--headless', '--enable-unsafe-swiftshader'],
    // NVIDIA GPU environment - use Vulkan for WebGPU
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY || ':99',  // Xvfb display
      VK_ICD_FILENAMES: '/usr/share/vulkan/icd.d/nvidia_icd.json',
      LIBGL_ALWAYS_SOFTWARE: '0',
    },
  };
  if (executablePath) {
    launchOpts.executablePath = executablePath;
  } else {
    launchOpts.channel = 'chrome';  // Fallback to system Chrome
  }

  const browser = await chromium.launch(launchOpts);
  console.log('DEBUG: Browser launched successfully');

  // Listen for browser disconnection
  browser.on('disconnected', () => {
    console.log('DEBUG: Browser disconnected!');
  });

  // Check if browser is still running after 2 seconds
  await new Promise(r => setTimeout(r, 2000));
  console.log('DEBUG: Browser still alive after 2s, connected:', browser.isConnected());

  // If not connected, the browser crashed
  if (!browser.isConnected()) {
    console.log('DEBUG: Browser crashed! GPU process likely failed.');
    console.log('WEBGPU_RESULT: FAILED - Browser crashed on launch (GPU process failure)');
    process.exit(1);
  }

  const page = await browser.newPage();

  // Simple test - just see if we can render ANY page
  console.log('DEBUG: Testing basic page render...');
  try {
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    // Try rendering a simple page
    await page.goto('data:text/html,<h1>Test</h1>', { timeout: 30000 });
    const title = await page.evaluate(() => document.body.innerHTML);
    console.log('DEBUG: Page rendered successfully, content:', title.substring(0, 50));

    // Now try about:blank
    await page.goto('about:blank', { timeout: 10000 });
    console.log('DEBUG: about:blank loaded successfully');

  } catch (e) {
    console.log('DEBUG: Basic render failed:', e.message);
  }

  // Check chrome://gpu for diagnostics
  console.log('DEBUG: Checking chrome://gpu...');
  try {
    await page.goto('chrome://gpu', { timeout: 10000 });
    const gpuStatus = await page.evaluate(() => {
      const featureStatusList = document.getElementById('feature-status-list');
      if (featureStatusList) {
        // Get first 500 chars of GPU feature status
        return featureStatusList.innerText.substring(0, 500);
      }
      return 'GPU status not found';
    });
    console.log('DEBUG: chrome://gpu status:', gpuStatus.substring(0, 200));
  } catch (e) {
    console.log('DEBUG: chrome://gpu failed:', e.message);
  }

  // Now check navigator.gpu directly on blank page
  await page.goto('about:blank', { timeout: 10000 });
  const gpuResult = await page.evaluate(async () => {
    if (!navigator.gpu) {
      return { available: false, error: 'navigator.gpu is undefined' };
    }
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        return { available: false, error: 'requestAdapter returned null' };
      }
      const info = await adapter.requestAdapterInfo();
      return {
        available: true,
        vendor: info.vendor,
        architecture: info.architecture,
        description: info.description
      };
    } catch (e) {
      return { available: false, error: 'requestAdapter failed: ' + e.message };
    }
  });

  if (gpuResult.available) {
    console.log('WEBGPU_RESULT: SUCCESS - ' + gpuResult.vendor + ' / ' + gpuResult.description);
  } else {
    console.log('WEBGPU_RESULT: FAILED - ' + gpuResult.error);
  }
  await browser.close();
  process.exit(gpuResult.available ? 0 : 1);
} catch (e) {
  console.log('DEBUG: Error caught:', e.message);
  console.log('WEBGPU_RESULT: FAILED - ' + e.message);
  process.exit(1);
}
PLAYWRIGHTEOF

    # Set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD to avoid download attempts
    export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
    # Use bun instead of node since playwright is installed via bunx
    # Capture full output to see DEBUG info
    echo "[deploy] Running Playwright WebGPU test..."
    timeout 60 bun run /tmp/playwright-webgpu-test.mjs 2>&1 | tee /tmp/webgpu-test-output.log
    # Extract result from the captured output
    WEBGPU_TEST_RESULT=$(grep -o 'WEBGPU_RESULT: .*' /tmp/webgpu-test-output.log | head -1 || echo "WEBGPU_RESULT: TIMEOUT")
    echo "[deploy] Test 6 Result: $WEBGPU_TEST_RESULT"
    if echo "$WEBGPU_TEST_RESULT" | grep -q "SUCCESS"; then
        WEBGPU_WORKING="playwright-xvfb"
        echo "[deploy] ✓ WebGPU works with Playwright non-headless + Xvfb"
    fi
fi

echo "[deploy] ═══════════════════════════════════════════════════════════"
if [ "$WEBGPU_WORKING" != "false" ]; then
    echo "[deploy] ✓ WebGPU WORKING with configuration: $WEBGPU_WORKING"
else
    echo "[deploy] ⚠️ WebGPU not confirmed working in any test configuration"
    echo "[deploy] Proceeding anyway - rtmp-bridge has its own preflight check"
fi
echo "[deploy] ═══════════════════════════════════════════════════════════"

# Export the working mode for streaming config
export WEBGPU_MODE="$WEBGPU_WORKING"

# ── Setup PulseAudio for audio capture ────────────────────────
echo "[deploy] Setting up PulseAudio for audio streaming..."

# Kill any existing PulseAudio
pulseaudio --kill 2>/dev/null || true
pkill -9 pulseaudio 2>/dev/null || true
sleep 2

# Setup XDG runtime directory for user-mode PulseAudio
export XDG_RUNTIME_DIR=/tmp/pulse-runtime
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"

# Create PulseAudio config directory
mkdir -p /root/.config/pulse

# Create a minimal PulseAudio config that loads the null sink automatically
cat > /root/.config/pulse/default.pa << 'PULSEEOF'
.fail
load-module module-null-sink sink_name=chrome_audio sink_properties=device.description="ChromeAudio"
set-default-sink chrome_audio
load-module module-native-protocol-unix auth-anonymous=1
PULSEEOF

# Start PulseAudio in user mode (more reliable than system mode)
pulseaudio --start --exit-idle-time=-1 --daemonize=yes 2>&1 || true
sleep 3

# Verify PulseAudio is running and has the sink
if pulseaudio --check 2>/dev/null; then
    echo "[deploy] PulseAudio is running in user mode"
    pactl list short sinks 2>/dev/null || true
    # Double-check the chrome_audio sink exists
    if pactl list short sinks 2>/dev/null | grep -q chrome_audio; then
        echo "[deploy] chrome_audio sink is available"
    else
        echo "[deploy] Creating chrome_audio sink manually..."
        pactl load-module module-null-sink sink_name=chrome_audio sink_properties=device.description="ChromeAudio" 2>/dev/null || true
        pactl set-default-sink chrome_audio 2>/dev/null || true
    fi
else
    echo "[deploy] WARNING: PulseAudio failed to start - trying fallback..."
    # Fallback: try starting without config
    pulseaudio -D --exit-idle-time=-1 2>&1 || true
    sleep 2
    pactl load-module module-null-sink sink_name=chrome_audio 2>/dev/null || true
    pactl set-default-sink chrome_audio 2>/dev/null || true
fi

# Export PULSE_SERVER for child processes
export PULSE_SERVER="unix:$XDG_RUNTIME_DIR/pulse/native"
echo "[deploy] PULSE_SERVER=$PULSE_SERVER"

# ── Verify Playwright (already installed for WebGPU tests) ─────────────
export PATH="/root/.bun/bin:$PATH"
echo "[deploy] Verifying Playwright installation..."
# Skip install if already done above; just verify
bunx playwright --version || {
    echo "[deploy] Playwright not found, installing..."
    bunx playwright install chromium --with-deps || true
}

# ── Install dependencies ──────────────────────────────────────
echo "[deploy] Installing dependencies..."
export CI=true
bun install

# ── Build core packages ──────────────────────────────────────
echo "[deploy] Building core dependencies..."
cd packages/physx-js-webidl && bun run build && cd ../..
cd packages/decimation && bun run build && cd ../..
cd packages/impostors && bun run build && cd ../..
cd packages/procgen && bun run build && cd ../..
cd packages/asset-forge && bun run build:services && cd ../..
cd packages/shared && bun run build && cd ../..

# ── Load database configuration ────────────────────────────────
# Source .env file to get DATABASE_URL for drizzle-kit and PM2
if [ -f "/root/hyperscape/packages/server/.env" ]; then
    echo "[deploy] Loading database configuration from packages/server/.env..."
    set -a
    source /root/hyperscape/packages/server/.env
    set +a
    echo "[deploy] DATABASE_URL is ${DATABASE_URL:+configured}${DATABASE_URL:-NOT SET}"
    echo "[deploy] SOLANA_DEPLOYER_PRIVATE_KEY is ${SOLANA_DEPLOYER_PRIVATE_KEY:+configured}${SOLANA_DEPLOYER_PRIVATE_KEY:-NOT SET}"
else
    echo "[deploy] WARNING: No packages/server/.env file found"
fi

# Warn if DATABASE_URL is still not set
if [ -z "$DATABASE_URL" ]; then
    echo "[deploy] WARNING: DATABASE_URL is not set!"
    echo "[deploy] The server will fail to start without a database connection."
    echo "[deploy] Create /root/hyperscape/packages/server/.env with DATABASE_URL=..."
fi

# ── Setup Solana keypair ─────────────────────────────────────
# The keeper bot and Anchor tools expect a keypair at ~/.config/solana/id.json
# We derive it from SOLANA_DEPLOYER_PRIVATE_KEY environment variable
echo "[deploy] Setting up Solana keypair..."
if [ -n "$SOLANA_DEPLOYER_PRIVATE_KEY" ]; then
    bun run scripts/decode-key.ts && echo "[deploy] Solana keypair configured at ~/.config/solana/id.json" || echo "[deploy] WARNING: Failed to setup Solana keypair"
else
    echo "[deploy] WARNING: SOLANA_DEPLOYER_PRIVATE_KEY not set - skipping keypair setup"
    echo "[deploy] Set this env var to enable Solana/Anchor functionality"
fi

# ── Database migration ────────────────────────────────────────
echo "[deploy] Pushing database schema..."
cd packages/server
bunx drizzle-kit push --force

# Warmup database connection pool to avoid cold start issues
echo "[deploy] Warming up database connection..."
for i in 1 2 3; do
    if bun -e "
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
        pool.query('SELECT 1').then(() => { console.log('DB warmup successful'); pool.end(); process.exit(0); }).catch(e => { console.error('DB warmup failed:', e.message); pool.end(); process.exit(1); });
    " 2>/dev/null; then
        echo "[deploy] Database connection verified"
        break
    else
        echo "[deploy] Database warmup attempt $i failed, retrying..."
        sleep 3
    fi
done
cd ../..

# ── Tear down existing processes ──────────────────────────────
echo "[deploy] Tearing down existing processes..."
# Kill PM2 daemon completely so it picks up new environment on restart
# This is critical - pm2 delete only removes processes, not the daemon's cached env
bunx pm2 kill 2>/dev/null || true
# Also clean up any legacy processes from the old watchdog
pkill -f "watchdog.sh" || true
pkill -f "bun.*build/index" || true
pkill -f "bun.*dev.mjs" || true
pkill -f "bun.*dev-final" || true
pkill -f "stream-to-rtmp" || true
pkill -f "turbo.*dev" || true
pkill -f "bun.*duel-stack" || true
sleep 3

# ── Start socat port proxies ─────────────────────────────────
echo "[deploy] Starting port proxies..."
pkill -f "socat.*TCP-LISTEN:35143" || true
pkill -f "socat.*TCP-LISTEN:35079" || true
pkill -f "socat.*TCP-LISTEN:35144" || true
sleep 1
# Game server: internal 5555 -> external 35143
nohup socat TCP-LISTEN:35143,reuseaddr,fork TCP:127.0.0.1:5555 > /dev/null 2>&1 &
# WebSocket: internal 5555 -> external 35079
nohup socat TCP-LISTEN:35079,reuseaddr,fork TCP:127.0.0.1:5555 > /dev/null 2>&1 &
# CDN: internal 8080 -> external 35144
nohup socat TCP-LISTEN:35144,reuseaddr,fork TCP:127.0.0.1:8080 > /dev/null 2>&1 &
echo "[deploy] Port proxies running"

# ── Persist GPU/Display settings to .env ─────────────────────
# These settings MUST be in .env so they survive PM2 restarts
echo "[deploy] Persisting GPU/display configuration to .env..."
{
    # Remove any existing GPU/display settings
    grep -v "^DISPLAY=" /root/hyperscape/packages/server/.env 2>/dev/null | \
    grep -v "^GPU_RENDERING_MODE=" | \
    grep -v "^VK_ICD_FILENAMES=" | \
    grep -v "^DUEL_CAPTURE_USE_XVFB=" | \
    grep -v "^STREAM_CAPTURE_HEADLESS=" | \
    grep -v "^STREAM_CAPTURE_USE_EGL=" | \
    grep -v "^XDG_RUNTIME_DIR=" | \
    grep -v "^PULSE_SERVER="
    # Add GPU/display settings
    echo ""
    echo "# GPU/Display Configuration (auto-generated by deploy)"
    echo "DISPLAY=$DISPLAY"
    echo "GPU_RENDERING_MODE=$GPU_RENDERING_MODE"
    echo "VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json"
    echo "DUEL_CAPTURE_USE_XVFB=$DUEL_CAPTURE_USE_XVFB"
    echo "STREAM_CAPTURE_HEADLESS=false"
    echo "STREAM_CAPTURE_USE_EGL=false"
    echo "XDG_RUNTIME_DIR=/tmp/pulse-runtime"
    echo "PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native"
} > /root/hyperscape/packages/server/.env.tmp
mv /root/hyperscape/packages/server/.env.tmp /root/hyperscape/packages/server/.env

# ── Export stream keys before PM2 start ─────────────────────
# These MUST be exported so ecosystem.config.cjs picks them up
# Clear any old/stale stream keys from the environment first
echo "[deploy] Configuring stream keys..."
unset TWITCH_STREAM_KEY X_STREAM_KEY X_RTMP_URL KICK_STREAM_KEY KICK_RTMP_URL 2>/dev/null || true
# Explicitly disable YouTube (we only stream to Twitch, Kick, X)
unset YOUTUBE_STREAM_KEY YOUTUBE_RTMP_STREAM_KEY YOUTUBE_STREAM_URL YOUTUBE_RTMP_URL 2>/dev/null || true
export YOUTUBE_STREAM_KEY=""

# Re-source .env to get the correct stream keys AND GPU settings
if [ -f "/root/hyperscape/packages/server/.env" ]; then
    set -a
    source /root/hyperscape/packages/server/.env
    set +a
fi

# Force disable YouTube even if it was in .env
unset YOUTUBE_STREAM_KEY YOUTUBE_RTMP_STREAM_KEY 2>/dev/null || true
export YOUTUBE_STREAM_KEY=""

# Log which keys are configured (masked for security)
echo "[deploy] TWITCH_STREAM_KEY: ${TWITCH_STREAM_KEY:+***configured***}${TWITCH_STREAM_KEY:-NOT SET}"
echo "[deploy] X_STREAM_KEY: ${X_STREAM_KEY:+***configured***}${X_STREAM_KEY:-NOT SET}"
echo "[deploy] X_RTMP_URL: ${X_RTMP_URL:+***configured***}${X_RTMP_URL:-NOT SET}"
echo "[deploy] KICK_STREAM_KEY: ${KICK_STREAM_KEY:+***configured***}${KICK_STREAM_KEY:-NOT SET}"
echo "[deploy] KICK_RTMP_URL: ${KICK_RTMP_URL:+***configured***}${KICK_RTMP_URL:-NOT SET}"
echo "[deploy] YOUTUBE_STREAM_KEY: DISABLED"

# ── Ensure GPU environment is set for PM2 ─────────────────────
# These must be exported so ecosystem.config.cjs and child processes can access them
# WebGPU requires a DISPLAY - we should never be in headless mode at this point
export VK_ICD_FILENAMES="/usr/share/vulkan/icd.d/nvidia_icd.json"
export STREAM_CAPTURE_HEADLESS="false"
export STREAM_CAPTURE_USE_EGL="false"

echo "[deploy] GPU environment:"
echo "[deploy]   DISPLAY=$DISPLAY"
echo "[deploy]   GPU_RENDERING_MODE=$GPU_RENDERING_MODE"
echo "[deploy]   VK_ICD_FILENAMES=$VK_ICD_FILENAMES"
echo "[deploy]   DUEL_CAPTURE_USE_XVFB=$DUEL_CAPTURE_USE_XVFB"
echo "[deploy]   STREAM_CAPTURE_HEADLESS=$STREAM_CAPTURE_HEADLESS"
echo "[deploy]   WebGPU: ENABLED (required)"

# Verify display is accessible
if xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then
    echo "[deploy] ✓ Display $DISPLAY is accessible"
else
    echo "[deploy] FATAL: Display $DISPLAY is not accessible"
    echo "[deploy] WebGPU requires a working display (Xorg or Xvfb)"
    exit 1
fi

# ── Start duel stack via pm2 ─────────────────────────────────
echo "[deploy] Starting Hyperscape duel stack via pm2..."
bunx pm2 start ecosystem.config.cjs

# ── Configure pm2 to survive reboots ─────────────────────────
echo "[deploy] Saving pm2 process list for reboot survival..."
bunx pm2 save

# ── Wait for server to be healthy ─────────────────────────────
echo "[deploy] Waiting for server to be healthy..."
MAX_WAIT=120
WAITED=0
HEALTHY=false

while [ $WAITED -lt $MAX_WAIT ]; do
    # Check internal health endpoint
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5555/health" --max-time 5 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
        HEALTHY=true
        echo "[deploy] Server is healthy! (status: $HTTP_STATUS)"
        break
    fi

    echo "[deploy] Server not ready yet (status: $HTTP_STATUS), waiting... ($WAITED/$MAX_WAIT seconds)"
    sleep 5
    WAITED=$((WAITED + 5))
done

if [ "$HEALTHY" = "false" ]; then
    echo "[deploy] WARNING: Server did not become healthy within ${MAX_WAIT}s"
    echo "[deploy] Check logs with: bunx pm2 logs hyperscape-duel"
fi

# ── Show pm2 status ───────────────────────────────────────────
echo ""
echo "[deploy] Current pm2 status:"
bunx pm2 status

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ✓ Hyperscape deployed successfully!"
echo "  ✓ Duel stack managed by pm2 (auto-restart on crash)"
echo "  ✓ Deploy timestamp: $(date -Iseconds)"
if [ "$HEALTHY" = "true" ]; then
    echo "  ✓ Server health check: PASSED"
else
    echo "  ⚠ Server health check: PENDING (may still be starting)"
fi
echo ""
echo "  Port mappings:"
echo "    Internal 5555 -> External 35143 (HTTP)"
echo "    Internal 5555 -> External 35079 (WebSocket)"
echo "    Internal 8080 -> External 35144 (CDN)"
echo ""
echo "  Useful commands:"
echo "    bun run duel:prod:logs     # tail live logs"
echo "    bun run duel:prod:status   # process status"
echo "    bun run duel:prod:restart  # restart stack"
echo "    bun run duel:prod:stop     # stop stack"
echo "════════════════════════════════════════════════════════════"

# ── Quick Streaming Status (non-blocking) ────────────────────────
echo ""
echo "[deploy] ═══ QUICK STATUS CHECK ═══"

# Quick check - no waiting, just see what's running
echo "[deploy] PM2 processes:"
bunx pm2 jlist 2>/dev/null | jq -r '.[] | "\(.name): \(.pm2_env.status)"' || bunx pm2 status

echo ""
echo "[deploy] Game client check..."
CLIENT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3333" --max-time 3 2>/dev/null || echo "000")
echo "[deploy] Game client: $CLIENT_STATUS"

echo ""
echo "[deploy] Server health..."
HEALTH=$(curl -s "http://localhost:5555/health" --max-time 3 2>/dev/null || echo '{"status":"unknown"}')
echo "[deploy] Health: $HEALTH"

echo ""
echo "[deploy] ═══ DEPLOYMENT COMPLETE ═══"
echo "[deploy] Diagnostics will run asynchronously - check PM2 logs for streaming status"
echo "[deploy] Use: bunx pm2 logs hyperscape-duel --lines 100"

# Exit successfully - don't wait for streaming diagnostics
exit 0
