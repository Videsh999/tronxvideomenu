"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  Package,
  Pencil,
  Plus,
  Search,
  Scale,
  X,
} from "lucide-react";
import type { Ingredient, InventoryMovement, Recipe } from "@/types";

type Props = { restaurantName: string; restaurantSlug?: string };

type EditorMode = "create" | "edit";
type AdjustKind = "ADJUSTMENT" | "WASTAGE" | "RECONCILIATION";

const UNITS = ["g", "kg", "ml", "l", "pcs", "dozen"] as const;

function money(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isLowStock(item: Ingredient) {
  return typeof item.reorderLevel === "number" && item.quantityOnHand <= item.reorderLevel;
}

export default function InventoryManager({ restaurantName, restaurantSlug }: Props) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [lowStock, setLowStock] = useState<Ingredient[]>([]);
  const [valuation, setValuation] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [baseUnit, setBaseUnit] = useState<(typeof UNITS)[number]>("kg");
  const [qty, setQty] = useState(0);
  const [cost, setCost] = useState(0);
  const [reorderLevel, setReorderLevel] = useState(0);
  const [reorderQuantity, setReorderQuantity] = useState(0);
  const [expiryDate, setExpiryDate] = useState("");

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<Ingredient | null>(null);
  const [adjustKind, setAdjustKind] = useState<AdjustKind>("ADJUSTMENT");
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustNote, setAdjustNote] = useState("");
  const [countedQty, setCountedQty] = useState(0);

  const ingredientNameById = useMemo(
    () => new Map(ingredients.map((item) => [item.id, item.name])),
    [ingredients],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ingredients
      .filter((item) => (showArchived ? true : item.isActive !== false))
      .filter((item) => {
        if (!q) return true;
        return (
          item.name.toLowerCase().includes(q) ||
          (item.sku ?? "").toLowerCase().includes(q)
        );
      });
  }, [ingredients, query, showArchived]);

  async function refresh() {
    const [ingRes, recipeRes, adjRes] = await Promise.all([
      fetch("/api/inventory/ingredients"),
      fetch("/api/inventory/recipes"),
      fetch("/api/inventory/adjustments"),
    ]);
    const [ingJson, recipeJson, adjJson] = await Promise.all([
      ingRes.json(),
      recipeRes.json(),
      adjRes.json(),
    ]);
    if (ingJson.success) setIngredients(ingJson.data);
    if (recipeJson.success) setRecipes(recipeJson.data);
    if (adjJson.success) {
      setMovements(adjJson.data.movements);
      setLowStock(adjJson.data.lowStock);
      setValuation(adjJson.data.valuation.totalValue);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function resetEditor() {
    setName("");
    setSku("");
    setBaseUnit("kg");
    setQty(0);
    setCost(0);
    setReorderLevel(0);
    setReorderQuantity(0);
    setExpiryDate("");
    setEditing(null);
  }

  function openCreate() {
    resetEditor();
    setEditorMode("create");
    setEditorOpen(true);
    setError(null);
  }

  function openEdit(item: Ingredient) {
    setEditing(item);
    setEditorMode("edit");
    setName(item.name);
    setSku(item.sku ?? "");
    setBaseUnit(item.baseUnit);
    setQty(item.quantityOnHand);
    setCost(item.averageUnitCost ?? item.lastPurchaseUnitCost ?? 0);
    setReorderLevel(item.reorderLevel ?? 0);
    setReorderQuantity(item.reorderQuantity ?? 0);
    setExpiryDate(item.expiryDate ? item.expiryDate.slice(0, 10) : "");
    setEditorOpen(true);
    setError(null);
  }

  function openAdjust(item: Ingredient) {
    setAdjustTarget(item);
    setAdjustKind("ADJUSTMENT");
    setAdjustQty(0);
    setCountedQty(item.quantityOnHand);
    setAdjustNote("");
    setAdjustOpen(true);
    setError(null);
  }

  async function onSaveIngredient(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (editorMode === "create") {
        const response = await fetch("/api/inventory/ingredients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            baseUnit,
            sku: sku.trim() || undefined,
            quantityOnHand: qty,
            averageUnitCost: cost || undefined,
            reorderLevel: reorderLevel || undefined,
            reorderQuantity: reorderQuantity || undefined,
            expiryDate: expiryDate || undefined,
          }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Could not create ingredient");
        setMessage(`Added ${json.data.name}`);
      } else if (editing) {
        const response = await fetch(`/api/inventory/ingredients/${encodeURIComponent(editing.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            baseUnit,
            sku: sku.trim() ? sku.trim() : null,
            averageUnitCost: cost > 0 ? cost : null,
            reorderLevel: reorderLevel > 0 ? reorderLevel : null,
            reorderQuantity: reorderQuantity > 0 ? reorderQuantity : null,
            expiryDate: expiryDate.trim() ? expiryDate.trim() : null,
          }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Could not update ingredient");
        setMessage(`Updated ${json.data.name}`);
      }
      setEditorOpen(false);
      resetEditor();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function onAdjust(event: FormEvent) {
    event.preventDefault();
    if (!adjustTarget) return;
    setBusy(true);
    setError(null);
    try {
      const body =
        adjustKind === "RECONCILIATION"
          ? {
              ingredientId: adjustTarget.id,
              kind: "RECONCILIATION" as const,
              quantityDelta: 0,
              countedQuantity: countedQty,
              note: adjustNote || undefined,
            }
          : {
              ingredientId: adjustTarget.id,
              kind: adjustKind,
              quantityDelta:
                adjustKind === "WASTAGE" ? -Math.abs(adjustQty) : adjustQty,
              note: adjustNote || undefined,
            };

      const response = await fetch("/api/inventory/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error || "Could not adjust stock");
      setMessage(
        adjustKind === "RECONCILIATION"
          ? `Reconciled ${adjustTarget.name} to ${countedQty} ${adjustTarget.baseUnit}`
          : `Stock updated for ${adjustTarget.name}`,
      );
      setAdjustOpen(false);
      setAdjustTarget(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjustment failed");
    } finally {
      setBusy(false);
    }
  }

  async function archiveIngredient(item: Ingredient) {
    if (!window.confirm(`Archive “${item.name}”? It will be hidden from active stock lists.`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/inventory/ingredients/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error || "Could not archive ingredient");
      setMessage(`Archived ${item.name}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setBusy(false);
    }
  }

  async function restoreIngredient(item: Ingredient) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/inventory/ingredients/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error || "Could not restore ingredient");
      setMessage(`Restored ${item.name}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  }

  const recipesHref = restaurantSlug
    ? `/admin/${encodeURIComponent(restaurantSlug)}/inventory/recipes`
    : undefined;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Inventory</p>
          <h1 className="font-serif text-3xl text-neutral-900">{restaurantName}</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Track ingredients, costs, reorder points, stock adjustments, and wastage.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {recipesHref ? (
            <Link
              href={recipesHref}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-neutral-200 px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              <Package className="h-4 w-4" /> Recipes
            </Link>
          ) : null}
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" /> Add ingredient
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Stock value", value: money(valuation) },
          { label: "Ingredients", value: String(ingredients.filter((i) => i.isActive !== false).length) },
          { label: "Low stock", value: String(lowStock.length) },
          { label: "Recipes", value: String(recipes.length) },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">{card.value}</p>
          </div>
        ))}
      </div>

      {message ? (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {lowStock.length > 0 ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <h2 className="flex items-center gap-2 font-semibold text-rose-900">
            <AlertTriangle className="h-4 w-4" /> Low stock alerts
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-rose-800">
            {lowStock.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {item.name}: {item.quantityOnHand} {item.baseUnit} (reorder at {item.reorderLevel}
                  {item.reorderQuantity ? ` · suggest +${item.reorderQuantity}` : ""})
                </span>
                <button
                  type="button"
                  onClick={() => openAdjust(item)}
                  className="rounded-lg border border-rose-300 px-2.5 py-1 text-xs font-semibold"
                >
                  Adjust
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or SKU"
            className="h-11 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3 text-sm"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            className="rounded border-neutral-300"
          />
          Show archived
        </label>
      </div>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-3">Ingredient</th>
                <th className="px-4 py-3">On hand</th>
                <th className="px-4 py-3">Unit cost</th>
                <th className="px-4 py-3">Reorder</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const low = isLowStock(item);
                return (
                  <tr key={item.id} className="border-t border-neutral-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-900">
                        {item.name}
                        {item.isActive === false ? (
                          <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-neutral-500">
                            Archived
                          </span>
                        ) : null}
                        {low ? (
                          <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-700">
                            Low
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {item.sku ? `SKU ${item.sku} · ` : ""}
                        {item.baseUnit}
                      </p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {item.quantityOnHand} {item.baseUnit}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {money(item.averageUnitCost ?? item.lastPurchaseUnitCost)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {item.reorderLevel != null ? item.reorderLevel : "—"}
                    </td>
                    <td className="px-4 py-3">{item.expiryDate ? item.expiryDate.slice(0, 10) : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="inline-flex h-9 items-center gap-1 rounded-lg border border-neutral-200 px-2.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => openAdjust(item)}
                          disabled={item.isActive === false}
                          className="inline-flex h-9 items-center gap-1 rounded-lg border border-neutral-200 px-2.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
                        >
                          <Scale className="h-3.5 w-3.5" /> Adjust
                        </button>
                        {item.isActive === false ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void restoreIngredient(item)}
                            className="inline-flex h-9 items-center gap-1 rounded-lg border border-neutral-200 px-2.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void archiveIngredient(item)}
                            className="inline-flex h-9 items-center gap-1 rounded-lg border border-rose-200 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            <Archive className="h-3.5 w-3.5" /> Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-neutral-500">
                    No ingredients match. Add flour, oil, proteins — then map recipes to dishes.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="font-semibold">Recent movements</h2>
        <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm">
          {movements.slice(0, 50).map((movement) => (
            <li
              key={movement.id}
              className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 pb-2"
            >
              <span>
                <span className="font-medium text-neutral-900">
                  {ingredientNameById.get(movement.ingredientId) ?? movement.ingredientId}
                </span>
                <span className="text-neutral-500">
                  {" "}
                  · {movement.kind.replaceAll("_", " ")} · {movement.quantityDelta > 0 ? "+" : ""}
                  {movement.quantityDelta}
                  {movement.note ? ` · ${movement.note}` : ""}
                </span>
                <span className="mt-0.5 block text-xs text-neutral-400">
                  Balance after {movement.balanceAfter}
                </span>
              </span>
              <span className="shrink-0 text-neutral-500">
                {new Date(movement.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
          {movements.length === 0 ? (
            <li className="text-neutral-500">No stock movements yet. Adjustments and wastage will appear here.</li>
          ) : null}
        </ul>
      </section>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-neutral-900">
                  {editorMode === "create" ? "Add ingredient" : "Edit ingredient"}
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  {editorMode === "edit"
                    ? "Metadata only — use Adjust to change on-hand quantity (keeps the ledger accurate)."
                    : "Set opening stock, unit cost, and reorder points."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={(event) => void onSaveIngredient(event)} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1.5 block font-medium text-neutral-700">Name</span>
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-11 w-full rounded-xl border border-neutral-200 px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-neutral-700">SKU</span>
                <input
                  value={sku}
                  onChange={(event) => setSku(event.target.value)}
                  className="h-11 w-full rounded-xl border border-neutral-200 px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-neutral-700">Unit</span>
                <select
                  value={baseUnit}
                  onChange={(event) => setBaseUnit(event.target.value as (typeof UNITS)[number])}
                  className="h-11 w-full rounded-xl border border-neutral-200 px-3"
                >
                  {UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>
              {editorMode === "create" ? (
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-neutral-700">Opening qty</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={qty}
                    onChange={(event) => setQty(Number(event.target.value) || 0)}
                    className="h-11 w-full rounded-xl border border-neutral-200 px-3"
                  />
                </label>
              ) : (
                <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
                  On hand: <strong className="text-neutral-900">{editing?.quantityOnHand} {editing?.baseUnit}</strong>
                </div>
              )}
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-neutral-700">Unit cost</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={cost || ""}
                  onChange={(event) => setCost(Number(event.target.value) || 0)}
                  className="h-11 w-full rounded-xl border border-neutral-200 px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-neutral-700">Reorder level</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={reorderLevel || ""}
                  onChange={(event) => setReorderLevel(Number(event.target.value) || 0)}
                  className="h-11 w-full rounded-xl border border-neutral-200 px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-neutral-700">Reorder qty</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={reorderQuantity || ""}
                  onChange={(event) => setReorderQuantity(Number(event.target.value) || 0)}
                  className="h-11 w-full rounded-xl border border-neutral-200 px-3"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1.5 block font-medium text-neutral-700">Expiry date</span>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(event) => setExpiryDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-neutral-200 px-3"
                />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="h-11 flex-1 rounded-xl border border-neutral-200 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="h-11 flex-1 rounded-xl bg-neutral-900 text-sm font-bold text-white disabled:opacity-50"
                >
                  {busy ? "Saving…" : editorMode === "create" ? "Add ingredient" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {adjustOpen && adjustTarget ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-neutral-900">Adjust stock</h3>
                <p className="mt-1 text-sm text-neutral-500">
                  {adjustTarget.name} · on hand {adjustTarget.quantityOnHand} {adjustTarget.baseUnit}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustOpen(false)}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={(event) => void onAdjust(event)} className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {(["ADJUSTMENT", "WASTAGE", "RECONCILIATION"] as AdjustKind[]).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setAdjustKind(kind)}
                    className={`min-h-10 rounded-xl px-2 text-xs font-semibold ${
                      adjustKind === kind
                        ? "bg-neutral-900 text-white"
                        : "border border-neutral-200 text-neutral-700"
                    }`}
                  >
                    {kind === "ADJUSTMENT" ? "Adjust" : kind === "WASTAGE" ? "Wastage" : "Count"}
                  </button>
                ))}
              </div>
              {adjustKind === "RECONCILIATION" ? (
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-neutral-700">Counted quantity</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={countedQty}
                    onChange={(event) => setCountedQty(Number(event.target.value) || 0)}
                    className="h-11 w-full rounded-xl border border-neutral-200 px-3"
                  />
                </label>
              ) : (
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-neutral-700">
                    {adjustKind === "WASTAGE" ? "Qty to write off" : "Qty delta (+ receive / − reduce)"}
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={adjustQty || ""}
                    onChange={(event) => setAdjustQty(Number(event.target.value) || 0)}
                    className="h-11 w-full rounded-xl border border-neutral-200 px-3"
                  />
                </label>
              )}
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-neutral-700">Note</span>
                <input
                  value={adjustNote}
                  onChange={(event) => setAdjustNote(event.target.value)}
                  maxLength={500}
                  placeholder="Optional reason"
                  className="h-11 w-full rounded-xl border border-neutral-200 px-3"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustOpen(false)}
                  className="h-11 flex-1 rounded-xl border border-neutral-200 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="h-11 flex-1 rounded-xl bg-neutral-900 text-sm font-bold text-white disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Apply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
