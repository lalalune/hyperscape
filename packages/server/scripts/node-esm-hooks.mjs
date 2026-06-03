/**
 * Node.js ESM resolution hooks
 *
 * Fixes two Bun-isms in workspace packages (e.g., @hyperforge/procgen)
 * whose TypeScript build output relies on Bun's lenient module resolution:
 *   1. Extensionless imports: `from "./Foo"` → `from "./Foo.js"`
 *   2. Directory imports:     `from "./bar"` → `from "./bar/index.js"`
 */

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (
      (err.code === "ERR_MODULE_NOT_FOUND" ||
        err.code === "ERR_UNSUPPORTED_DIR_IMPORT") &&
      !specifier.endsWith(".js") &&
      !specifier.endsWith(".mjs") &&
      !specifier.endsWith(".cjs") &&
      !specifier.endsWith(".json")
    ) {
      // Try appending .js (extensionless file import)
      try {
        return await nextResolve(specifier + ".js", context);
      } catch {
        // ignore
      }
      // Try appending /index.js (directory import)
      try {
        return await nextResolve(specifier + "/index.js", context);
      } catch {
        // ignore
      }
    }
    throw err;
  }
}
