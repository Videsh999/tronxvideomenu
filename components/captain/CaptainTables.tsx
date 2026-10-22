import { Users } from "lucide-react";
import type { RestaurantTable } from "@/types";

const statusStyle: Record<RestaurantTable["status"], { badge: string; dot: string; label: string }> = {
  OPEN: { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-400", label: "Open" },
  OCCUPIED: { badge: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-400", label: "Occupied" },
  CLOSED: { badge: "border-neutral-300 bg-neutral-50 text-neutral-500", dot: "bg-neutral-300", label: "Closed" },
};

export default function CaptainTables({ initialTables }: { initialTables: RestaurantTable[] }) {
  const counts = initialTables.reduce<Record<RestaurantTable["status"], number>>((acc, table) => ({ ...acc, [table.status]: acc[table.status] + 1 }), { OPEN: 0, OCCUPIED: 0, CLOSED: 0 });
  return <div className="space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-3xl font-bold tracking-tight">Tables</h1><p className="mt-1 text-sm text-neutral-500">Table availability and status are read-only.</p></div>
      <div className="flex flex-wrap gap-2">{(Object.keys(statusStyle) as RestaurantTable["status"][]).map((status) => <span key={status} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle[status].badge}`}><span className={`h-1.5 w-1.5 rounded-full ${statusStyle[status].dot}`} />{statusStyle[status].label} · {counts[status]}</span>)}</div>
    </header>
    {initialTables.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{initialTables.map((table) => <article key={table.id} className={`relative overflow-hidden rounded-2xl border bg-white p-4 sm:p-5 ${table.isActive ? "border-neutral-200" : "border-dashed border-neutral-300 opacity-60"}`}>
      <span className={`absolute inset-x-0 top-0 h-1 ${statusStyle[table.status].dot}`} />
      <div className="flex items-start justify-between gap-2"><p className="text-3xl font-bold tabular-nums">{table.tableNumber}</p><span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle[table.status].badge}`}>{statusStyle[table.status].label}</span></div>
      <p className="mt-2 truncate text-sm text-neutral-500">{table.label || `Table ${table.tableNumber}`}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-neutral-400">{table.capacity ? <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{table.capacity}</span> : <span />}<span>{table.isActive ? "Active" : "Inactive"}</span></div>
    </article>)}</div> : <p className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">No tables have been added.</p>}
  </div>;
}
