import bs58 from "bs58";
import fs from "fs";
import path from "path";
import os from "os";

const deployerKey = process.env.SOLANA_DEPLOYER_PRIVATE_KEY;
if (!deployerKey) throw new Error("Missing SOLANA_DEPLOYER_PRIVATE_KEY");

const keypairBytes = bs58.decode(deployerKey);

// Default Solana CLI keypair location
const solanaConfigDir = path.join(os.homedir(), ".config", "solana");
const keypairPath = path.join(solanaConfigDir, "id.json");

// Create directory if it doesn't exist
if (!fs.existsSync(solanaConfigDir)) {
  fs.mkdirSync(solanaConfigDir, { recursive: true });
  console.log(`Created directory: ${solanaConfigDir}`);
}

// Write keypair as JSON array of bytes (Solana CLI format)
fs.writeFileSync(keypairPath, JSON.stringify(Array.from(keypairBytes)));
console.log(`Wrote Solana keypair to: ${keypairPath}`);

// Also write to legacy location for backwards compatibility
fs.writeFileSync(
  "deployer-keypair.json",
  JSON.stringify(Array.from(keypairBytes)),
);
console.log("Also wrote deployer-keypair.json (legacy)");
