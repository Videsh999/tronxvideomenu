"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, Search, Trash2 } from "lucide-react";
import type { Category, Dish, RestaurantTable } from "@/types";
import { computeBillTotals, lineItemTotal } from "@/lib/order-pricing";

type CartLine = {
  key: string;
  dishId: string;
  name: string;
  variantId?: string;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  note: string;
  addons: { addonId: string; name: string; price: number; groupId: string }[];
};

type Props = {
  slug: string;
  currency: string;
  taxRatePercent: number;
  taxLabel: string;
  categories: Category[];
  dishes: Dish[];
  tables: RestaurantTable[];
  initialTableNumber?: number | null;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function CaptainOrderPad({
  slug,
  currency,
  taxRatePercent,
  taxLabel,
  categories,
  dishes,
  tables,
  initialTableNumber = null,
}: Props) {
  const [tableNumber, setTableNumber] = useState<number | "">(
    initialTableNumber && tables.some((table) => table.tableNumber === initialTableNumber)
      ? initialTableNumber
      : "",
  );
  const [categoryId, setCategoryId] = useState("ALL");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [guestName, setGuestName] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [pending, startTransition] = useTransition();
  const [customizing, setCustomizing] = useState<Dish | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string[]>>({});

  const availableDishes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dishes.filter((dish) => {
      if (!dish.isAvailable) return false;
      if (categoryId !== "ALL" && dish.categoryId !== categoryId) return false;
      if (!q) return true;
      return dish.name.toLowerCase().includes(q) || (dish.sku ?? "").toLowerCase().includes(q);
    });
  }, [dishes, categoryId, query]);

  const totals = useMemo(
    () =>
      computeBillTotals({
        lines: cart.map((line) => ({
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          addonTotals: line.addons.map((addon) => addon.price),
          itemDiscountAmount: 0,
        })),
        billDiscountAmount: 0,
        taxRatePercent,
      }),
    [cart, taxRatePercent],
  );

  function dishNeedsCustomize(dish: Dish) {
    const variants = (dish.variants ?? []).filter((variant) => variant.isAvailable !== false);
    const groups = (dish.addonGroups ?? []).filter((group) => group.isActive !== false);
    return variants.length > 0 || groups.length > 0;
  }

  function beginCustomize(dish: Dish) {
    if (!dishNeedsCustomize(dish)) {
      addSimple(dish);
      return;
    }
    const firstVariant = (dish.variants ?? []).find((variant) => variant.isAvailable !== false);
    setSelectedVariantId(firstVariant?.id ?? "");
    setSelectedAddons({});
    setCustomizing(dish);
  }

  function addSimple(dish: Dish) {
    setCart((prev) => [
      ...prev,
      {
        key: `${dish.id}-${Date.now()}`,
        dishId: dish.id,
        name: dish.name,
        unitPrice: dish.price,
        quantity: 1,
        note: "",
        addons: [],
      },
    ]);
    setMessage(`Added ${dish.name}`);
  }

  function confirmCustomize() {
    if (!customizing) return;
    const variants = customizing.variants ?? [];
    const availableVariants = variants.filter((variant) => variant.isAvailable !== false);
    if (availableVariants.length > 0 && !selectedVariantId) {
      setMessage(`Select a variant for ${customizing.name}.`);
      return;
    }
    const variant = availableVariants.find((entry) => entry.id === selectedVariantId);
    const addons = (customizing.addonGroups ?? []).flatMap((group) => {
      if (group.isActive === false) return [];
      return (selectedAddons[group.id] ?? []).flatMap((addonId) => {
        const addon = group.addons.find((entry) => entry.id === addonId);
        if (!addon) return [];
        return [{ addonId: addon.id, name: addon.name, price: addon.price, groupId: group.id }];
      });
    });
    setCart((prev) => [
      ...prev,
      {
        key: `${customizing.id}-${selectedVariantId}-${Date.now()}`,
        dishId: customizing.id,
        name: customizing.name,
        variantId: variant?.id,
        variantName: variant?.name,
        unitPrice: variant?.price ?? customizing.price,
        quantity: 1,
        note: "",
        addons,
      },
    ]);
    setMessage(`Added ${customizing.name}${variant ? ` · ${variant.name}` : ""}`);
    setCustomizing(null);
  }

  function placeOrder() {
    if (tableNumber === "" || Number(tableNumber) < 1) {
      setMessage("Select an assigned table first.");
      return;
    }
    if (cart.length === 0) {
      setMessage("Add at least one item.");
      return;
    }
    startTransition(async () => {
      try {
        const phone = customerPhone.trim();
        const response = await fetch("/api/captain/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableNumber: Number(tableNumber),
            guestName: guestName.trim() || undefined,
            orderNote: orderNote.trim() || undefined,
            customerPhone: phone || undefined,
            idempotencyKey,
            sendToKitchen: true,
            items: cart.map((line) => ({
              dishId: line.dishId,
              variantId: line.variantId,
              quantity: line.quantity,
              note: line.note || undefined,
              selections: Object.entries(
                line.addons.reduce<Record<string, string[]>>((acc, addon) => {
                  acc[addon.groupId] = [...(acc[addon.groupId] ?? []), addon.addonId];
                  return acc;
                }, {}),
              ).map(([groupId, addonIds]) => ({
                groupId,
                addons: addonIds.map((addonId) => ({ addonId })),
              })),
            })),
          }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Unable to place order");
        setCart([]);
        setGuestName("");
        setOrderNote("");
        setCustomerPhone("");
        setIdempotencyKey(crypto.randomUUID());
        const warning = json.meta?.warning ? ` · ${json.meta.warning}` : "";
        setMessage(
          `Order #${json.data.orderNumber} ${json.meta?.appended ? "updated" : "placed"} for table ${tableNumber}${json.meta?.sentToKitchen ? " · sent to kitchen" : ""}${warning}`,
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to place order");
      }
    });
  }

  if (tables.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center">
        <h1 className="text-xl font-bold text-amber-950">No tables assigned</h1>
        <p className="mt-2 text-sm text-amber-900/80">
          Ask a manager to assign tables to your captain account before taking walk-in orders.
        </p>
        <Link href={`/captain/${slug}/tables`} className="mt-4 inline-flex text-sm font-semibold text-amber-950 underline">
          View tables
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 pb-24 lg:pb-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/captain/${slug}`} className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Take order</h1>
          <p className="text-sm text-neutral-500">Walk-in guests — phone optional. Prices validated on the server.</p>
        </div>
        <label className="text-sm font-medium text-neutral-700">
          Table
          <select
            value={tableNumber}
            onChange={(event) => setTableNumber(event.target.value ? Number(event.target.value) : "")}
            className={`mt-1 block min-h-12 min-w-[10rem] rounded-xl border px-3 ${
              tableNumber === "" ? "border-rose-400 ring-2 ring-rose-200" : "border-neutral-200"
            }`}
          >
            <option value="">Select table</option>
            {tables.map((table) => (
              <option key={table.id} value={table.tableNumber}>
                {table.tableNumber}
                {table.label ? ` · ${table.label}` : ""} · {table.status}
              </option>
            ))}
          </select>
        </label>
      </header>

      {message ? (
        <p
          role="status"
          className={`rounded-xl px-3 py-2 text-sm font-medium ${
            /unable|select|add at least|not assigned|failed|invalid/i.test(message)
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search dishes"
              className="min-h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-3"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoryId("ALL")}
              className={`min-h-10 shrink-0 rounded-xl px-3 text-sm ${
                categoryId === "ALL" ? "bg-neutral-900 text-white" : "bg-neutral-100"
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                className={`min-h-10 shrink-0 rounded-xl px-3 text-sm ${
                  categoryId === category.id ? "bg-neutral-900 text-white" : "bg-neutral-100"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
          <div className="grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {availableDishes.map((dish) => (
              <button
                key={dish.id}
                type="button"
                onClick={() => beginCustomize(dish)}
                className="min-h-[4.5rem] rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-left hover:border-neutral-900"
              >
                <p className="line-clamp-2 text-sm font-semibold leading-snug">{dish.name}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {money((dish.variants?.[0]?.price ?? dish.price) as number, currency)}
                </p>
              </button>
            ))}
          </div>
        </section>

        <aside className="flex flex-col rounded-2xl border border-neutral-900 bg-neutral-900 p-4 text-white">
          <h2 className="text-lg font-semibold">Cart ({cart.reduce((sum, line) => sum + line.quantity, 0)})</h2>
          <ul className="mt-3 max-h-64 flex-1 space-y-2 overflow-y-auto">
            {cart.length === 0 ? (
              <li className="rounded-xl border border-dashed border-white/20 p-4 text-center text-sm text-white/60">
                Tap dishes to add
              </li>
            ) : (
              cart.map((line) => (
                <li key={line.key} className="rounded-xl bg-white/10 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">
                      {line.name}
                      {line.variantName ? ` · ${line.variantName}` : ""}
                    </p>
                    <button
                      type="button"
                      aria-label={`Remove ${line.name}`}
                      onClick={() => setCart((prev) => prev.filter((entry) => entry.key !== line.key))}
                      className="rounded-lg bg-rose-500/30 p-1.5 text-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="grid h-9 w-9 place-items-center rounded-lg bg-white/15"
                        onClick={() =>
                          setCart((prev) =>
                            prev
                              .map((entry) =>
                                entry.key === line.key
                                  ? { ...entry, quantity: Math.max(0, entry.quantity - 1) }
                                  : entry,
                              )
                              .filter((entry) => entry.quantity > 0),
                          )
                        }
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-6 text-center font-semibold">{line.quantity}</span>
                      <button
                        type="button"
                        className="grid h-9 w-9 place-items-center rounded-lg bg-white/15"
                        onClick={() =>
                          setCart((prev) =>
                            prev.map((entry) =>
                              entry.key === line.key ? { ...entry, quantity: entry.quantity + 1 } : entry,
                            ),
                          )
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="text-sm font-semibold">
                      {money(
                        lineItemTotal({
                          unitPrice: line.unitPrice,
                          quantity: line.quantity,
                          addonTotals: line.addons.map((addon) => addon.price),
                          itemDiscountAmount: 0,
                        }),
                        currency,
                      )}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>

          <label className="mt-3 block text-xs text-white/70">
            Guest name (optional)
            <input
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              className="mt-1 min-h-10 w-full rounded-xl border border-white/20 bg-transparent px-3 text-sm text-white"
            />
          </label>
          <label className="mt-2 block text-xs text-white/70">
            Phone (optional)
            <input
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              className="mt-1 min-h-10 w-full rounded-xl border border-white/20 bg-transparent px-3 text-sm text-white"
              placeholder="Not required for walk-ins"
            />
          </label>
          <label className="mt-2 block text-xs text-white/70">
            Order note
            <textarea
              value={orderNote}
              onChange={(event) => setOrderNote(event.target.value)}
              className="mt-1 min-h-14 w-full rounded-xl border border-white/20 bg-transparent px-3 py-2 text-sm text-white"
            />
          </label>

          <div className="mt-3 space-y-1 border-t border-white/15 pt-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{money(totals.itemsSubtotal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span>
                {taxLabel} ({taxRatePercent}%)
              </span>
              <span>{money(totals.taxAmount, currency)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>{money(totals.total, currency)}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={pending || cart.length === 0 || tableNumber === ""}
            onClick={placeOrder}
            className="mt-3 min-h-12 rounded-xl bg-[#e7c27d] text-base font-bold text-neutral-900 disabled:opacity-40"
          >
            {pending ? "Sending…" : "Confirm & send to kitchen"}
          </button>
        </aside>
      </div>

      {customizing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
            <h3 className="text-xl font-semibold">{customizing.name}</h3>
            {(customizing.variants ?? []).filter((variant) => variant.isAvailable !== false).length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {customizing.variants!
                  .filter((variant) => variant.isAvailable !== false)
                  .map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={`min-h-11 rounded-xl px-3 text-sm ${
                        selectedVariantId === variant.id ? "bg-neutral-900 text-white" : "bg-neutral-100"
                      }`}
                    >
                      {variant.name} · {money(variant.price, currency)}
                    </button>
                  ))}
              </div>
            ) : null}
            {(customizing.addonGroups ?? [])
              .filter((group) => group.isActive !== false)
              .map((group) => (
                <div key={group.id} className="mt-4">
                  <p className="text-sm font-medium text-neutral-700">
                    {group.name}
                    {group.isRequired ? " *" : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.addons
                      .filter((addon) => addon.isActive !== false && addon.isAvailable !== false)
                      .map((addon) => {
                        const selected = (selectedAddons[group.id] ?? []).includes(addon.id);
                        return (
                          <button
                            key={addon.id}
                            type="button"
                            onClick={() => {
                              setSelectedAddons((prev) => {
                                const current = prev[group.id] ?? [];
                                if (selected) {
                                  return { ...prev, [group.id]: current.filter((id) => id !== addon.id) };
                                }
                                return { ...prev, [group.id]: [...current, addon.id] };
                              });
                            }}
                            className={`min-h-10 rounded-xl px-3 text-sm ${
                              selected ? "bg-neutral-900 text-white" : "bg-neutral-100"
                            }`}
                          >
                            {addon.name} · {money(addon.price, currency)}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setCustomizing(null)}
                className="min-h-11 flex-1 rounded-xl border border-neutral-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCustomize}
                className="min-h-11 flex-1 rounded-xl bg-neutral-900 text-white"
              >
                Add to cart
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
