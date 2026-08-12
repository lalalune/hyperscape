import assert from "node:assert/strict";
import test from "node:test";

import {
  parseListenerPids,
  parseProcessSnapshot,
  validateCaptureRestartTarget,
} from "./duel-capture-restart-policy.mjs";

const PROCESS_SNAPSHOT = `
100 100 node scripts/smoke-duel-launch.mjs
200 200 bun scripts/duel-stack.mjs
300 300 bun run --cwd packages/server stream:rtmp
301 300 bun packages/server/scripts/stream-to-rtmp.ts
302 300 ffmpeg -i pipe:0
400 400 node scripts/verify-duel-stream-recovery.mjs
`;

test("parses unique listener and process-group identities", () => {
  assert.deepEqual(parseListenerPids("301\n301\n"), [301]);
  assert.deepEqual(parseProcessSnapshot(PROCESS_SNAPSHOT)[3], {
    pid: 301,
    groupId: 300,
    command: "bun packages/server/scripts/stream-to-rtmp.ts",
  });
});

test("accepts only the isolated capture worker group", () => {
  assert.deepEqual(
    validateCaptureRestartTarget({
      capturePort: 35554,
      listenerPids: [301],
      processSnapshot: parseProcessSnapshot(PROCESS_SNAPSHOT),
      verifierPid: 400,
    }),
    {
      capturePort: 35554,
      listenerPid: 301,
      groupId: 300,
      leaderPid: 300,
      memberPids: [300, 301, 302],
    },
  );
  assert.deepEqual(
    validateCaptureRestartTarget({
      capturePort: 35554,
      listenerPids: [],
      processSnapshot: parseProcessSnapshot(PROCESS_SNAPSHOT),
      verifierPid: 400,
    }),
    {
      capturePort: 35554,
      listenerPid: null,
      groupId: 300,
      leaderPid: 300,
      memberPids: [300, 301, 302],
    },
  );
});

test("rejects ambiguous listeners, shared groups, and launcher ownership", () => {
  const snapshot = parseProcessSnapshot(PROCESS_SNAPSHOT);
  assert.throws(
    () =>
      validateCaptureRestartTarget({
        capturePort: 35554,
        listenerPids: [301, 302],
        processSnapshot: snapshot,
        verifierPid: 400,
      }),
    /at most one listener/,
  );
  assert.throws(
    () =>
      validateCaptureRestartTarget({
        capturePort: 35554,
        listenerPids: [301],
        processSnapshot: snapshot.map((entry) =>
          entry.pid === 400 ? { ...entry, groupId: 300 } : entry,
        ),
        verifierPid: 400,
      }),
    /shares the verifier process group/,
  );
  assert.throws(
    () =>
      validateCaptureRestartTarget({
        capturePort: 35554,
        listenerPids: [301],
        processSnapshot: snapshot.map((entry) =>
          entry.pid === 300
            ? { ...entry, command: `${entry.command} scripts/duel-stack.mjs` }
            : entry,
        ),
        verifierPid: 400,
      }),
    /forbidden owner duel-stack\.mjs/,
  );
  assert.throws(
    () =>
      validateCaptureRestartTarget({
        capturePort: 35554,
        listenerPids: [],
        processSnapshot: [
          ...snapshot,
          {
            pid: 500,
            groupId: 500,
            command: "bun run --cwd packages/server stream:rtmp",
          },
        ],
        verifierPid: 400,
      }),
    /exactly one server stream worker process group; found 2/,
  );
});
