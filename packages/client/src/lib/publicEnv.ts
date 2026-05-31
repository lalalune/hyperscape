import type { PublicRuntimeEnv, StreamingWindow } from "./streamingWindow";

const INVALID_ENV_VALUES = new Set(["undefined", "null"]);
let publicRuntimeEnvPromise: Promise<PublicRuntimeEnv | undefined> | null =
  null;

export function normalizePublicEnvValue(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed || INVALID_ENV_VALUES.has(trimmed)) {
    return undefined;
  }

  return trimmed;
}

export function getPublicRuntimeEnv(): PublicRuntimeEnv | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (window as StreamingWindow).env;
}

function isPublicEnvScript(script: {
  getAttribute(name: string): string | null;
  src: string;
}): boolean {
  const source = script.getAttribute("src") || script.src;
  return source === "/env.js" || source.endsWith("/env.js");
}

export async function ensurePublicRuntimeEnv(): Promise<
  PublicRuntimeEnv | undefined
> {
  const runtimeEnv = getPublicRuntimeEnv();
  if (runtimeEnv) {
    return runtimeEnv;
  }

  if (typeof document === "undefined") {
    return undefined;
  }

  if (publicRuntimeEnvPromise) {
    return publicRuntimeEnvPromise;
  }

  publicRuntimeEnvPromise = new Promise((resolve) => {
    const finalize = () => {
      const resolved = getPublicRuntimeEnv();
      publicRuntimeEnvPromise = null;
      resolve(resolved);
    };

    const existingScript = Array.from(document.scripts).find((script) =>
      isPublicEnvScript(script),
    );

    if (existingScript) {
      existingScript.addEventListener("load", finalize, { once: true });
      existingScript.addEventListener("error", finalize, { once: true });
      globalThis.setTimeout(finalize, 0);
      return;
    }

    const script = document.createElement("script");
    script.src = "/env.js";
    script.async = false;
    script.addEventListener("load", finalize, { once: true });
    script.addEventListener("error", finalize, { once: true });
    document.head.appendChild(script);
  });

  return publicRuntimeEnvPromise;
}

export function resolvePublicEnvValue(
  runtimeValue?: string,
  buildValue?: string,
): string {
  return (
    normalizePublicEnvValue(runtimeValue) ??
    normalizePublicEnvValue(buildValue) ??
    ""
  );
}

export function resolvePrivyAppId(buildValue?: string): string {
  return resolvePublicEnvValue(
    getPublicRuntimeEnv()?.PUBLIC_PRIVY_APP_ID,
    buildValue,
  );
}

export function isConfiguredPrivyAppId(appId: string): boolean {
  return appId.length > 0 && !appId.includes("your-privy-app-id");
}

export function resolveAuth0Domain(buildValue?: string): string {
  return resolvePublicEnvValue(
    getPublicRuntimeEnv()?.PUBLIC_AUTH0_DOMAIN,
    buildValue,
  );
}

export function resolveAuth0ClientId(buildValue?: string): string {
  return resolvePublicEnvValue(
    getPublicRuntimeEnv()?.PUBLIC_AUTH0_CLIENT_ID,
    buildValue,
  );
}

export function isConfiguredAuth0Client(
  domain: string,
  clientId: string,
): boolean {
  return (
    domain.length > 0 &&
    clientId.length > 0 &&
    !clientId.includes("your-auth0-client-id")
  );
}
