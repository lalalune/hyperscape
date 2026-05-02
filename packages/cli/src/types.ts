/**
 * Shared types for `@hyperforge/cli` commands.
 *
 * Each command returns a structured `CommandResult`. The bin
 * entrypoint takes the result, prints the appropriate format, and
 * sets the process exit code. Keeping commands as pure functions
 * makes them unit-testable without spawning a subprocess and lets
 * other tools (Eliza, MCP, future libraries) call them directly.
 */

/**
 * Exit codes. Match the conventions used elsewhere in the codebase
 * and POSIX-ish norms.
 *
 *   0 — success
 *   1 — bad CLI usage (missing arg, unknown subcommand)
 *   2 — file/IO error (missing catalog, unwritable directory)
 *   3 — validation error (spec invalid, widget id not found)
 *   4 — missing required flag (R4.P14: scaffolder no longer
 *       defaults the target plugin path)
 */
export type ExitCode = 0 | 1 | 2 | 3 | 4;

/**
 * Output of every CLI command. The `data` payload is the
 * machine-readable shape — what `--format=json` prints. The `text`
 * payload is what `--format=text` (the default) prints. Commands
 * supply both so the same result can be consumed by humans or
 * scripts without round-tripping through a re-formatter.
 */
export interface CommandResult<TData = unknown> {
  readonly exitCode: ExitCode;
  readonly text: string;
  readonly data: TData;
}

/**
 * Convenience: build an `ok` result.
 */
export function ok<T>(text: string, data: T): CommandResult<T> {
  return { exitCode: 0, text, data };
}

/**
 * Convenience: build an error result. `code` defaults to `1`
 * (usage error). `text` is what's shown to the user; `data`
 * mirrors it for `--format=json` consumers.
 */
export function err(
  text: string,
  code: ExitCode = 1,
  extra?: Record<string, unknown>,
): CommandResult<{ error: string } & Record<string, unknown>> {
  return {
    exitCode: code,
    text,
    data: { error: text, ...(extra ?? {}) },
  };
}
