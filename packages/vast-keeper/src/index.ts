import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const POLL_INTERVAL_MS = Number.parseInt(
  process.env.POLL_INTERVAL_MS || "60000",
  10,
);
const SEARCH_QUERY =
  process.env.VAST_SEARCH_QUERY ||
  "reliability > 0.98 gpu_name in [RTX_4090, RTX_4080, RTX_3090, A6000] num_gpus=1 rented=False external=false geolocation=US";
const API_KEY = process.env.VAST_API_KEY;
const TARGET_IMAGE =
  process.env.VAST_IMAGE || "nvidia/cuda:12.4.0-runtime-ubuntu22.04";
const DISK_SIZE_GB = Number.parseInt(process.env.VAST_DISK_GB || "120", 10);
const RTMP_MULTIPLEXER_URL = process.env.RTMP_MULTIPLEXER_URL;

// Health check configuration
const HEALTH_CHECK_ENABLED =
  process.env.KEEPER_HEALTH_CHECK_ENABLED !== "false";
const HEALTH_CHECK_URL = process.env.KEEPER_HEALTH_CHECK_URL; // e.g., http://your-server:35143/health
const HEALTH_CHECK_TIMEOUT_MS = Number.parseInt(
  process.env.KEEPER_HEALTH_CHECK_TIMEOUT_MS || "10000",
  10,
);
const HEALTH_CHECK_MAX_FAILURES = Number.parseInt(
  process.env.KEEPER_HEALTH_CHECK_MAX_FAILURES || "5",
  10,
);
const HEALTH_CHECK_INTERVAL_MS = Number.parseInt(
  process.env.KEEPER_HEALTH_CHECK_INTERVAL_MS || "30000",
  10,
);

// Track health check state
const healthState = {
  consecutiveFailures: 0,
  lastCheckTime: 0,
  lastHealthy: true,
};

// Interfaces
interface VastInstance {
  id: number;
  actual_status: string;
  ssh_host: string;
  ssh_port: number;
  [key: string]: unknown;
}

interface VastOffer {
  id: number;
  dph: number;
  gpu_name: string;
  [key: string]: unknown;
}

if (!API_KEY) {
  console.error(
    "[Keeper] FATAL: VAST_API_KEY environment variable is required.",
  );
  process.exit(1);
}

const SSH_KEY_PATH =
  process.env.SSH_KEY_PATH || path.join(process.env.HOME || "", ".ssh/id_rsa");

async function checkApiKeyFile() {
  const vastDir = path.join(process.env.HOME || "", ".config/vastai");
  const keyFile = path.join(vastDir, "vast_api_key");
  try {
    await fs.mkdir(vastDir, { recursive: true });
    const existing = await fs.readFile(keyFile, "utf-8").catch(() => "");
    if (existing.trim() !== API_KEY?.trim()) {
      await fs.writeFile(keyFile, API_KEY?.trim() || "", { mode: 0o600 });
      console.log(
        "[Keeper] Wrote VAST_API_KEY to ~/.config/vastai/vast_api_key",
      );
    }
  } catch (err) {
    console.warn("[Keeper] Failed to write vast_api_key file:", err);
  }
}

