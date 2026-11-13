"use client";

import { useEffect, useState } from "react";
import { readOpeningScreen } from "@/lib/captain-screen-cache";

export default function CaptainLoading() {
  const [snap, setSnap] = useState(readOpeningScreen);
  useEffect(() => { setSnap(readOpeningScreen()); }, []);

  if (snap.kind === "tables") {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-black">Tables</h1>
        <div className="grid grid-cols-2 gap-3">
          {snap.cards.map((card) => (
            <div key={card.name} className="min-h-28 rounded-3xl border border-neutral-200 bg-white p-4">
              <p className="text-2xl font-black">{card.name}</p>
              <p className="mt-2 text-sm font-bold text-neutral-600">{card.detail}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (snap.kind === "list") {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-black">{snap.title}</h1>
        <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white">
          {snap.rows.map((row) => (
            <div key={`${row.title}-${row.detail}`} className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 last:border-0">
              <span className="font-bold">{row.title}</span>
              <span className="text-sm text-neutral-600">{row.detail}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-black">{snap.title}</h1>
      {snap.detail ? <p className="text-lg font-semibold text-neutral-600">{snap.detail}</p> : null}
    </div>
  );
}
