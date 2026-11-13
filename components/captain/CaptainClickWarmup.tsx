"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { markCaptainOpening } from "@/lib/captain-screen-cache";

/** Remember which screen was tapped, and warm the main buttons before the next tap. */
export default function CaptainClickWarmup() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a");
      const href = anchor?.getAttribute("href");
      if (!href?.startsWith("/captain/")) return;
      markCaptainOpening(href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    const root = pathname.match(/^\/captain\/[^/]+/)?.[0];
    if (!root) return;
    for (const suffix of ["/tables", "/take-order", "/orders", "/bills", "/approvals", "/requests"]) {
      router.prefetch(`${root}${suffix}`);
    }
  }, [pathname, router]);

  return null;
}
