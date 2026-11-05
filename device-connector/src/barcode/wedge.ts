/**
 * Keyboard-wedge barcode helpers for local POS host processes.
 * Does not modify inventory. Lookup must call existing cloud/inventory APIs.
 */

export function isValidBarcode(value: string): boolean {
  return /^[A-Za-z0-9\-_.]{3,64}$/.test(value.trim());
}

/**
 * Detect scanner-style bursts: many keystrokes ending in Enter within a short window.
 * Ordinary typing rarely exceeds threshold characters within windowMs.
 */
export function createWedgeDetector(options?: {
  minLength?: number;
  windowMs?: number;
  onScan?: (code: string) => void;
}) {
  const minLength = options?.minLength ?? 4;
  const windowMs = options?.windowMs ?? 80;
  let buffer = "";
  let startedAt = 0;

  return {
    pushKey(key: string): string | null {
      const now = Date.now();
      if (!buffer) startedAt = now;
      if (now - startedAt > windowMs * 4) {
        buffer = "";
        startedAt = now;
      }
      if (key === "Enter") {
        const code = buffer;
        buffer = "";
        if (code.length >= minLength && now - startedAt <= windowMs * code.length && isValidBarcode(code)) {
          options?.onScan?.(code);
          return code;
        }
        return null;
      }
      if (key.length === 1) {
        buffer += key;
      }
      return null;
    },
    reset() {
      buffer = "";
      startedAt = 0;
    },
  };
}
