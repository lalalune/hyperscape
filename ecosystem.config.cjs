/**
 * PM2 Ecosystem Config – Hyperscape Duel Stack
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs          # start
 *   pm2 restart ecosystem.config.cjs        # restart all
 *   pm2 stop ecosystem.config.cjs           # stop all
 *   pm2 delete ecosystem.config.cjs         # remove from pm2
 *   pm2 logs hyperscape-duel                # tail logs
 *
 * The duel-stack.mjs orchestrator already manages sub-processes internally
 * (game server, client, bots, RTMP bridge, betting app, keeper bot).
 * If ANY critical sub-process dies, the orchestrator tears everything down
 * and exits with code 1. PM2 then restarts it from scratch, giving us an
 * infinite self-healing loop.
 */
module.exports = {
    apps: [
        {
            name: "hyperscape-duel",
            script: "scripts/duel-stack.mjs",
            interpreter: "bun",
            args: "--skip-betting --skip-bots",
            cwd: __dirname,
            // Restart policy
            autorestart: true,
            max_restarts: 999999,
            min_uptime: "10s",        // consider healthy after 10s
            restart_delay: 5000,      // 5s cooldown between restarts
            // Crash-loop protection: after 15 rapid restarts, wait 60s
            exp_backoff_restart_delay: 1000,
            // Resource limits – restart if memory exceeds 4GB
            max_memory_restart: "4G",
            // Logging
            error_file: "logs/duel-error.log",
            out_file: "logs/duel-out.log",
            merge_logs: true,
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
            // Environment
            env: {
                NODE_ENV: "production",
                STREAMING_DUEL_ENABLED: "true",
                DUEL_MARKET_MAKER_ENABLED: "true",
                DUEL_BETTING_ENABLED: "false",
                ARENA_SERVICE_ENABLED: "false",
                DUEL_SKIP_CHAIN_SETUP: "true",
                USE_LOCAL_POSTGRES: "false",
                // Production PostgreSQL - reads from environment or falls back to local default
                DATABASE_URL:
                    process.env.DATABASE_URL ||
                    process.env.POSTGRES_URL ||
                    "postgresql://hyperscape:hyperscape_dev_password@localhost:5488/hyperscape",
                SOLANA_RPC_URL: "https://api.devnet.solana.com",
                SOLANA_WS_URL: "wss://api.devnet.solana.com/",
                // CDN URL for assets (avatars, models, textures)
                // Required for production - local /game-assets/ serves Git LFS pointers
                PUBLIC_CDN_URL: "https://assets.hyperscape.club",
                DUEL_ALLOW_INHERITED_CDN_URL: "true",
                // Solana Arena keypairs - base58 encoded private keys
                // These are used for on-chain market creation and settlement
                // SOLANA_ARENA_AUTHORITY_SECRET is the fee payer for all transactions
                // Set SOLANA_DEPLOYER_PRIVATE_KEY env var to configure all three at once
                SOLANA_ARENA_AUTHORITY_SECRET:
                    process.env.SOLANA_ARENA_AUTHORITY_SECRET ||
                    process.env.SOLANA_DEPLOYER_PRIVATE_KEY ||
                    "",
                SOLANA_ARENA_REPORTER_SECRET:
                    process.env.SOLANA_ARENA_REPORTER_SECRET ||
                    process.env.SOLANA_DEPLOYER_PRIVATE_KEY ||
                    "",
                SOLANA_ARENA_KEEPER_SECRET:
                    process.env.SOLANA_ARENA_KEEPER_SECRET ||
                    process.env.SOLANA_DEPLOYER_PRIVATE_KEY ||
                    "",
                // Market maker keypair (for liquidity seeding)
                // Set SOLANA_MM_PRIVATE_KEY env var to configure
                SOLANA_MM_PRIVATE_KEY: process.env.SOLANA_MM_PRIVATE_KEY || "",
                DISABLE_RATE_LIMIT: "true",
                ALLOW_DESTRUCTIVE_CHANGES: "false",
                AUTO_START_AGENTS: "true",
                AUTO_START_AGENTS_MAX: "10",
                MALLOC_TRIM_THRESHOLD_: "-1",
                MIMALLOC_ALLOW_DECOMMIT: "0",
                MIMALLOC_ALLOW_RESET: "0",
                MIMALLOC_PAGE_RESET: "0",
                MIMALLOC_PURGE_DELAY: "1000000",
                // Stream Capture Configuration
                // Use CDP mode for reliable frame capture
                STREAM_CAPTURE_MODE: "cdp",
                // Run headful with Xvfb for GPU access (set by DUEL_CAPTURE_USE_XVFB)
                STREAM_CAPTURE_HEADLESS: "false",
                // Use Chrome Dev channel (google-chrome-unstable) for WebGPU support
                // Explicit path is more reliable than Playwright channel resolution
                STREAM_CAPTURE_EXECUTABLE: "/usr/bin/google-chrome-unstable",
                STREAM_CAPTURE_CHANNEL: "chrome-dev",
                // Use vulkan ANGLE backend with NVIDIA hardware Vulkan
                // Force only NVIDIA ICD to avoid conflicts with broken Mesa ICDs
                VK_ICD_FILENAMES: "/usr/share/vulkan/icd.d/nvidia_icd.json",
                STREAM_CAPTURE_ANGLE: "vulkan",
                STREAM_CAPTURE_WIDTH: "1280",
                STREAM_CAPTURE_HEIGHT: "720",
                // WebGPU is REQUIRED - there is no WebGL fallback
                // This env var is kept for diagnostics but always false
                STREAM_CAPTURE_DISABLE_WEBGPU: "false",
                FFMPEG_PATH: "/usr/bin/ffmpeg",
                DUEL_DISABLE_BRIDGE_CAPTURE: "false",
                // Audio streaming configuration
                STREAM_AUDIO_ENABLED: "true",
                PULSE_AUDIO_DEVICE: "chrome_audio.monitor",
                PULSE_SERVER: "unix:/tmp/pulse-runtime/pulse/native",
                XDG_RUNTIME_DIR: "/tmp/pulse-runtime",
                // Stream health monitoring
                STREAM_CAPTURE_RECOVERY_TIMEOUT_MS: "30000",
                STREAM_CAPTURE_RECOVERY_MAX_FAILURES: "6",
                // Stream encoding optimization
                // STREAM_LOW_LATENCY: "true" enables zerolatency tune (faster playback start, higher bitrate)
                // Leave false for better quality/compression with B-frames
                STREAM_LOW_LATENCY: "false",
                // GOP size (keyframe interval) - lower = faster playback start but larger file size
                // Default is 60 frames (2 seconds at 30fps) - reduce to 30 for faster startup
                STREAM_GOP_SIZE: "60",
                // Streaming destinations: Twitch, Kick, X (no YouTube)
                // YouTube explicitly disabled - empty string prevents rtmp-bridge from adding it
                YOUTUBE_STREAM_KEY: "",
                YOUTUBE_RTMP_STREAM_KEY: "",
                // Twitch - set via TWITCH_STREAM_KEY env var or GitHub secret
                TWITCH_STREAM_KEY: process.env.TWITCH_STREAM_KEY || "",
                // Kick (uses RTMPS) - set via KICK_STREAM_KEY and KICK_RTMP_URL env vars
                KICK_STREAM_KEY: process.env.KICK_STREAM_KEY || "",
                KICK_RTMP_URL: process.env.KICK_RTMP_URL || "",
                // X/Twitter - set via X_STREAM_KEY and X_RTMP_URL env vars
                X_STREAM_KEY: process.env.X_STREAM_KEY || "",
                X_RTMP_URL: process.env.X_RTMP_URL || "",
                // Canonical platform for anti-cheat timing (twitch has lower latency than youtube)
                STREAMING_CANONICAL_PLATFORM: "twitch",
                // Override public data delay to 0 (no delay)
                STREAMING_PUBLIC_DELAY_MS: "0",
                // WebGPU is REQUIRED - WebGL will NOT work (TSL shaders require WebGPU)
                // This variable is deprecated but kept for backwards compatibility
                DUEL_FORCE_WEBGL_FALLBACK: "false",
                GAME_URL: "http://localhost:3333/?page=stream",
                GAME_FALLBACK_URLS:
                    "http://localhost:3333/?page=stream,http://localhost:3333/?embedded=true&mode=spectator,http://localhost:3333/",
                // WebGPU REQUIRES hardware GPU rendering with a display (Xorg or Xvfb)
                // Headless mode does NOT support WebGPU - deploy-vast.sh enforces this
                DUEL_CAPTURE_USE_XVFB: process.env.DUEL_CAPTURE_USE_XVFB || "false",
                DISPLAY: process.env.DISPLAY || ":99",
                // Headless mode is NOT supported for WebGPU - these should always be false
                STREAM_CAPTURE_HEADLESS: "false",
                STREAM_CAPTURE_USE_EGL: process.env.STREAM_CAPTURE_USE_EGL || "false",
                // Use ozone-platform=headless for GPU rendering without X11
                // This is tried by deploy-vast.sh and set if it works
                STREAM_CAPTURE_OZONE_HEADLESS: process.env.STREAM_CAPTURE_OZONE_HEADLESS || "false",
                GPU_RENDERING_MODE: process.env.GPU_RENDERING_MODE || "xorg",
                // Stabilize long-running streams by avoiding per-agent DuelCombatAI state polling churn.
                STREAMING_DUEL_COMBAT_AI_ENABLED: "false",
                SERVER_RUNTIME_MAX_TICKS_PER_FRAME: "1",
                SERVER_RUNTIME_MIN_DELAY_MS: "10",
                GAME_STATE_POLL_TIMEOUT_MS: "5000",
                GAME_STATE_POLL_INTERVAL_MS: "3000",
                DUEL_RUNTIME_HEALTH_INTERVAL_MS: "15000",
                DUEL_RUNTIME_HEALTH_MAX_FAILURES: "30",
            },
        },
    ],
};
