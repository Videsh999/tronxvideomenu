"use client";

import { useState } from "react";
import type { Reservation, ReservationStatus } from "@/types";
import { RefreshCw } from "lucide-react";

const statusStyle: Record<ReservationStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-rose-50 text-rose-600",
  COMPLETED: "bg-neutral-100 text-neutral-600",
  NO_SHOW: "bg-neutral-100 text-neutral-600",
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const result = await response.json() as { success: boolean; data?: T; error?: string };
  if (!response.ok || !result.success) throw new Error(result.error ?? "Request failed");
  return result.data as T;
}

export default function ReservationsManager({ initialDate, initialReservations }: { initialDate: string; initialReservations: Reservation[] }) {
  const [date, setDate] = useState(initialDate);
  const [reservations, setReservations] = useState(initialReservations);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async (nextDate = date) => {
    setMessage("");
    try { setReservations(await request<Reservation[]>(`/api/reservations?date=${encodeURIComponent(nextDate)}`)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load reservations."); }
  };

  const changeStatus = async (reservation: Reservation, status: ReservationStatus) => {
    setBusyId(reservation.id); setMessage("");
    try {
      await request<Reservation>(`/api/reservations/${encodeURIComponent(reservation.id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update reservation."); }
    finally { setBusyId(null); }
  };

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Reservations</h1><p className="mt-1 text-sm text-neutral-500">Review and manage bookings for your restaurant.</p></div><div className="flex items-end gap-2"><label className="text-xs text-neutral-500">Reservation date<input type="date" value={date} onChange={(event) => { setDate(event.target.value); void refresh(event.target.value); }} className="mt-1 block h-10 rounded-xl border border-neutral-300 bg-neutral-100 px-3 text-sm text-neutral-900" /></label><button type="button" onClick={() => void refresh()} aria-label="Refresh reservations" className="grid h-10 w-10 place-items-center rounded-xl border border-neutral-300 text-neutral-700"><RefreshCw className="h-4 w-4" /></button></div></header>
    {message && <p role="alert" className="text-sm text-rose-600">{message}</p>}
    <div className="space-y-3">{reservations.map((reservation) => {
      const actions: { status: ReservationStatus; label: string }[] = reservation.status === "PENDING"
        ? [{ status: "CONFIRMED", label: "Confirm" }, { status: "CANCELLED", label: "Cancel" }]
        : reservation.status === "CONFIRMED"
          ? [{ status: "CANCELLED", label: "Cancel" }, { status: "COMPLETED", label: "Complete" }, { status: "NO_SHOW", label: "No Show" }]
          : [];
      return <article key={reservation.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold text-neutral-900">{reservation.customerName}</h2><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[reservation.status]}`}>{reservation.status.replace("_", " ")}</span></div><p className="mt-1 text-sm text-neutral-500">{reservation.customerPhone}{reservation.customerEmail ? ` · ${reservation.customerEmail}` : ""}</p></div><p className="font-mono text-sm font-semibold text-neutral-700">{reservation.startTime}–{reservation.endTime}</p></div>
        <div className="mt-4 grid gap-2 text-sm text-neutral-600 sm:grid-cols-3"><p><span className="text-neutral-400">Table </span>{reservation.tableNumberSnapshot}</p><p><span className="text-neutral-400">Guests </span>{reservation.guestCount}</p><p><span className="text-neutral-400">Date </span>{reservation.reservationDate}</p></div>
        {reservation.specialRequest && <p className="mt-3 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600"><span className="font-semibold text-neutral-700">Request: </span>{reservation.specialRequest}</p>}
        {actions.length > 0 && <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-200 pt-4">{actions.map((action) => <button key={action.status} type="button" disabled={busyId === reservation.id} onClick={() => void changeStatus(reservation, action.status)} className={`h-9 rounded-lg border px-3 text-xs font-semibold disabled:opacity-50 ${action.status === "CANCELLED" ? "border-rose-200 text-rose-600" : "border-neutral-300 text-neutral-700 hover:bg-neutral-100"}`}>{action.label}</button>)}</div>}
      </article>;
    })}</div>
    {reservations.length === 0 && <p className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">No reservations for this date.</p>}
  </div>;
}
