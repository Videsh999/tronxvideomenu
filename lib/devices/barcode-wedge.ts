/** Shared keyboard-wedge barcode detector for POS (browser). Does not change stock. */

export type BarcodeWedgeOptions = {
  minLength?: number;
  interKeyMaxMs?: number;
  /** Scanner suffix key — Enter or Tab. */
  suffixKey?: "Enter" | "Tab";
  onScan?: (code: string) => void;
};

export function isValidBarcode(value: string): boolean {
  return /^[A-Za-z0-9\-_.]{3,64}$/.test(value.trim());
}

export function createBarcodeWedgeDetector(options?: BarcodeWedgeOptions) {
  const minLength = options?.minLength ?? 4;
  const interKeyMaxMs = options?.interKeyMaxMs ?? 50;
  const suffixKey = options?.suffixKey ?? "Enter";
  let buffer = "";
  let lastAt = 0;
  let lastCode = "";
  let lastCodeAt = 0;

  return {
    handleKeyDown(event: {
      key: string;
      preventDefault?: () => void;
      target?: EventTarget | null;
    }): string | null {
      const target = event.target as HTMLElement | null | undefined;
      if (target && (target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return null;
      }
      const now = Date.now();
      if (buffer && now - lastAt > interKeyMaxMs * 3) {
        buffer = "";
      }
      lastAt = now;

      if (event.key === suffixKey) {
        const code = buffer;
        buffer = "";
        if (code.length >= minLength && isValidBarcode(code)) {
          // Debounce identical repeated scans within 400ms
          if (code === lastCode && now - lastCodeAt < 400) {
            event.preventDefault?.();
            return null;
          }
          lastCode = code;
          lastCodeAt = now;
          event.preventDefault?.();
          options?.onScan?.(code);
          return code;
        }
        return null;
      }
      if (event.key.length === 1) {
        buffer += event.key;
      }
      return null;
    },
    reset() {
      buffer = "";
      lastAt = 0;
    },
    getStatus() {
      return {
        suffixKey,
        minLength,
        listening: true,
        help: `Scan into POS focus. Suffix: ${suffixKey}. Stock is never changed by scanning alone.`,
      };
    },
  };
}
