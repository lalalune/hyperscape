export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

export async function apiFetch(
  input: string,
  init: RequestOptions = {},
): Promise<Response> {
  const { timeoutMs = 15000, signal, ...rest } = init;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Timeout", "AbortError")),
    timeoutMs,
  );

  try {
    const response = await fetch(input, {
      ...rest,
      signal: signal ?? controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
