export type LogLevel = "info" | "warn" | "error" | "debug";

function stamp(): string {
  return new Date().toISOString();
}

/** Never log secrets, pairing codes, or payment card data. */
export function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const safe = meta ? redact(meta) : undefined;
  const line = safe ? `${stamp()} [${level}] ${message} ${JSON.stringify(safe)}` : `${stamp()} [${level}] ${message}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function redact(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    const lower = k.toLowerCase();
    if (
      lower.includes("secret") ||
      lower.includes("password") ||
      lower.includes("token") ||
      lower.includes("authorization") ||
      lower === "code"
    ) {
      out[k] = "[redacted]";
    } else {
      out[k] = v;
    }
  }
  return out;
}
