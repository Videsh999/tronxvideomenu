"use client";

import { useEffect } from "react";
import { rememberCaptainScreen, type CaptainSnap } from "@/lib/captain-screen-cache";

export default function RememberCaptainScreen({ path, snap }: { path: string; snap: CaptainSnap }) {
  const saved = JSON.stringify(snap);
  useEffect(() => {
    rememberCaptainScreen(path, JSON.parse(saved) as CaptainSnap);
  }, [path, saved]);
  return null;
}
