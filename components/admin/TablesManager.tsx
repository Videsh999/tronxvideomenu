"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { RestaurantTable } from "@/types";
import type { OrderSummary, TableStatus } from "@/types";
import { api } from "@/lib/api";
import { Copy, Download, ExternalLink, Pencil, Plus, Printer, QrCode, Trash2, Users } from "lucide-react";
import QRCode from "qrcode";
import AdminModal from "@/components/admin/AdminModal";

type TablesManagerProps = {
  initialTables: RestaurantTable[];
  initialOrders?: OrderSummary[];
  restaurantSlug: string;
  restaurantName?: string;
  orderManagementEnabled?: boolean;
  tableOrderingEnabled?: boolean;
};

const statusLabel: Record<TableStatus, string> = { OPEN: "Open", OCCUPIED: "Occupied", CLOSED: "Closed" };
const statusStyle: Record<TableStatus, string> = {
  OPEN: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  OCCUPIED: "bg-amber-50 text-amber-700 ring-amber-200",
  CLOSED: "bg-neutral-100 text-neutral-600 ring-neutral-200",
};
const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900";
const qrOptions = { width: 560, margin: 1, color: { dark: "#000000", light: "#ffffff" } };

export default function TablesManager({ initialTables, initialOrders = [], restaurantSlug, restaurantName, orderManagementEnabled = true, tableOrderingEnabled = true }: TablesManagerProps) {
  const [tables, setTables] = useState(initialTables);
  const [orders, setOrders] = useState(initialOrders);
  const [mode, setMode] = useState<"single" | "bulk">(initialTables.length ? "single" : "bulk");
  const [tableNumber, setTableNumber] = useState("");
  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [rangeFrom, setRangeFrom] = useState(String((initialTables.at(-1)?.tableNumber ?? 0) + 1));
  const [rangeTo, setRangeTo] = useState(String((initialTables.at(-1)?.tableNumber ?? 0) + 10));
  const [qrTable, setQrTable] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [editValues, setEditValues] = useState({ tableNumber: "", label: "", capacity: "" });
  const [printCodes, setPrintCodes] = useState<{ table: RestaurantTable; url: string }[] | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const [nextOrders, nextTables] = await Promise.all([
          orderManagementEnabled ? api.getOrders() : Promise.resolve([]),
          api.getTables(),
        ]);
        if (alive) { if (orderManagementEnabled) setOrders(nextOrders); setTables(nextTables); }
      } catch { /* Keep the most recent order and table snapshot available. */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [orderManagementEnabled]);

  useEffect(() => {
    const updateOrigin = () => setOrigin(window.location.origin);
    updateOrigin();
    window.addEventListener("focus", updateOrigin);
    return () => window.removeEventListener("focus", updateOrigin);
  }, []);

  const menuUrl = useCallback((number: number) => `${origin}/menu/${encodeURIComponent(restaurantSlug)}?table=${number}`, [origin, restaurantSlug]);

  useEffect(() => {
    const table = tables.find((entry) => entry.id === qrTable);
    if (!table || !origin) return;
    let alive = true;
    void QRCode.toDataURL(menuUrl(table.tableNumber), qrOptions)
      .then((url) => { if (alive) setQrDataUrl(url); })
      .catch(() => { if (alive) setQrDataUrl(""); });
    return () => { alive = false; };
  }, [menuUrl, origin, qrTable, tables]);

  useEffect(() => {
    if (!printCodes) return;
    const timer = window.setTimeout(() => window.print(), 300);
    const done = () => setPrintCodes(null);
    window.addEventListener("afterprint", done);
    return () => { window.clearTimeout(timer); window.removeEventListener("afterprint", done); };
  }, [printCodes]);

  const counts = useMemo(() => ({
    OPEN: tables.filter((table) => table.status === "OPEN").length,
    OCCUPIED: tables.filter((table) => table.status === "OCCUPIED").length,
    CLOSED: tables.filter((table) => table.status === "CLOSED").length,
    seats: tables.reduce((sum, table) => sum + (table.capacity ?? 0), 0),
  }), [tables]);

  const sortTables = (list: RestaurantTable[]) => [...list].sort((a, b) => a.tableNumber - b.tableNumber);

  const createSingle = async () => {
    const created = await api.createTable({ tableNumber: Number(tableNumber), label: label.trim() || undefined, capacity: Number(capacity) });
    setTables((current) => sortTables([...current, created]));
    setTableNumber(""); setLabel("");
    setMessage({ tone: "ok", text: `Table ${created.tableNumber} added.` });
  };

  const createBulk = async () => {
    const from = Number(rangeFrom);
    const to = Number(rangeTo);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) throw new Error("Enter a valid range, for example 1 to 10.");
    if (to - from + 1 > 100) throw new Error("Add up to 100 tables at a time.");
    const existing = new Set(tables.map((table) => table.tableNumber));
    const numbers = Array.from({ length: to - from + 1 }, (_, index) => from + index).filter((number) => !existing.has(number));
    if (!numbers.length) throw new Error(`Tables ${from}–${to} already exist.`);
    const created: RestaurantTable[] = [];
    for (const number of numbers) {
      setMessage({ tone: "ok", text: `Adding table ${number} (${created.length + 1} of ${numbers.length})…` });
      created.push(await api.createTable({ tableNumber: number, label: label.trim() || undefined, capacity: Number(capacity) }));
    }
    setTables((current) => sortTables([...current, ...created]));
    const skipped = to - from + 1 - numbers.length;
    setRangeFrom(String(to + 1)); setRangeTo(String(to + 10));
    setMessage({ tone: "ok", text: `${created.length} tables added${skipped ? ` (${skipped} already existed)` : ""}.` });
  };

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage(null);
    try { await (mode === "bulk" ? createBulk() : createSingle()); }
    catch (error) { setMessage({ tone: "error", text: error instanceof Error ? error.message : "Unable to create table." }); }
    finally { setBusy(false); }
  };

  const openEdit = (table: RestaurantTable) => {
    setEditing(table);
    setEditValues({ tableNumber: String(table.tableNumber), label: table.label ?? "", capacity: table.capacity ? String(table.capacity) : "" });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const number = Number(editValues.tableNumber);
    const seats = Number(editValues.capacity);
    if (!Number.isInteger(number) || number < 1) { setMessage({ tone: "error", text: "Enter a valid table number." }); return; }
    if (!Number.isInteger(seats) || seats < 1 || seats > 1000) { setMessage({ tone: "error", text: "Enter a capacity from 1 to 1000." }); return; }
    setBusy(true);
    try {
      const updated = await api.updateTable(editing.id, { tableNumber: number, label: editValues.label, capacity: seats });
      setTables((current) => sortTables(current.map((entry) => entry.id === editing.id ? updated : entry)));
      setEditing(null);
      setMessage({ tone: "ok", text: `Table ${updated.tableNumber} updated.` });
    } catch (error) { setMessage({ tone: "error", text: error instanceof Error ? error.message : "Unable to update table." }); }
    finally { setBusy(false); }
  };

  const toggle = async (table: RestaurantTable) => {
    try {
      const updated = await api.updateTable(table.id, { isActive: !table.isActive });
      setTables((current) => current.map((entry) => entry.id === table.id ? updated : entry));
      setMessage({ tone: "ok", text: `Table ${table.tableNumber} ${updated.isActive ? "activated" : "deactivated"}.` });
    } catch (error) { setMessage({ tone: "error", text: error instanceof Error ? error.message : "Unable to update table." }); }
  };

  const setStatus = async (table: RestaurantTable, status: TableStatus) => {
    if (table.status === status) return;
    try {
      const updated = await api.updateTable(table.id, { status });
      setTables((current) => current.map((entry) => entry.id === table.id ? updated : entry));
      setMessage({ tone: "ok", text: `Table ${table.tableNumber} is now ${statusLabel[status].toLowerCase()}.` });
    } catch (error) { setMessage({ tone: "error", text: error instanceof Error ? error.message : "Unable to update table status." }); }
  };

  const remove = async (table: RestaurantTable) => {
    if (!window.confirm(`Delete Table ${table.tableNumber}? Tables referenced by orders or reservations must be deactivated instead.`)) return;
    try {
      await api.deleteTable(table.id);
      setTables((current) => current.filter((entry) => entry.id !== table.id));
      setMessage({ tone: "ok", text: `Table ${table.tableNumber} deleted.` });
    } catch (error) { setMessage({ tone: "error", text: error instanceof Error ? error.message : "Unable to delete table." }); }
  };

  const copy = async (table: RestaurantTable) => {
    try { await navigator.clipboard.writeText(menuUrl(table.tableNumber)); setMessage({ tone: "ok", text: `Table ${table.tableNumber} menu link copied.` }); }
    catch { setMessage({ tone: "error", text: "Could not copy the link. Open the QR panel and copy it manually." }); }
  };

  const printAll = async () => {
    const printable = tables.filter((table) => table.isActive);
    if (!printable.length) { setMessage({ tone: "error", text: "Add or activate at least one table first." }); return; }
    setBusy(true);
    try {
      const codes = await Promise.all(printable.map(async (table) => ({ table, url: await QRCode.toDataURL(menuUrl(table.tableNumber), qrOptions) })));
      setPrintCodes(codes);
    } catch { setMessage({ tone: "error", text: "Could not generate QR codes. Try again." }); }
    finally { setBusy(false); }
  };

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Tables & QR codes</h1>
        <p className="mt-1 text-sm text-neutral-500">Each table gets its own QR code. Guests scan it to see the menu and order straight to this table.</p>
      </div>
      {tableOrderingEnabled && tables.length > 0 ? (
        <button type="button" onClick={() => void printAll()} disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50 disabled:opacity-50">
          <Printer className="h-4 w-4" /> Print all QR codes
        </button>
      ) : null}
    </header>

    {tables.length > 0 ? (
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[{ label: "Tables", value: tables.length }, { label: "Open", value: counts.OPEN }, { label: "Occupied", value: counts.OCCUPIED }, { label: "Total seats", value: counts.seats }].map((item) => (
          <div key={item.label} className="rounded-2xl border border-neutral-200 bg-white p-4"><dt className="text-xs text-neutral-500">{item.label}</dt><dd className="mt-1 text-2xl font-bold tabular-nums">{item.value}</dd></div>
        ))}
      </dl>
    ) : null}

    <form onSubmit={create} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">{tables.length ? "Add tables" : "Set up your tables"}</h2>
        <div role="tablist" aria-label="How many tables" className="inline-flex rounded-xl bg-white p-1 ring-1 ring-neutral-200">
          {([["single", "One table"], ["bulk", "Several tables"]] as const).map(([value, text]) => (
            <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => setMode(value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${mode === value ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900"}`}>{text}</button>
          ))}
        </div>
      </div>
      <div className={`mt-4 grid gap-3 sm:items-end ${mode === "bulk" ? "sm:grid-cols-[1fr_1fr_1fr_1.3fr_auto]" : "sm:grid-cols-[1fr_1fr_1.3fr_auto]"}`}>
        {mode === "bulk" ? <>
          <label className="text-xs font-medium text-neutral-600">From table<input required min={1} max={9999} type="number" value={rangeFrom} onChange={(event) => setRangeFrom(event.target.value)} className={inputClass} /></label>
          <label className="text-xs font-medium text-neutral-600">To table<input required min={1} max={9999} type="number" value={rangeTo} onChange={(event) => setRangeTo(event.target.value)} className={inputClass} /></label>
        </> : (
          <label className="text-xs font-medium text-neutral-600">Table number<input required min={1} max={9999} type="number" value={tableNumber} onChange={(event) => setTableNumber(event.target.value)} placeholder={String((tables.at(-1)?.tableNumber ?? 0) + 1)} className={inputClass} /></label>
        )}
        <label className="text-xs font-medium text-neutral-600">Seats per table<input required min={1} max={1000} type="number" value={capacity} onChange={(event) => setCapacity(event.target.value)} className={inputClass} /></label>
        <label className="text-xs font-medium text-neutral-600">Area (optional)<input maxLength={80} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Patio, window, rooftop…" className={inputClass} /></label>
        <button disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50">
          <Plus className="h-4 w-4" />{mode === "bulk" ? `Add ${Math.max(0, Number(rangeTo) - Number(rangeFrom) + 1) || ""} tables` : "Add table"}
        </button>
      </div>
      {mode === "bulk" ? <p className="mt-3 text-xs text-neutral-500">Existing table numbers are skipped, so it is safe to run again.</p> : null}
    </form>

    {message && <p role="status" className={`rounded-xl px-4 py-3 text-sm ${message.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{message.text}</p>}

    {tables.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center">
        <QrCode className="mx-auto h-8 w-8 text-neutral-300" />
        <p className="mt-3 text-sm font-semibold text-neutral-900">No tables yet</p>
        <p className="mt-1 text-sm text-neutral-500">Add your tables above — for example tables 1 to 12 with 4 seats each.</p>
      </div>
    ) : (
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tables.map((table) => {
          const liveOrders = orders.filter((order) => order.tableNumber === table.tableNumber && order.status !== "SERVED" && order.status !== "CANCELLED");
          const liveTotal = liveOrders.reduce((sum, order) => sum + order.total, 0);
          return <li key={table.id} className={`flex flex-col rounded-2xl border bg-white p-4 ${table.isActive ? "border-neutral-200" : "border-dashed border-neutral-300 opacity-75"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-neutral-500">{table.label || "Table"}</p>
                <h2 className="text-3xl font-bold tabular-nums text-neutral-900">{table.tableNumber}</h2>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusStyle[table.status]}`}>{statusLabel[table.status]}</span>
                {!table.isActive ? <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-500">Inactive</span> : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{table.capacity ? `${table.capacity} seats` : "Seats not set"}</span>
              {orderManagementEnabled ? (
                liveOrders.length ? <a href={`/admin/${encodeURIComponent(restaurantSlug)}/orders#order-${encodeURIComponent(liveOrders[0].id)}`} className="font-semibold text-neutral-900 underline-offset-2 hover:underline">{liveOrders.length} live {liveOrders.length === 1 ? "order" : "orders"} · ₹{liveTotal}</a> : <span>No live orders</span>
              ) : null}
            </div>

            <div role="radiogroup" aria-label={`Table ${table.tableNumber} status`} className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 p-1">
              {(["OPEN", "OCCUPIED", "CLOSED"] as TableStatus[]).map((status) => (
                <button key={status} type="button" role="radio" aria-checked={table.status === status} onClick={() => void setStatus(table, status)} className={`rounded-lg py-1.5 text-xs font-semibold transition ${table.status === status ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}>{statusLabel[status]}</button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {tableOrderingEnabled && <>
                <button type="button" onClick={() => setQrTable((current) => current === table.id ? null : table.id)} aria-expanded={qrTable === table.id} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white hover:bg-neutral-800"><QrCode className="h-3.5 w-3.5" />QR code</button>
                <button type="button" onClick={() => void copy(table)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-300 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"><Copy className="h-3.5 w-3.5" />Copy link</button>
              </>}
              <button type="button" onClick={() => openEdit(table)} aria-label={`Edit table ${table.tableNumber}`} className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-50"><Pencil className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => void toggle(table)} className="h-9 rounded-lg border border-neutral-300 px-3 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">{table.isActive ? "Deactivate" : "Activate"}</button>
              <button type="button" onClick={() => void remove(table)} aria-label={`Delete table ${table.tableNumber}`} className="grid h-9 w-9 place-items-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>

            {tableOrderingEnabled && qrTable === table.id && <div className="mt-4 flex items-center gap-4 border-t border-neutral-200 pt-4">
              {qrDataUrl ? <Image unoptimized src={qrDataUrl} alt={`QR code for Table ${table.tableNumber}`} width={128} height={128} className="h-32 w-32 shrink-0 rounded-xl bg-white p-1.5 ring-1 ring-neutral-200" /> : <div className="grid h-32 w-32 shrink-0 place-items-center rounded-xl bg-neutral-100 text-xs text-neutral-500">Generating…</div>}
              <div className="min-w-0 space-y-2">
                {!table.isActive && <p className="text-xs text-amber-700">Inactive — new orders are blocked.</p>}
                <a className="flex items-center gap-1 break-all text-xs text-neutral-600 underline underline-offset-2" href={menuUrl(table.tableNumber)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3 shrink-0" />Open table menu</a>
                {qrDataUrl && <a href={qrDataUrl} download={`table-${table.tableNumber}-qr.png`} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"><Download className="h-3.5 w-3.5" />Download PNG</a>}
              </div>
            </div>}
          </li>;
        })}
      </ul>
    )}

    <AdminModal
      title={editing ? `Edit table ${editing.tableNumber}` : "Edit table"}
      open={Boolean(editing)}
      onClose={() => setEditing(null)}
      footer={<div className="flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">Cancel</button>
        <button type="button" onClick={() => void saveEdit()} disabled={busy} className="rounded-xl bg-neutral-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
      </div>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-neutral-600">Table number<input type="number" min={1} max={9999} value={editValues.tableNumber} onChange={(event) => setEditValues((current) => ({ ...current, tableNumber: event.target.value }))} className={inputClass} /></label>
        <label className="text-xs font-medium text-neutral-600">Seats<input type="number" min={1} max={1000} value={editValues.capacity} onChange={(event) => setEditValues((current) => ({ ...current, capacity: event.target.value }))} className={inputClass} /></label>
        <label className="text-xs font-medium text-neutral-600 sm:col-span-2">Area (optional)<input maxLength={80} value={editValues.label} onChange={(event) => setEditValues((current) => ({ ...current, label: event.target.value }))} placeholder="Patio, window, rooftop…" className={inputClass} /></label>
      </div>
    </AdminModal>

    {printCodes ? createPortal(
      <div id="qr-print" aria-hidden="true" className="hidden print:block">
        <div className="grid grid-cols-2 gap-6">
          {printCodes.map(({ table, url }) => (
            <div key={table.id} className="break-inside-avoid rounded-3xl border-2 border-neutral-900 p-6 text-center">
              <p className="text-sm font-bold uppercase tracking-[0.2em]">{restaurantName ?? restaurantSlug}</p>
              <p className="mt-1 text-5xl font-black">Table {table.tableNumber}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="mx-auto mt-4 h-56 w-56" />
              <p className="mt-3 text-base font-semibold">Scan to see the menu &amp; order</p>
              <p className="text-xs text-neutral-500">Powered by TRONX</p>
            </div>
          ))}
        </div>
      </div>,
      document.body,
    ) : null}
  </div>;
}
