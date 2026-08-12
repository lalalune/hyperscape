const FORBIDDEN_GROUP_COMMANDS = Object.freeze([
  "duel-stack.mjs",
  "smoke-duel-launch.mjs",
  "verify-duel-stream-recovery.mjs",
]);

export function parseProcessSnapshot(raw) {
  return String(raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(\d+)\s+(.+)$/);
      if (!match) return null;
      return {
        pid: Number.parseInt(match[1], 10),
        groupId: Number.parseInt(match[2], 10),
        command: match[3],
      };
    })
    .filter(
      (entry) =>
        entry &&
        Number.isSafeInteger(entry.pid) &&
        entry.pid > 1 &&
        Number.isSafeInteger(entry.groupId) &&
        entry.groupId > 1,
    );
}

export function parseListenerPids(raw) {
  return Array.from(
    new Set(
      String(raw ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .map((value) => Number.parseInt(value, 10))
        .filter((pid) => Number.isSafeInteger(pid) && pid > 1),
    ),
  );
}

export function validateCaptureRestartTarget({
  capturePort,
  listenerPids,
  processSnapshot,
  verifierPid,
}) {
  if (
    !Number.isSafeInteger(capturePort) ||
    capturePort < 1 ||
    capturePort > 65_535
  ) {
    throw new Error("capture restart port must be an integer from 1 to 65535");
  }
  if (!Array.isArray(listenerPids) || listenerPids.length > 1) {
    throw new Error(
      `capture restart allows at most one listener on port ${capturePort}`,
    );
  }
  if (!Array.isArray(processSnapshot)) {
    throw new Error("capture restart process snapshot is required");
  }

  const verifier = processSnapshot.find((entry) => entry.pid === verifierPid);
  if (!verifier) {
    throw new Error("capture verifier is absent from the process snapshot");
  }

  const listenerPid = listenerPids[0] ?? null;
  const listener =
    listenerPid === null
      ? null
      : processSnapshot.find((entry) => entry.pid === listenerPid);
  if (listenerPid !== null && !listener) {
    throw new Error("capture listener is absent from the process snapshot");
  }

  const processGroups = Array.from(
    new Set(processSnapshot.map((entry) => entry.groupId)),
  ).map((groupId) => ({
    groupId,
    members: processSnapshot.filter((entry) => entry.groupId === groupId),
  }));
  const streamGroups = processGroups.filter(({ members }) => {
    const command = members.map((entry) => entry.command).join("\n");
    return (
      command.includes("packages/server") &&
      /(?:^|\s)stream:rtmp(?:\s|$)/m.test(command)
    );
  });
  const candidateGroups = listener
    ? streamGroups.filter(({ groupId }) => groupId === listener.groupId)
    : streamGroups;
  if (candidateGroups.length !== 1) {
    throw new Error(
      `capture restart requires exactly one server stream worker process group; found ${candidateGroups.length}`,
    );
  }

  const [{ groupId, members }] = candidateGroups;
  if (groupId === verifier.groupId) {
    throw new Error("capture worker shares the verifier process group");
  }

  const leader = members.find((entry) => entry.pid === groupId);
  if (!leader) {
    throw new Error("capture process group has no visible group leader");
  }
  const combinedCommand = members.map((entry) => entry.command).join("\n");
  const forbidden = FORBIDDEN_GROUP_COMMANDS.find((needle) =>
    combinedCommand.includes(needle),
  );
  if (forbidden) {
    throw new Error(
      `capture process group contains forbidden owner ${forbidden}`,
    );
  }

  return Object.freeze({
    capturePort,
    listenerPid,
    groupId,
    leaderPid: leader.pid,
    memberPids: Object.freeze(members.map((entry) => entry.pid)),
  });
}
