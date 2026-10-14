"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import type { RestaurantTable } from "@/types";
import type { OrderSummary, TableStatus } from "@/types";
import { api } from "@/lib/api";
import { Copy, Download, Pencil, Plus, QrCode, Trash2 } from "lucide-react";

import QRCode from "qrcode";

export default function TablesManager({ initialTables, initialOrders = [], restaurantSlug, orderManagementEnabled = true, tableOrderingEnabled = true }: { initialTables: RestaurantTable[]; initialOrders?: OrderSummary[]; restaurantSlug: string; orderManagementEnabled?: boolean; tableOrderingEnabled?: boolean }) {
  const [tables, setTables] = useState(initialTables);
  const [orders, setOrders] = useState(initialOrders);
  const [tableNumber, setTableNumber] = useState("");
  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [qrTable, setQrTable] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    let alive = true;
    const refreshOrders = async () => {
      try {
        const [nextOrders, nextTables] = await Promise.all([
          orderManagementEnabled ? api.getOrders() : Promise.resolve([]),
          api.getTables(),
        ]);
        if (alive) { if (orderManagementEnabled) setOrders(nextOrders); setTables(nextTables); }
      } catch { /* Keep the most recent order and table snapshot available. */ }
    };
    void refreshOrders();
    const timer = window.setInterval(() => void refreshOrders(), 15000);
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
    void QRCode.toDataURL(menuUrl(table.tableNumber), {
      width: 280,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (alive) setQrDataUrl(url);
      })
      .catch(() => {
        if (alive) setQrDataUrl("");
      });
    return () => {
      alive = false;
    };
  }, [menuUrl, origin, qrTable, tables]);

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const created = await api.createTable({ tableNumber: Number(tableNumber), label: label.trim() || undefined, capacity: Number(capacity) });
      setTables((current) => [...current, created].sort((a, b) => a.tableNumber - b.tableNumber));
      setTableNumber(""); setLabel(""); setCapacity("4"); setMessage("Table created.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create table."); }
    finally { setBusy(false); }
  };

  const edit = async (table: RestaurantTable) => {
    const enteredNumber = window.prompt("Table number", String(table.tableNumber));
    if (enteredNumber === null) return;
    const number = Number(enteredNumber);
    if (!Number.isInteger(number) || number < 1) { setMessage("Enter a valid table number."); return; }
    const nextLabel = window.prompt("Table label (optional)", table.label ?? "");
    if (nextLabel === null) return;
    const nextCapacity = window.prompt("Seating capacity", String(table.capacity ?? ""));
    if (nextCapacity === null) return;
    const capacity = Number(nextCapacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) { setMessage("Enter a capacity from 1 to 1000."); return; }
    try {
      const updated = await api.updateTable(table.id, { tableNumber: number, label: nextLabel, capacity });
      setTables((current) => current.map((entry) => entry.id === table.id ? updated : entry).sort((a, b) => a.tableNumber - b.tableNumber));
      setMessage("Table updated.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update table."); }
  };

  const toggle = async (table: RestaurantTable) => {
    try {
      const updated = await api.updateTable(table.id, { isActive: !table.isActive });
      setTables((current) => current.map((entry) => entry.id === table.id ? updated : entry));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update table."); }
  };

  const setStatus = async (table: RestaurantTable, status: TableStatus) => {
    try {
      const updated = await api.updateTable(table.id, { status });
      setTables((current) => current.map((entry) => entry.id === table.id ? updated : entry));
      setMessage(`Table ${table.tableNumber} is now ${status}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update table status."); }
  };

  const remove = async (table: RestaurantTable) => {
    if (!window.confirm(`Delete Table ${table.tableNumber}? Tables referenced by orders or reservations must be deactivated instead.`)) return;
    try { await api.deleteTable(table.id); setTables((current) => current.filter((entry) => entry.id !== table.id)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to delete table."); }
  };

  const copy = async (table: RestaurantTable) => {
    try { await navigator.clipboard.writeText(menuUrl(table.tableNumber)); setMessage(`Table ${table.tableNumber} menu link copied.`); }
    catch { setMessage("Could not copy the link. Select the QR dialog URL and copy it manually."); }
  };

  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold text-white sm:text-3xl">Tables & QR codes</h1><p className="mt-1 text-sm text-white/55">Create restaurant tables and share a table-specific menu link.</p></header>
    <form onSubmit={create} className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
      <label className="text-xs text-white/60">Table number<input required min={1} max={9999} type="number" value={tableNumber} onChange={(event) => setTableNumber(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white" /></label>
      <label className="text-xs text-white/60">Label (optional)<input maxLength={80} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Patio, window..." className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white" /></label>
      <label className="text-xs text-white/60">Capacity<input required min={1} max={1000} type="number" value={capacity} onChange={(event) => setCapacity(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white" /></label>
      <button disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-black disabled:opacity-50"><Plus className="h-4 w-4" />Add table</button>
    </form>
    {message && <p role="status" className="text-sm text-white/70">{message}</p>}
    <div className="space-y-3">{tables.map((table) => {
      const tableOrders = orders.filter((order) => order.tableNumber === table.tableNumber).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const statusStyle: Record<TableStatus, string> = { OPEN: "bg-emerald-400/10 text-emerald-300", OCCUPIED: "bg-amber-400/10 text-amber-300", CLOSED: "bg-rose-400/10 text-rose-300" };
      const actions: Record<TableStatus, { status: TableStatus; label: string }[]> = {
        OPEN: [{ status: "OCCUPIED", label: "Mark Occupied" }, { status: "CLOSED", label: "Close Table" }],
        OCCUPIED: [{ status: "OPEN", label: "Mark Open" }, { status: "CLOSED", label: "Close Table" }],
        CLOSED: [{ status: "OPEN", label: "Open Table" }],
      };
      return <article key={table.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/4 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div><div className="flex flex-wrap items-center gap-3"><h2 className="font-semibold text-white">Table {table.tableNumber}{table.label ? ` · ${table.label}` : ""}</h2><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[table.status]}`}>{table.status}</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${table.isActive ? "bg-white/10 text-white/50" : "bg-white/10 text-white/50"}`}>{table.isActive ? "Active" : "Inactive"}</span></div>{orderManagementEnabled && <><p className="mt-2 text-xs font-semibold text-white/60">Orders</p>{tableOrders.length ? <ul className="mt-1 space-y-1 text-xs text-white/55">{tableOrders.map((order) => <li key={order.id}>#{order.orderNumber} · {order.status} · ₹{order.total}</li>)}</ul> : <p className="mt-1 text-xs text-white/40">No orders yet</p>}</>}{tableOrderingEnabled && <p className="mt-2 text-xs text-white/40">Menu URL: /menu/{restaurantSlug}?table={table.tableNumber}</p>}</div>
      <p className="text-xs text-white/60">Capacity: {table.capacity ?? "Not set — unavailable for reservations"}</p>
      <div className="flex flex-wrap gap-2">
        {orderManagementEnabled && tableOrders.length > 0 && <a href={`/admin/${encodeURIComponent(restaurantSlug)}/orders#order-${encodeURIComponent(tableOrders[0].id)}`} className="inline-flex h-9 items-center rounded-lg border border-white/15 px-3 text-xs text-white/80 hover:bg-white/10">View Orders</a>}
        {actions[table.status].map((action) => <button key={action.status} onClick={() => void setStatus(table, action.status)} className="h-9 rounded-lg border border-white/15 px-3 text-xs text-white/80 hover:bg-white/10">{action.label}</button>)}
        {tableOrderingEnabled && <><button onClick={() => setQrTable((current) => current === table.id ? null : table.id)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs text-white/80 hover:bg-white/10"><QrCode className="h-4 w-4" />QR</button>
        <button onClick={() => void copy(table)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs text-white/80 hover:bg-white/10"><Copy className="h-4 w-4" />Copy URL</button></>}
        <button onClick={() => void edit(table)} aria-label={`Edit table ${table.tableNumber}`} className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-white/70 hover:bg-white/10"><Pencil className="h-4 w-4" /></button>
        <button onClick={() => void toggle(table)} className="h-9 rounded-lg border border-white/15 px-3 text-xs text-white/70 hover:bg-white/10">{table.isActive ? "Deactivate" : "Activate"}</button>
        <button onClick={() => void remove(table)} aria-label={`Delete table ${table.tableNumber}`} className="grid h-9 w-9 place-items-center rounded-lg border border-rose-400/20 text-rose-300 hover:bg-rose-400/10"><Trash2 className="h-4 w-4" /></button>
      </div>
      {tableOrderingEnabled && qrTable === table.id && <div className="w-full border-t border-white/10 pt-4 sm:basis-full sm:flex sm:items-center sm:gap-5">{qrDataUrl ? <Image unoptimized src={qrDataUrl} alt={`QR code for Table ${table.tableNumber}`} width={180} height={180} className="rounded-xl bg-white p-2" /> : <div className="grid h-[180px] w-[180px] place-items-center rounded-xl bg-white/10 text-xs text-white/50">Generating QR...</div>}<div className="mt-3 min-w-0 sm:mt-0"><p className="font-semibold text-white">Table {table.tableNumber} QR</p>{!table.isActive && <p className="mt-1 text-xs text-amber-300">This table is inactive, so new orders are blocked.</p>}<a className="mt-2 block break-all text-xs text-sky-300 underline" href={menuUrl(table.tableNumber)} target="_blank" rel="noopener noreferrer">{menuUrl(table.tableNumber)}</a>{qrDataUrl && <a href={qrDataUrl} download={`table-${table.tableNumber}-qr.png`} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-black"><Download className="h-4 w-4" />Download QR</a>}</div></div>}
    </article>;
    })}</div>
    {tables.length === 0 && <p className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-white/45">No tables created yet.</p>}
  </div>;
}
