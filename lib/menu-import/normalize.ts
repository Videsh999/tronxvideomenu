/** Pure string helpers for spreadsheet interpretation — no I/O. */

export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeItemName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Optional spreadsheet/API string fields.
 * Empty Excel cells, null (Mongo/JSON round-trip), undefined, and whitespace
 * become `undefined` so Zod `.optional()` and DB omit-semantics stay consistent.
 * Does NOT invent values (no fake SKUs).
 */
export function normalizeOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) {
    const text = String(value).trim();
    return text || undefined;
  }
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
  return text || undefined;
}

/** Required trimmed string — empty/null becomes "". Caller decides if that is an error. */
export function normalizeRequiredString(value: unknown): string {
  return normalizeOptionalString(value) ?? "";
}

export function slugifyName(value: string): string {
  return normalizeItemName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "item";
}

export function parseMoney(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw * 100) / 100;
  const text = String(raw).trim();
  if (!text) return null;
  const cleaned = text
    .replace(/₹|rs\.?|inr|\$|€|£/gi, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .trim();
  if (!cleaned || cleaned === "-" || cleaned === "—") return null;
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

export function parseBooleanAvailability(raw: unknown): boolean | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const text = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "y", "available", "active", "in stock"].includes(text)) return true;
  if (["0", "false", "no", "n", "unavailable", "sold out", "inactive"].includes(text)) return false;
  return null;
}

export function parseDietary(raw: unknown): "VEG" | "NON_VEG" | "UNKNOWN" {
  if (raw === null || raw === undefined || raw === "") return "UNKNOWN";
  const text = String(raw).trim().toLowerCase();
  if (["veg", "vegetarian", "vegan", "pure veg", "plant based", "green"].includes(text)) return "VEG";
  if (["non veg", "non-veg", "nonveg", "nv", "meat", "chicken", "mutton", "egg", "seafood", "fish"].includes(text)) {
    return "NON_VEG";
  }
  if (text.includes("non") && text.includes("veg")) return "NON_VEG";
  if (text.includes("veg")) return "VEG";
  return "UNKNOWN";
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i += 1) {
    let prev = i;
    row[0] = i + 1;
    for (let j = 0; j < b.length; j += 1) {
      const current = row[j + 1];
      const cost = a[i] === b[j] ? 0 : 1;
      row[j + 1] = Math.min(row[j + 1] + 1, row[j] + 1, prev + cost);
      prev = current;
    }
  }
  return row[b.length];
}

export function similarity(a: string, b: string): number {
  const left = normalizeHeader(a);
  const right = normalizeHeader(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const distance = levenshtein(left, right);
  return Math.max(0, 1 - distance / Math.max(left.length, right.length));
}

/** Strip spreadsheet formula injection markers when reading as text. */
export function sanitizeCellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  let text = String(value).replace(/\u0000/g, "").trim();
  // Neutralize formula-looking leading characters if a CSV injected them as text.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return text.slice(0, 2000);
}