async function runVastCmd(args: string[]): Promise<unknown> {
  const cmdArgs = [...args, "--raw"];
  console.log(`[Keeper] Running: vastai ${args.join(" ")}`);
  const proc = spawnSync("vastai", cmdArgs, { encoding: "utf-8" });

  if (proc.error) {
    throw new Error(`Failed to execute vastai: ${proc.error.message}`);
  }

  try {
    const out = proc.stdout.trim();
    // The vastai CLI sometimes outputs non-JSON info messages before the JSON.
    // Try to find the first '[' or '{' to extract just the JSON part.
    const jsonStart = out.search(/[{[]/);
    if (jsonStart === -1) {
      throw new Error("No JSON found in vastai output");
    }
    return JSON.parse(out.substring(jsonStart));
  } catch (err) {
    throw new Error(
      `Failed to parse vastai output (exit code ${proc.status}):\n${proc.stdout}\n${proc.stderr}`,
    );
  }
}

async function getActiveInstances(): Promise<VastInstance[]> {
  const instances = (await runVastCmd(["show", "instances"])) as VastInstance[];
  // Filter out instances that are stopped or exited
  return instances.filter(
    (i) => i.actual_status === "running" || i.actual_status === "loading",
  );
}

async function findOffers(): Promise<VastOffer[]> {
  const offers = (await runVastCmd([
    "search",
    "offers",
    SEARCH_QUERY,
  ])) as VastOffer[];
  if (!offers || offers.length === 0) {
    throw new Error("No offers found matching query.");
  }
  // Sort logic: Vast returns them pre-ordered by score usually, but let's grab the cheapest reliable one
  offers.sort((a, b) => a.dph - b.dph);
  return offers;
}

async function createInstance(offerId: number): Promise<string> {
  console.log(`[Keeper] Creating instance from offer ${offerId}...`);
  const result = (await runVastCmd([
    "create",
    "instance",
    String(offerId),
    "--image",
    TARGET_IMAGE,
    "--disk",
    String(DISK_SIZE_GB),
    "--ssh",
  ])) as { success?: boolean; new_contract?: string };

  if (!result?.success || !result?.new_contract) {
    throw new Error(`Failed to create instance: ${JSON.stringify(result)}`);
  }
  console.log(`[Keeper] Instance Created! ID: ${result.new_contract}`);
  return result.new_contract;
}

async function waitForSsh(
  sshHost: string,
  sshPort: number,
  maxWaitMs = 600000,
): Promise<boolean> {
  console.log(`[Keeper] Waiting for SSH on ${sshHost}:${sshPort}...`);
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    // Use a 5 second connect timeout
    const check = spawnSync(
      "ssh",
      [
        "-o",
        "StrictHostKeyChecking=no",
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=5",
        "-p",
        String(sshPort),
        `root@${sshHost}`,
        "echo 'ready'",
      ],
      { encoding: "utf-8" },
    );

    if (check.status === 0 && check.stdout.includes("ready")) {
      console.log("[Keeper] SSH is ready!");
      return true;
    }

    console.log(
      `[Keeper] SSH not ready yet (exit ${check.status}). Retrying in 10s...`,
    );
    await new Promise((r) => setTimeout(r, 10000));
  }
  return false;
}

/**
 * Check if the server is healthy by calling the health endpoint
 */
async function checkServerHealth(healthUrl: string): Promise<boolean> {
  if (!HEALTH_CHECK_ENABLED || !healthUrl) {
    return true; // Skip health check if disabled or no URL
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      HEALTH_CHECK_TIMEOUT_MS,
    );

    const response = await fetch(healthUrl, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      healthState.consecutiveFailures = 0;
      healthState.lastHealthy = true;
      return true;
    }

    console.warn(`[Keeper] Health check failed with status ${response.status}`);
    healthState.consecutiveFailures++;
    healthState.lastHealthy = false;
    return false;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[Keeper] Health check error: ${message}`);
    healthState.consecutiveFailures++;
    healthState.lastHealthy = false;
    return false;
  }
}

/**
 * Check streaming health via the streaming state endpoint
 */
async function checkStreamingHealth(baseUrl: string): Promise<boolean> {
  const streamingUrl = `${baseUrl}/api/streaming/state`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      HEALTH_CHECK_TIMEOUT_MS,
    );

    const response = await fetch(streamingUrl, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = (await response.json()) as { cycle?: unknown };
      // Check if we have valid streaming data
      if (data && data.cycle) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Destroy an unhealthy instance
 */
async function destroyInstance(instanceId: number): Promise<void> {
  console.log(`[Keeper] Destroying unhealthy instance ${instanceId}...`);
  try {
    await runVastCmd(["destroy", "instance", String(instanceId)]);
    console.log(`[Keeper] Instance ${instanceId} destroyed.`);
  } catch (err) {
    console.error(`[Keeper] Failed to destroy instance ${instanceId}:`, err);
  }
}

/**
 * Build health check URL from instance info
 */
function buildHealthUrl(instance: VastInstance): string | null {
  if (HEALTH_CHECK_URL) {
    return HEALTH_CHECK_URL;
  }

  // Try to build URL from instance ports
  // Vast.ai typically maps internal ports to external ports
  // The common pattern is internal 5555 -> external 35143
  const sshHost = instance.ssh_host;
  if (!sshHost) return null;

  // Try port 35143 (common mapping for game server)
  return `http://${sshHost}:35143/health`;
}

async function deployToServer(sshHost: string, sshPort: number) {
  console.log(
    `[Keeper] Starting deployment process onto ${sshHost}:${sshPort}...`,
  );

  // First, we need to clone the repo or copy scripts if it's a fresh machine.
  // For simplicity, we assume the deploy-vast.sh handles the full bootstrap
  // including pulling from git. Let's just run a bootstrap command.

  // Ensure git is installed and clone the repo if it doesn't exist
  const envVars = Object.entries(process.env)
    .filter(
      ([k]) =>
        k !== "VAST_API_KEY" &&
        k !== "SSH_KEY_PATH" &&
        !k.startsWith("RAILWAY_") &&
        !k.startsWith("npm_") &&
        k !== "PATH" &&
        k !== "HOME" &&
        k !== "PWD",
    )
    .map(([k, v]) => `${k}='${(v || "").replace(/'/g, "'\\''")}'`)
    .join("\\n");

  const bootstrapCmd = `
        apt-get update && apt-get install -y git curl unzip;
        if [ ! -d /root/hyperscape ]; then
            git clone -b hackathon https://github.com/HyperscapeAI/hyperscape.git /root/hyperscape;
        fi;
        cd /root/hyperscape;
        
        # Install bun if missing
        if ! command -v bun &> /dev/null; then
            curl -fsSL https://bun.sh/install | bash;
        fi;
        export PATH="/root/.bun/bin:$PATH";
        
        # Write environment variables
        printf "%b\\n" "${envVars}" > packages/server/.env;

        chmod +x scripts/deploy-vast.sh;
        ./scripts/deploy-vast.sh;
    `;

  return new Promise<void>((resolve, reject) => {
    const proc = spawn(
      "ssh",
      [
        "-o",
        "StrictHostKeyChecking=no",
        "-p",
        String(sshPort),
        `root@${sshHost}`,
        bootstrapCmd,
      ],
      { stdio: "inherit" },
    );

    proc.on("close", (code) => {
      if (code === 0) {
        console.log("[Keeper] Deployment script finished successfully.");
        resolve();
      } else {
        reject(new Error(`Deployment failed with exit code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

async function loop() {
  console.log(
    `[Keeper] Starting polling loop. (Interval: ${POLL_INTERVAL_MS}ms)`,
  );

  while (true) {
    try {
      await checkApiKeyFile();

      console.log("[Keeper] Checking active instances...");
      const instances = await getActiveInstances();

      if (instances.length === 0) {
        console.log(
          "[Keeper] No running instances found! We need to provision one.",
        );

        const offers = await findOffers();
        const bestOffer = offers[0];

        if (!bestOffer) {
          throw new Error("Offers array is empty unexpectedly.");
        }

        console.log(
          `[Keeper] Found ${offers.length} offers. Selecting cheapest reliable: Offer ID ${bestOffer.id} ($${bestOffer.dph}/hr, GPU: ${bestOffer.gpu_name})`,
        );

        const contractIdStr = await createInstance(bestOffer.id);
        const contractId = Number.parseInt(contractIdStr, 10);

        // Poll until the machine is listed as 'running' and exposes SSH
        console.log(
          `[Keeper] Instance ${contractId} starting, waiting for networking...`,
        );
        let instanceInfo: VastInstance | null = null;
        while (true) {
          const allInstances = (await runVastCmd([
            "show",
            "instances",
          ])) as VastInstance[];
          instanceInfo = allInstances.find((i) => i.id === contractId) || null;

          if (
            instanceInfo?.actual_status === "running" &&
            instanceInfo?.ssh_host &&
            instanceInfo?.ssh_port
          ) {
            break;
          }
          console.log(
            `[Keeper] Instance status: ${instanceInfo?.actual_status || "unknown"}. Waiting 15s...`,
          );
          await new Promise((r) => setTimeout(r, 15000));
        }

        console.log(
          `[Keeper] Instance ${contractId} is running at ${instanceInfo.ssh_host}:${instanceInfo.ssh_port}`,
        );

        const ready = await waitForSsh(
          instanceInfo.ssh_host,
          instanceInfo.ssh_port,
        );
        if (!ready) {
          throw new Error(
            `Timed out waiting for SSH on new instance ${contractId}`,
          );
        }

        await deployToServer(instanceInfo.ssh_host, instanceInfo.ssh_port);
      } else {
        console.log(`[Keeper] Found ${instances.length} running instances.`);

        // Health check the running instance
        for (const instance of instances) {
          const healthUrl = buildHealthUrl(instance);

          if (healthUrl && HEALTH_CHECK_ENABLED) {
            const timeSinceLastCheck = Date.now() - healthState.lastCheckTime;

            if (timeSinceLastCheck >= HEALTH_CHECK_INTERVAL_MS) {
              healthState.lastCheckTime = Date.now();

              console.log(`[Keeper] Checking server health at ${healthUrl}...`);
              const isHealthy = await checkServerHealth(healthUrl);

              if (isHealthy) {
                console.log(`[Keeper] Instance ${instance.id} is healthy.`);

                // Also check streaming if we have a base URL
                const baseUrl = healthUrl.replace(/\/health$/, "");
                const streamingHealthy = await checkStreamingHealth(baseUrl);
                if (streamingHealthy) {
                  console.log(`[Keeper] Streaming is active.`);
                } else {
                  console.warn(
                    `[Keeper] Streaming may not be active (this is OK during idle periods).`,
                  );
                }
              } else {
                console.warn(
                  `[Keeper] Instance ${instance.id} health check failed (${healthState.consecutiveFailures}/${HEALTH_CHECK_MAX_FAILURES}).`,
                );

                if (
                  healthState.consecutiveFailures >= HEALTH_CHECK_MAX_FAILURES
                ) {
                  console.error(
                    `[Keeper] Instance ${instance.id} has failed ${HEALTH_CHECK_MAX_FAILURES} consecutive health checks. Destroying and reprovisioning...`,
                  );

                  // Destroy the unhealthy instance
                  await destroyInstance(instance.id);
                  healthState.consecutiveFailures = 0;
                  healthState.lastHealthy = true;

                  // The next loop iteration will provision a new instance
                  console.log(
                    "[Keeper] Will provision a new instance on next iteration.",
                  );
                }
              }
            } else {
              console.log(
                `[Keeper] Skipping health check (last check ${Math.floor(timeSinceLastCheck / 1000)}s ago, interval ${Math.floor(HEALTH_CHECK_INTERVAL_MS / 1000)}s).`,
              );
            }
          } else {
            console.log(
              `[Keeper] Health checks disabled or no URL available. Instance ${instance.id} status: ${instance.actual_status}`,
            );
          }
        }
      }
    } catch (err) {
      console.error("[Keeper] Error during loop iteration:", err);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// Ensure vastai CLI is installed
try {
  const check = spawnSync("vastai", ["--version"], {
    encoding: "utf-8",
  });
  if (check.status === 0) {
    console.log(`[Keeper] vastai version: ${check.stdout.trim()}`);
  } else {
    console.warn("[Keeper] vastai CLI check failed:", check.stderr?.trim());
  }
} catch (e) {
  console.warn(
    "[Keeper] vastai CLI not found. Please ensure it is installed (pip install vastai).",
  );
}

loop().catch((err) => {
  console.error("[Keeper] Fatal error:", err);
  process.exit(1);
});
