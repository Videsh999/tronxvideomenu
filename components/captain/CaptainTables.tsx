"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Clock3, QrCode, Search, UtensilsCrossed } from "lucide-react";
import QRCode from "qrcode";
import type { OrderSummary, RestaurantTable } from "@/types";
import { enrichCaptainTables } from "@/lib/captain-floor";
import { locationMenuUrl, locationName, locationType } from "@/lib/service-location";

function money(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function elapsed(iso: string | undefined, now: number) {
  if (!iso || !now) return null;
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

export default function CaptainTables({ slug, initialTables, initialOrders, assignedTableIds, currency = "INR" }: {
  slug: string;
  initialTables: RestaurantTable[];
  initialOrders: OrderSummary[];
  assignedTableIds: string[];
  currency?: string;
}) {
  const [kind, setKind] = useState<"TABLE" | "ROOM">("TABLE");
  const [area, setArea] = useState("ALL");
  const [search, setSearch] = useState("");
  const [qrTableId, setQrTableId] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [origin, setOrigin] = useState("");
  const [now, setNow] = useState(0);

  useEffect(() => {
    setOrigin(window.location.origin);
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const rows = useMemo(() => enrichCaptainTables(initialTables, initialOrders, new Set(assignedTableIds)), [initialTables, initialOrders, assignedTableIds]);
  const kindRows = rows.filter(({ table }) => locationType(table) === kind);
  const areas = [...new Set(kindRows.map(({ table }) => table.label?.trim() || (kind === "ROOM" ? "Rooms" : "Main floor")))].sort();
  const visibleRows = kindRows.filter(({ table }) => {
    const tableArea = table.label?.trim() || (kind === "ROOM" ? "Rooms" : "Main floor");
    const query = search.trim().toLowerCase();
    return (area === "ALL" || area === tableArea) && (!query || String(table.tableNumber).includes(query) || tableArea.toLowerCase().includes(query));
  });

  useEffect(() => {
    const table = initialTables.find((row) => row.id === qrTableId);
    if (!table || !origin) return;
    let live = true;
    void QRCode.toDataURL(locationMenuUrl(origin, slug, table), { width: 560, margin: 2 })
      .then((url) => { if (live) setQrImage(url); })
      .catch(() => { if (live) setQrImage(""); });
    return () => { live = false; };
  }, [initialTables, origin, qrTableId, slug]);

  return <div className="space-y-5">
    <header><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tables &amp; rooms</h1><p className="mt-1 text-sm text-neutral-500">Choose the guest’s location, add items, then send the KOT to the kitchen.</p></header>
    <div className="flex flex-wrap items-center gap-2">
      {(["TABLE", "ROOM"] as const).map((value) => <button key={value} type="button" onClick={() => { setKind(value); setArea("ALL"); setQrTableId(null); }} className={`min-h-11 rounded-xl px-4 text-sm font-bold ${kind === value ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700"}`}>{value === "TABLE" ? "Tables" : "Rooms"} ({rows.filter(({ table }) => locationType(table) === value).length})</button>)}
      <label className="relative min-w-48 flex-1 sm:max-w-72"><Search className="absolute left-3 top-3.5 h-4 w-4 text-neutral-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find table or area" className="min-h-11 w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-3 text-sm" /></label>
    </div>
    <nav aria-label="Areas" className="flex gap-2 overflow-x-auto pb-1">{["ALL", ...areas].map((value) => <button key={value} type="button" onClick={() => setArea(value)} className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${area === value ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700"}`}>{value === "ALL" ? "All areas" : value}</button>)}</nav>
    {visibleRows.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visibleRows.map(({ table, activeOrder, runningTotal, unsentItems }) => {
      const timer = elapsed(activeOrder?.createdAt, now);
      return <section key={table.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{table.label?.trim() || (kind === "ROOM" ? "Rooms" : "Main floor")}</p><h2 className="mt-1 text-2xl font-black">{locationName(table)}</h2></div>{activeOrder ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">Order #{activeOrder.orderNumber}</span> : null}</div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600"><span>{activeOrder ? money(runningTotal, currency) : "No order yet"}</span>{timer ? <span className="inline-flex items-center gap-1"><Clock3 className="h-4 w-4" />{timer} since first order</span> : null}</div>
        {unsentItems > 0 ? <p className="mt-2 text-xs font-semibold text-amber-800">{unsentItems} new item{unsentItems === 1 ? "" : "s"} waiting for KOT</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2"><Link href={`/captain/${slug}/take-order?table=${encodeURIComponent(table.id)}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-3 text-sm font-bold text-white"><UtensilsCrossed className="h-4 w-4" />{activeOrder ? "Add items" : "Take order"}</Link><button type="button" onClick={() => { setQrTableId((current) => current === table.id ? null : table.id); setQrImage(""); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200 px-3 text-sm font-bold"><QrCode className="h-4 w-4" />{qrTableId === table.id ? "Hide QR" : "Show QR"}</button></div>
        {qrTableId === table.id ? <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-center">{qrImage ? <Image unoptimized src={qrImage} width={240} height={240} alt={`Menu QR for ${locationName(table)}`} className="mx-auto h-60 w-60 max-w-full rounded-lg bg-white p-2" /> : <p className="py-12 text-sm text-neutral-500">Generating QR…</p>}<p className="mt-2 text-xs text-neutral-500">Guests can scan to view this location’s menu.</p></div> : null}
      </section>;
    })}</div> : <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">No {kind === "ROOM" ? "rooms" : "tables"} match. Add locations in Admin → Tables &amp; QR.</p>}
  </div>;
}
