"use client";

import { useEffect } from "react";
import { startInstallListeners } from "@/lib/pwa/install-store";

/**
 * Mounted once in the root layout.
 * - Captures `beforeinstallprompt` early so install buttons can use it later.
 * - Registers /sw.js in production only. In development any previous worker is removed so
 *   stale caches never confuse local debugging.
 */
export default function PwaRegister() {
  useEffect(() => {
    startInstallListeners();
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => void r.unregister())).catch(() => {});
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        /* offline page / installability are progressive enhancements */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
