import { assertHyperiaNodeVersion } from "./node-runtime-policy.mjs";

assertHyperiaNodeVersion(process.version);
await import("../packages/server/dist/index.js");
