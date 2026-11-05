/** Strip sensitive fields before any LLM-bound payload. */
export function redactForLlm(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactForLlm);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("phone") ||
      lower.includes("email") ||
      lower.includes("password") ||
      lower.includes("token") ||
      lower.includes("cipher") ||
      lower === "method" ||
      lower.includes("payment")
    ) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = redactForLlm(entry);
  }
  return out;
}

export function looksLikePromptInjection(text: string): boolean {
  return /(ignore\s+(all\s+)?(previous|prior)\s+instructions|run\s+mongo|db\.|\$where|drop\s+collection|execute\s+shell|refund\s+all|system\s*prompt)/i.test(
    text,
  );
}
