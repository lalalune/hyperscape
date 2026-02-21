import { createPublicClient, http } from "viem";
import { foundry } from "viem/chains";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import net from "net";
import os from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../../../");
const contractsDir = path.join(workspaceRoot, "packages/contracts");
const worldsJsonPath = path.join(contractsDir, "worlds.json");
const serverEnvPath = path.join(workspaceRoot, "packages/server/.env");

const foundryBin = path.join(os.homedir(), ".foundry", "bin");
const envPATH = [process.env.PATH, foundryBin].filter(Boolean).join(path.delimiter);

const ANVIL_PORT = 8545;
const ANVIL_HOST = "127.0.0.1";

const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
};

function log(msg, color = colors.reset) {
    console.log(`${color}[ChainSetup] ${msg}${colors.reset}`);
}

async function isPortInUse(port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(500);
        socket.on("connect", () => {
            socket.destroy();
            resolve(true);
        });
        socket.on("timeout", () => {
            socket.destroy();
            resolve(false);
        });
        socket.on("error", () => {
            resolve(false);
        });
        socket.connect(port, ANVIL_HOST);
    });
}

async function startAnvil() {
    log("Anvil is not running. Starting Anvil...", colors.yellow);

    const anvil = spawn("anvil", ["--block-time", "1"], {
        detached: true,
        stdio: "ignore",
        env: { ...process.env, PATH: envPATH },
    });

    anvil.unref();

    log("Waiting for Anvil to be ready...", colors.yellow);

    let retries = 0;
    while (retries < 20) {
        if (await isPortInUse(ANVIL_PORT)) {
            log("Anvil started successfully.", colors.green);
            return;
        }
        await new Promise((r) => setTimeout(r, 500));
        retries++;
    }

    throw new Error("Failed to start Anvil.");
}

function getWorldAddressFromConfig() {
    if (!fs.existsSync(worldsJsonPath)) return null;
    try {
        const data = JSON.parse(fs.readFileSync(worldsJsonPath, "utf-8"));
        return data["31337"]?.address;
    } catch (e) {
        return null;
    }
}

function updateServerEnv(address) {
    if (!fs.existsSync(serverEnvPath)) {
        log("Server .env not found, skipping update.", colors.yellow);
        return;
    }

    let envContent = fs.readFileSync(serverEnvPath, "utf-8");
    const regex = /^WORLD_ADDRESS=.*$/m;

    if (regex.test(envContent)) {
        const currentMatch = envContent.match(regex);
        if (currentMatch[0].includes(address)) {
            // Already matches
            return;
        }
        log(`Updating WORLD_ADDRESS in .env to ${address}`, colors.cyan);
        envContent = envContent.replace(regex, `WORLD_ADDRESS=${address}`);
    } else {
        log(`Adding WORLD_ADDRESS to .env: ${address}`, colors.cyan);
        envContent += `\nWORLD_ADDRESS=${address}\n`;
    }

    fs.writeFileSync(serverEnvPath, envContent);
}

async function deployContracts() {
    log("Deploying contracts...", colors.blue);

    return new Promise((resolve, reject) => {
        // specific command to run local deployment
        const child = spawn("bun", ["run", "deploy:local"], {
            cwd: contractsDir,
            stdio: "inherit",
            env: { ...process.env, PATH: envPATH },
        });

        child.on("error", (err) => {
            log(`Deployment failed to start: ${err.message}`, colors.red);
            reject(err);
        });

        child.on("exit", (code) => {
            if (code === 0) {
                log("Contracts deployed successfully.", colors.green);
                resolve();
            } else {
                log(`Deployment failed with code ${code}`, colors.red);
                reject(new Error(`Deployment failed with code ${code}`));
            }
        });
    });
}

async function checkAndSetup() {
    try {
        // 1. Check Anvil
        if (!(await isPortInUse(ANVIL_PORT))) {
            await startAnvil();
        } else {
            log("Anvil is already running.", colors.green);
        }

        // 2. Check World Config
        let worldAddress = getWorldAddressFromConfig();

        // 3. Verify Code on Chain
        let needDeploy = false;
        if (!worldAddress) {
            log("World address not found in worlds.json. Deploying...", colors.yellow);
            needDeploy = true;
        } else {
            const client = createPublicClient({
                chain: foundry,
                transport: http(`http://${ANVIL_HOST}:${ANVIL_PORT}`),
            });

            const code = await client.getCode({ address: worldAddress });
            if (!code || code === "0x") {
                log(`No contract found at ${worldAddress}. Deploying...`, colors.yellow);
                needDeploy = true;
            } else {
                log(`World contract verified at ${worldAddress}.`, colors.green);
            }
        }

        if (needDeploy) {
            await deployContracts();
            // Refetch address after deploy
            worldAddress = getWorldAddressFromConfig();
            if (!worldAddress) throw new Error("Deployment succeeded but worlds.json is empty.");
        }

        // 4. Sync to Server Env
        updateServerEnv(worldAddress);

        log("Setup complete. Starting server...", colors.green);

    } catch (error) {
        console.error(`${colors.red}Setup failed:${colors.reset}`, error);
        process.exit(1);
    }
}

checkAndSetup();
