const REQUIRED_PORT_NAMES = Object.freeze([
  "server",
  "websocket",
  "client",
  "capture",
  "spectator",
  "postgres",
  "hyperbetApi",
  "hyperbetApp",
]);

export function validateDuelSmokePorts(ports) {
  const values = REQUIRED_PORT_NAMES.map((name) => {
    const value = Number(ports?.[name]);
    if (!Number.isSafeInteger(value) || value < 1 || value > 65535) {
      throw new Error(
        `Duel smoke ${name} port must be an integer from 1 to 65535`,
      );
    }
    return value;
  });
  if (new Set(values).size !== values.length) {
    throw new Error("Duel smoke service ports must be unique");
  }
  return Object.freeze(
    Object.fromEntries(
      REQUIRED_PORT_NAMES.map((name, index) => [name, values[index]]),
    ),
  );
}

export function buildDuelSmokeLauncherArgs({
  ports,
  timeoutMs,
  withHyperbet = false,
  withKeeper = false,
}) {
  const validated = validateDuelSmokePorts(ports);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 60_000) {
    throw new Error("Duel smoke timeout must be at least 60000ms");
  }
  if (withKeeper && !withHyperbet) {
    throw new Error(
      "Duel smoke keeper verification requires the Hyperbet runtime",
    );
  }

  const args = [
    "scripts/duel-stack.mjs",
    "--fresh",
    "--isolated",
    "--verify",
    "--bots=2",
    "--server-url",
    `http://127.0.0.1:${validated.server}`,
    "--ws-url",
    `ws://127.0.0.1:${validated.websocket}/ws`,
    "--client-url",
    `http://127.0.0.1:${validated.client}`,
    "--rtmp-port",
    String(validated.capture),
    "--startup-timeout-ms",
    String(timeoutMs),
    "--verify-timeout-ms",
    String(timeoutMs),
  ];

  if (withHyperbet) {
    args.push(
      "--betting-port",
      String(validated.hyperbetApp),
      "--hyperbet-api-url",
      `http://127.0.0.1:${validated.hyperbetApi}`,
    );
    if (!withKeeper) args.push("--skip-keeper");
  } else {
    args.push("--skip-betting", "--skip-keeper");
  }

  return Object.freeze(args);
}

export function isDuelSmokeOnlineLine(line) {
  return /^\[duel\] stack online\s*$/.test(String(line || "").trim());
}
