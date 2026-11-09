"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock3, IndianRupee, Users, UtensilsCrossed } from "lucide-react";
import type { OrderSummary, RestaurantTable } from "@/types";
import {
  TABLE_STATUS_LABEL,
  TABLE_STATUS_STYLE,
  enrichCaptainTables,
} from "@/lib/captain-floor";
import CaptainTableStats from "@/components/captain/CaptainTableStats";
import { locationName, locationType } from "@/lib/service-location";

function money(value: number, currency = "INR") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function elapsed(iso?: string) {
  if (!iso) return "—";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function CaptainTables({
  slug,
  captainName,
  initialTables,
  initialOrders,
  assignedTableIds,
  currency = "INR",
}: {
  slug: string;
  captainName: string;
  initialTables: RestaurantTable[];
  initialOrders: OrderSummary[];
  assignedTableIds: string[];
  currency?: string;
}) {
  const assigned = new Set(assignedTableIds);
  const rows = enrichCaptainTables(initialTables, initialOrders, assigned);
  const [activeKind, setActiveKind] = useState<"TABLE" | "ROOM">("TABLE");
  const visibleRows = rows.filter(({ table }) => locationType(table) === activeKind);
  const counts = {
    available: rows.filter((row) => row.table.status === "OPEN").length,
    occupied: rows.filter((row) =>
      ["OCCUPIED", "BILL_REQUESTED", "PAYMENT_PENDING"].includes(row.table.status),
    ).length,
    cleaning: rows.filter((row) => row.table.status === "CLEANING").length,
  };

  if (assigned.size === 0) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
        <h1 className="text-2xl font-bold text-amber-950">No tables assigned</h1>
        <p className="mt-2 text-sm text-amber-900/80">
          Ask your manager to assign tables under Admin → Captains. You cannot run floor service until then.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Floor</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">My Tables &amp; Rooms</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Only tables your manager assigned to you. Tap a table to take a walk-in order, or check Approvals for QR
            orders waiting your tick.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            Available {counts.available}
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
            In service {counts.occupied}
          </span>
          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-700">
            Cleaning {counts.cleaning}
          </span>
          <Link
            href={`/captain/${slug}/take-order`}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-neutral-900 px-4 text-xs font-bold text-white"
          >
            <UtensilsCrossed className="h-3.5 w-3.5" /> New order
          </Link>
        </div>
      </header>

      <div role="tablist" aria-label="Assigned service locations" className="grid grid-cols-2 rounded-2xl bg-neutral-200/70 p-1 sm:max-w-md">
        {(["TABLE", "ROOM"] as const).map((kind) => (
          <button key={kind} type="button" role="tab" aria-selected={activeKind === kind} onClick={() => setActiveKind(kind)} className={`min-h-11 rounded-xl text-sm font-bold ${activeKind === kind ? "bg-white shadow-sm" : "text-neutral-500"}`}>
            {kind === "TABLE" ? "Tables" : "Rooms"} ({rows.filter(({ table }) => locationType(table) === kind).length})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleRows.map(({ table, activeOrder, orderCount, runningTotal, amountPaid }) => (
          <Link
            key={table.id}
            href={`/captain/${slug}/tables/${table.id}`}
            className="group relative overflow-hidden rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-900 hover:shadow-md"
          >
            <span
              className={`absolute inset-x-0 top-0 h-1.5 ${
                table.status === "OPEN"
                  ? "bg-emerald-400"
                  : table.status === "CLEANING"
                    ? "bg-neutral-400"
                    : table.status === "BILL_REQUESTED" || table.status === "PAYMENT_PENDING"
                      ? "bg-violet-500"
                      : "bg-amber-400"
              }`}
            />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-4xl font-black tabular-nums tracking-tight">{table.tableNumber}</p>
                <p className="mt-1 text-sm text-neutral-500">{table.label || locationName(table)}</p>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${TABLE_STATUS_STYLE[table.status]}`}
              >
                {TABLE_STATUS_LABEL[table.status]}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-neutral-600">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {table.capacity ? `${table.capacity} seats` : "— seats"}
              </span>
              <span className="inline-flex items-center gap-1.5 truncate">
                Cap. {captainName.split(" ")[0]}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IndianRupee className="h-3.5 w-3.5" />
                {orderCount ? money(runningTotal, currency) : "No bill"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                {activeOrder ? elapsed(activeOrder.createdAt) : "Idle"}
              </span>
              {orderCount ? <span className="col-span-2 font-semibold text-neutral-800">{orderCount} order{orderCount === 1 ? "" : "s"} · Paid {money(amountPaid, currency)} · Due {money(Math.max(0, runningTotal - amountPaid), currency)}</span> : null}
            </div>

            {activeOrder ? (
              <p className="mt-4 rounded-2xl bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                    Order #{activeOrder.orderNumber} · {activeOrder.status.replace(/_/g, " ")} ·{" "}
                {activeOrder.payment?.status ?? "UNPAID"}
              </p>
            ) : (
              <p className="mt-4 text-xs font-semibold text-emerald-700 group-hover:underline">
                Open workspace to start service →
              </p>
            )}
          </Link>
        ))}
        {visibleRows.length === 0 ? <p className="col-span-full rounded-3xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">No {activeKind === "ROOM" ? "rooms" : "tables"} assigned to you.</p> : null}
      </div>

      <CaptainTableStats />
    </div>
  );
}
