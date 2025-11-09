export function cls(
  ...args: (string | Record<string, unknown> | undefined | null)[]
): string {
  let str = "";
  for (const arg of args) {
    if (!arg) continue;

    // Check if arg has string methods
    if ((arg as string).charAt) {
      str += " " + (arg as string);
    } else {
      // Must be an object - strong type assumption
      const obj = arg as Record<string, unknown>;
      for (const key in obj) {
        const value = obj[key];
        if (value) str += " " + key;
      }
    }
  }
  return str;
}
