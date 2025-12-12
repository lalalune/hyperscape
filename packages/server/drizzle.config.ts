import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env" });

// Build DATABASE_URL from individual env vars if not set
const getDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  if (process.env.POSTGRES_URL) {
    return process.env.POSTGRES_URL;
  }

  // Build from individual POSTGRES_* env vars
  const user = process.env.POSTGRES_USER || "hyperscape";
  const password = process.env.POSTGRES_PASSWORD || "hyperscape_dev";
  const db = process.env.POSTGRES_DB || "hyperscape";
  const port = process.env.POSTGRES_PORT || "5432";
  const host = "localhost";

  return `postgresql://${user}:${password}@${host}:${port}/${db}`;
};

export default defineConfig({
  schema: "./src/database/schema.ts",
  out: "./src/database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
  verbose: true,
  strict: true,
});
