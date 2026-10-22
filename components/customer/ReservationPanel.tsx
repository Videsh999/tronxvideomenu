"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, Search, Users, X } from "lucide-react";
import { getReservationLocalDate } from "@/lib/reservations/time";
import { useI18n } from "./I18nProvider";

type AvailableTable = { id: string; tableNumber: number; label?: string; capacity: number };
type Availability = { endTime: string; tables: AvailableTable[] };
type ReservationResult = { id: string; status: "PENDING" };

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const result = await response.json() as { success: boolean; data?: T; error?: string };
  if (!response.ok || !result.success) throw new Error(result.error ?? "Unable to complete the request.");
  return result.data as T;
}

export default function ReservationPanel({ restaurantSlug, onClose }: { restaurantSlug: string; onClose: () => void }) {
  const { t, tn } = useI18n();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const availabilityRequestRef = useRef(0);
  const [reservationDate, setReservationDate] = useState(getReservationLocalDate());
  const [startTime, setStartTime] = useState("");
  const [guestCount, setGuestCount] = useState("2");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [selectedTable, setSelectedTable] = useState<AvailableTable | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [specialRequest, setSpecialRequest] = useState("");
  const [reservation, setReservation] = useState<ReservationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus({ preventScroll: true });

    const getFocusableElements = () => Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => element.getAttribute("aria-hidden") !== "true");

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusableElements();
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (previousActiveElement?.isConnected) previousActiveElement.focus({ preventScroll: true });
    };
  }, []);

  const invalidateAvailability = () => {
    availabilityRequestRef.current += 1;
    setAvailability(null);
    setSelectedTable(null);
    setError("");
  };

  const checkAvailability = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setAvailability(null); setSelectedTable(null);
    const requestId = ++availabilityRequestRef.current;
    try {
      const result = await post<Availability>("/api/public/reservations/availability", { slug: restaurantSlug, reservationDate, startTime, guestCount: Number(guestCount) });
      if (requestId === availabilityRequestRef.current) setAvailability(result);
    } catch (cause) { if (requestId === availabilityRequestRef.current) setError(cause instanceof Error ? cause.message : "Unable to check availability."); }
    finally { setBusy(false); }
  };

  const submitReservation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selectedTable) return;
    setBusy(true); setError("");
    try {
      const created = await post<ReservationResult>("/api/public/reservations", {
        slug: restaurantSlug,
        tableId: selectedTable.id,
        customerName: name,
        customerPhone: phone,
        customerEmail: email || undefined,
        reservationDate,
        startTime,
        guestCount: Number(guestCount),
        specialRequest: specialRequest || undefined,
      });
      setReservation(created);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create reservation."); }
    finally { setBusy(false); }
  };

  const step = reservation ? 3 : selectedTable ? 2 : availability ? 1 : 0;
  const labelClass = "text-xs font-semibold text-[var(--restaurant-text-muted)]";
  const inputClass = "customer-input mt-1.5 h-12 w-full rounded-xl px-3.5 text-sm";
  const primaryButton = "inline-flex h-12 items-center justify-center rounded-full bg-[var(--restaurant-primary)] px-5 text-sm font-bold text-white shadow-[0_12px_28px_-14px_var(--restaurant-primary)] transition hover:bg-[var(--restaurant-primary-dark)] disabled:cursor-not-allowed disabled:opacity-50";

  return <div role="dialog" aria-modal="true" aria-labelledby="reservation-title" aria-describedby="reservation-description" className="fixed inset-0 z-[70] flex animate-fade-in items-end justify-center bg-black/55 p-0 backdrop-blur-md sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} className="flex max-h-[94dvh] w-full max-w-xl animate-sheet-up flex-col overflow-hidden rounded-t-[2rem] bg-[var(--restaurant-background)] text-[var(--restaurant-text)] shadow-2xl outline-none sm:animate-scale-in sm:rounded-[2rem]">
      <div className="flex justify-center pt-3 sm:hidden"><span className="h-1.5 w-12 rounded-full bg-[var(--customer-border)]" /></div>
      <header className="flex items-start justify-between gap-3 px-5 pb-4 pt-3 sm:px-6 sm:pt-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--restaurant-primary)] text-white"><CalendarDays className="h-5 w-5" /></span>
          <div><h2 id="reservation-title" className="font-serif text-2xl font-semibold leading-tight">{t("reserveTitle")}</h2><p id="reservation-description" className="mt-0.5 text-xs text-[var(--restaurant-text-muted)]">{t("reserveSubtitle")}</p></div>
        </div>
        <button ref={closeButtonRef} type="button" onClick={onClose} aria-label={t("closeReservation")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--customer-cream)] text-[var(--restaurant-text)] transition hover:bg-[var(--customer-border)]"><X className="h-5 w-5" /></button>
      </header>
      {!reservation && <ol className="grid grid-cols-3 gap-2 px-5 pb-4 sm:px-6">
        {[t("stepTime"), t("stepTable"), t("stepDetails")].map((label, index) => <li key={label} className="min-w-0"><span className={`block h-1 rounded-full transition-colors ${index <= step ? "bg-[var(--restaurant-primary)]" : "bg-[var(--customer-border)]"}`} /><span className={`mt-1.5 block truncate text-[11px] font-semibold ${index <= step ? "text-[var(--restaurant-text)]" : "text-[var(--restaurant-text-muted)]/70"}`}>{label}</span></li>)}
      </ol>}
      <div className="overflow-y-auto overscroll-contain border-t border-[var(--customer-border)] px-5 pb-6 pt-5 sm:px-6">
        {reservation ? <div className="space-y-3 py-8 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-700 ring-8 ring-emerald-50/50"><CheckCircle2 className="h-8 w-8" /></div><h3 className="font-serif text-2xl font-semibold">{t("requestReceived")}</h3><p className="mx-auto max-w-sm text-sm leading-relaxed text-[var(--restaurant-text-muted)]">{t("reservationPending", { table: selectedTable?.tableNumber ?? "", date: reservationDate, time: startTime, phone })}</p><button type="button" onClick={onClose} className={`${primaryButton} mt-4 px-8`}>{t("backToMenu")}</button></div> : <>
          <form onSubmit={checkAvailability} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className={`${labelClass} col-span-2 sm:col-span-1`}>{t("date")}<input type="date" min={getReservationLocalDate()} value={reservationDate} onChange={(event) => { invalidateAvailability(); setReservationDate(event.target.value); }} required className={inputClass} /></label>
            <label className={labelClass}>{t("startTime")}<input type="time" step={900} value={startTime} onChange={(event) => { invalidateAvailability(); setStartTime(event.target.value); }} required className={inputClass} /></label>
            <label className={labelClass}>{t("guests")}<input type="number" inputMode="numeric" min={1} max={1000} value={guestCount} onChange={(event) => { invalidateAvailability(); setGuestCount(event.target.value); }} required className={inputClass} /></label>
            <button disabled={busy} className={`${primaryButton} col-span-2 gap-2 sm:col-span-3`}><Search className="h-4 w-4" />{busy && !availability ? t("checking") : t("checkAvailability")}</button>
          </form>
          {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {availability && <div className="mt-6 space-y-4">
            <div className="flex items-end justify-between gap-3"><h3 className="text-sm font-bold">{t("availableTables")}</h3><p className="text-xs text-[var(--restaurant-text-muted)]">{startTime}–{availability.endTime} · {tn("guestsCount", Number(guestCount))}</p></div>
            {availability.tables.length ? <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{availability.tables.map((table) => { const selected = selectedTable?.id === table.id; return <button key={table.id} type="button" aria-pressed={selected} onClick={() => setSelectedTable(table)} className={`relative rounded-2xl border p-3.5 text-left transition ${selected ? "border-[var(--restaurant-primary)] bg-[var(--restaurant-primary)]/[0.06] ring-1 ring-[var(--restaurant-primary)]" : "border-[var(--customer-border)] bg-white hover:border-[var(--restaurant-primary)]/50"}`}>{selected && <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-[var(--restaurant-primary)]" />}<span className="block text-sm font-bold">{t("table", { number: table.tableNumber })}</span><span className="mt-1 flex items-center gap-1 text-xs text-[var(--restaurant-text-muted)]"><Users className="h-3 w-3" />{t("seats", { count: table.capacity })}{table.label ? ` · ${table.label}` : ""}</span></button>; })}</div> : <p className="rounded-2xl border border-dashed border-[var(--customer-border)] p-5 text-center text-sm text-[var(--restaurant-text-muted)]">{t("noTables")}</p>}
            {selectedTable && <form onSubmit={submitReservation} className="grid gap-3 border-t border-[var(--customer-border)] pt-5 sm:grid-cols-2">
              <h3 className="text-sm font-bold sm:col-span-2">{t("yourDetails", { number: selectedTable.tableNumber })}</h3>
              <label className={labelClass}>{t("name")}<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required autoComplete="name" className={inputClass} /></label>
              <label className={labelClass}>{t("phone")}<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} minLength={7} maxLength={24} required autoComplete="tel" className={inputClass} /></label>
              <label className={`${labelClass} sm:col-span-2`}>{t("emailOptional")}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" className={inputClass} /></label>
              <label className={`${labelClass} sm:col-span-2`}>{t("specialRequest")}<textarea value={specialRequest} onChange={(event) => setSpecialRequest(event.target.value)} maxLength={1000} rows={3} placeholder={t("specialPlaceholder")} className="customer-input mt-1.5 w-full resize-y rounded-xl px-3.5 py-2.5 text-sm" /></label>
              <button disabled={busy} className={`${primaryButton} sm:col-span-2`}>{busy ? t("sendingRequest") : t("confirmReservation")}</button>
            </form>}
          </div>}
        </>}
      </div>
    </section>
  </div>;
}
