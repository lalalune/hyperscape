/**
 * `serve()` — start the HTTP server. Uses `bun.serve` directly to
 * avoid pulling an HTTP framework dep just for two routes.
 *
 * Routes:
 *
 *   GET  /         → "ok" healthcheck
 *   POST /design   → run the agent loop, return DesignResponse
 *   OPTIONS *      → CORS preflight
 *
 * CORS is permissive (`Access-Control-Allow-Origin: *`) — this is a
 * dev/local server, not internet-facing. Production deployments
 * should put a reverse proxy in front and tighten this header.
 */

import {
  handleDesignRequest,
  parseDesignRequest,
  type DesignErrorResponse,
  type HandleDesignOptions,
  type TurnDetail,
} from "./handler.js";

export interface ServeOptions extends HandleDesignOptions {
  readonly port?: number;
  readonly hostname?: string;
}

export interface ServeResult {
  readonly port: number;
  readonly url: string;
  /** Stop the server. */
  readonly stop: () => Promise<void>;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export function serve(options: ServeOptions): ServeResult {
  const port = options.port ?? 5180;
  const hostname = options.hostname ?? "0.0.0.0";

  const server = (
    globalThis as { Bun?: { serve: (config: unknown) => unknown } }
  ).Bun?.serve({
    port,
    hostname,
    // Bun's default idleTimeout is 10s — closes the socket when
    // no data flows in either direction for that long. Long
    // /design/stream runs (12 turns × 5-10s LLM call each) blow
    // through that and surface as `ERR_INCOMPLETE_CHUNKED_ENCODING`
    // on the client. Bumping to 255 (Bun's max in seconds) +
    // SSE keepalives every 5s on the streaming route keeps the
    // connection alive for the full agent run.
    idleTimeout: 255,
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);

      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      if (url.pathname === "/" && req.method === "GET") {
        return jsonResponse({
          ok: true,
          service: "@hyperforge/agent-server",
          version: 1,
        });
      }

      if (url.pathname === "/design" && req.method === "POST") {
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return jsonResponse(
            {
              ok: false,
              error: "Invalid JSON in request body.",
              code: "BAD_REQUEST",
            } satisfies DesignErrorResponse,
            400,
          );
        }
        const parsed = parseDesignRequest(body);
        if ("ok" in parsed && parsed.ok === false) {
          return jsonResponse(parsed, 400);
        }
        const result = await handleDesignRequest(
          parsed as { prompt: string; model?: string; maxTurns?: number },
          options,
        );
        const status = result.ok ? 200 : 500;
        return jsonResponse(result, status);
      }

      // B1'.7 — SSE streaming variant. Same body shape as /design;
      // pushes `event: turn` after each agent turn (with the
      // turn's tool-call results, so the client can update the
      // plan panel live), then `event: done` with the final
      // response. EventSource doesn't support POST, so the client
      // uses a manual fetch + ReadableStream reader.
      if (url.pathname === "/design/stream" && req.method === "POST") {
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return jsonResponse(
            {
              ok: false,
              error: "Invalid JSON in request body.",
              code: "BAD_REQUEST",
            } satisfies DesignErrorResponse,
            400,
          );
        }
        const parsed = parseDesignRequest(body);
        if ("ok" in parsed && parsed.ok === false) {
          return jsonResponse(parsed, 400);
        }
        return streamDesignResponse(parsed as DesignRequestLike, options);
      }

      return jsonResponse(
        {
          ok: false,
          error: `No route for ${req.method} ${url.pathname}`,
          code: "BAD_REQUEST",
        } satisfies DesignErrorResponse,
        404,
      );
    },
  }) as { stop: () => void; port: number } | undefined;

  if (!server) {
    throw new Error(
      "@hyperforge/agent-server requires the bun runtime. " +
        "Run with `bun run src/bin.ts` or `bun start`.",
    );
  }

  return {
    port: server.port,
    url: `http://localhost:${server.port}`,
    async stop() {
      server.stop();
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

// ────────────────────── SSE streaming (B1'.7) ────────────────

interface DesignRequestLike {
  readonly prompt: string;
  readonly model?: string;
  readonly maxTurns?: number;
  readonly mode?: string;
  readonly history?: ReadonlyArray<unknown>;
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
  ...CORS_HEADERS,
} as const;

/**
 * Run `handleDesignRequest` while streaming each agent turn as
 * an SSE `event: turn` chunk; close with `event: done` (success)
 * or `event: error`. The client uses `fetch` + ReadableStream
 * reader since EventSource can't POST.
 *
 * Phase B1'.7 of `PLAN_PROJECT_AS_DATA.md`.
 */
function streamDesignResponse(
  request: DesignRequestLike,
  options: HandleDesignOptions,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const write = (event: string, data: unknown): void => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          /* controller already closed */
        }
      };

      // Periodic SSE comment keepalives. The 5s cadence keeps the
      // stream alive across:
      //   - Bun's idleTimeout (set to 255s on the server),
      //   - any intermediate reverse-proxy (nginx default 60s),
      //   - the browser's hidden-tab throttle.
      // A `:` comment line is ignored by the SSE parser but counts
      // as bytes-on-the-wire. Without these we see
      // `ERR_INCOMPLETE_CHUNKED_ENCODING` mid-stream.
      //
      // Send one immediately so the response headers flush and the
      // client knows the stream is open before the agent's first
      // LLM call returns.
      try {
        controller.enqueue(encoder.encode(": ready\n\n"));
      } catch {
        /* already closed */
      }
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          /* controller already closed */
        }
      }, 5000);

      const onTurnDetail = (detail: TurnDetail): void => {
        write("turn", detail);
      };

      handleDesignRequest(
        request as Parameters<typeof handleDesignRequest>[0],
        { ...options, onTurnDetail },
      )
        .then((result) => {
          write("done", result);
        })
        .catch((err: unknown) => {
          write("error", {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            code: "AGENT_FAILED",
          });
        })
        .finally(() => {
          closed = true;
          clearInterval(heartbeat);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        });
    },
  });

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}
