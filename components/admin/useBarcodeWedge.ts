"use client";

import { useEffect, useRef } from "react";
import { createBarcodeWedgeDetector } from "@/lib/devices/barcode-wedge";

/** Listens for keyboard-wedge scanner input. Lookup is caller's responsibility; never mutates stock. */
export function useBarcodeWedge(onScan: (code: string) => void, enabled = true) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    const detector = createBarcodeWedgeDetector({
      onScan: (code) => onScanRef.current(code),
    });
    const handler = (event: KeyboardEvent) => {
      detector.handleKeyDown(event);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}
