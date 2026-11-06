"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, Search, Trash2 } from "lucide-react";
import type { CaptainPermissions, Category, Dish, PaymentMethod, RestaurantTable } from "@/types";
import { computeBillTotals, lineItemTotal, roundMoney } from "@/lib/order-pricing";
import { resolveCaptainPermissions } from "@/lib/captain-permissions";

type CartLine = {
  key: string;
  dishId: string;
  name: string;
  variantId?: string;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  itemDiscountAmount: number;
  note: string;
  addons: { addonId: string; name: string; price: number; groupId: string }[];
};

type TableCartState = {
  cart: CartLine[];
  guestName: string;
  orderNote: string;
  customerPhone: string;
  couponCode: string;
  billDiscount: number;
  redeemLoyaltyPoints: number;
  idempotencyKey: string;
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
  permissions?: CaptainPermissions | null;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function emptyCartState(): TableCartState {
  return {
    cart: [],
    guestName: "",
    orderNote: "",
    customerPhone: "",
    couponCode: "",
    billDiscount: 0,
    redeemLoyaltyPoints: 0,
    idempotencyKey: crypto.randomUUID(),
  };
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
  permissions: rawPermissions,
}: Props) {
  const permissions = resolveCaptainPermissions({ permissions: rawPermissions ?? undefined });
  const [tableNumber, setTableNumber] = useState<number | "">(
    initialTableNumber && tables.some((table) => table.tableNumber === initialTableNumber)
      ? initialTableNumber
      : "",
  );
  const [cartsByTable, setCartsByTable] = useState<Record<string, TableCartState>>({});
  const [categoryId, setCategoryId] = useState("ALL");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [customizing, setCustomizing] = useState<Dish | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string[]>>({});
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("CASH");
  const [payAmount, setPayAmount] = useState<number | "">("");

  const tableKey = tableNumber === "" ? "" : String(tableNumber);
  const session = cartsByTable[tableKey] ?? emptyCartState();

  function patchSession(patch: Partial<TableCartState>) {
    if (!tableKey) return;
    setCartsByTable((prev) => ({
      ...prev,
      [tableKey]: { ...(prev[tableKey] ?? emptyCartState()), ...patch },
    }));
  }

  useEffect(() => {
    if (!tableKey) return;
    setCartsByTable((prev) => {
      if (prev[tableKey]) return prev;
      return { ...prev, [tableKey]: emptyCartState() };
    });
  }, [tableKey]);

  const availableDishes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dishes.filter((dish) => {
      if (!dish.isAvailable) return false;
      if (categoryId !== "ALL" && dish.categoryId !== categoryId) return false;
      if (!q) return true;
      return dish.name.toLowerCase().includes(q) || (dish.sku ?? "").toLowerCase().includes(q);
    });
  }, [dishes, categoryId, query]);

  const totals = useMemo(() => {
    const lineTotals = session.cart.map((line) =>
      lineItemTotal({
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        addonTotals: line.addons.map((addon) => addon.price),
        itemDiscountAmount: line.itemDiscountAmount,
      }),
    );
    return computeBillTotals({
      lineTotals,
      billDiscountAmount: session.billDiscount,
      taxRatePercent,
    });
  }, [session.cart, session.billDiscount, taxRatePercent]);

  function dishNeedsCustomize(dish: Dish) {
    const variants = (dish.variants ?? []).filter((variant) => variant.isAvailable !== false);
    const groups = (dish.addonGroups ?? []).filter((group) => group.isActive !== false);
    return variants.length > 0 || groups.length > 0;
  }

  function beginCustomize(dish: Dish) {
    if (!tableKey) {
      setMessage("Select an assigned table first.");
      return;
    }
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
    if (!tableKey) return;
    const next: CartLine = {
      key: `${dish.id}-${Date.now()}`,
      dishId: dish.id,
      name: dish.name,
      unitPrice: dish.price,
      quantity: 1,
      itemDiscountAmount: 0,
      note: "",
      addons: [],
    };
    patchSession({ cart: [...session.cart, next] });
    setMessage(`Added ${dish.name} · Table ${tableNumber}`);
  }

  function confirmCustomize() {
    if (!customizing || !tableKey) return;
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
    const next: CartLine = {
      key: `${customizing.id}-${selectedVariantId}-${Date.now()}`,
      dishId: customizing.id,
      name: customizing.name,
      variantId: variant?.id,
      variantName: variant?.name,
      unitPrice: variant?.price ?? customizing.price,
      quantity: 1,
      itemDiscountAmount: 0,
      note: "",
      addons,
    };
    patchSession({ cart: [...session.cart, next] });
    setMessage(`Added ${customizing.name}${variant ? ` · ${variant.name}` : ""} · Table ${tableNumber}`);
    setCustomizing(null);
  }

  function placeOrder(andPay: boolean) {
    if (tableNumber === "" || Number(tableNumber) < 1) {
      setMessage("Select an assigned table first.");
      return;
    }
    if (session.cart.length === 0) {
      setMessage("Add at least one item.");
      return;
    }
    if (session.couponCode.trim() && !permissions.applyCoupon) {
      setMessage("You are not permitted to apply coupons.");
      return;
    }
    if (session.billDiscount > 0 && !permissions.applyDiscount) {
      setMessage("You are not permitted to apply discounts.");
      return;
    }

    startTransition(async () => {
      try {
        const phone = session.customerPhone.trim();
        const response = await fetch("/api/captain/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableNumber: Number(tableNumber),
            guestName: session.guestName.trim() || undefined,
            orderNote: session.orderNote.trim() || undefined,
            customerPhone: phone || undefined,
            billDiscountAmount: session.billDiscount || undefined,
            couponCode: session.couponCode.trim() || undefined,
            redeemLoyaltyPoints: session.redeemLoyaltyPoints || undefined,
            idempotencyKey: session.idempotencyKey,
            sendToKitchen: true,
            items: session.cart.map((line) => ({
              dishId: line.dishId,
              variantId: line.variantId,
              quantity: line.quantity,
              note: line.note || undefined,
              itemDiscountAmount: line.itemDiscountAmount || undefined,
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

        const orderId = json.data?.id as string | undefined;
        setLastOrderId(orderId ?? null);
        setPayAmount(roundMoney(json.data?.total ?? totals.total));

        if (andPay && orderId) {
          const canPay =
            (payMethod === "CASH" && permissions.recordCashPayment) ||
            (payMethod === "UPI" && permissions.recordUpiPayment) ||
            (payMethod === "CARD" && permissions.recordCardPayment);
          if (!canPay) {
            patchSession(emptyCartState());
            setMessage(
              `Order #${json.data.orderNumber} sent to kitchen — payment not permitted for ${payMethod}. Hand over to cashier.`,
            );
            return;
          }
          const payRes = await fetch(`/api/orders/${encodeURIComponent(orderId)}/payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              method: payMethod,
              amount: Number(payAmount) || json.data.total,
            }),
          });
          const payJson = await payRes.json();
          if (!payJson.success) throw new Error(payJson.error || "Order placed but payment failed");
        }

        patchSession(emptyCartState());
        const warning = json.meta?.warning ? ` · ${json.meta.warning}` : "";
        setMessage(
          `Order #${json.data.orderNumber} ${json.meta?.appended ? "updated" : "placed"} for table ${tableNumber}${
            json.meta?.sentToKitchen ? " · KOT sent to kitchen" : ""
          }${andPay ? ` · paid (${payMethod})` : ""}${warning}`,
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to place order");
      }
    });
  }

  function recordPay() {
    if (!lastOrderId) {
      setMessage("Place an order first, then record payment.");
      return;
    }
    const canPay =
      (payMethod === "CASH" && permissions.recordCashPayment) ||
      (payMethod === "UPI" && permissions.recordUpiPayment) ||
      (payMethod === "CARD" && permissions.recordCardPayment);
    if (!canPay) {
      setMessage(`You are not permitted to record ${payMethod} payments.`);
      return;
    }
    startTransition(async () => {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(lastOrderId)}/payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: payMethod,
            amount: Number(payAmount) || totals.total,
          }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Unable to record payment");
        setMessage(`Payment recorded (${payMethod}).`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to record payment");
      }
    });
  }

  if (tables.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center">
        <h1 className="text-xl font-bold text-amber-950">No tables assigned</h1>
        <p className="mt-2 text-sm text-amber-900/80">
          Ask a manager to assign tables before taking walk-in POS orders.
        </p>
        <Link href={`/captain/${slug}/tables`} className="mt-4 inline-flex text-sm font-semibold text-amber-950 underline">
          View My Tables
        </Link>
      </div>
    );
  }

  const canRecordAny =
    permissions.recordCashPayment || permissions.recordUpiPayment || permissions.recordCardPayment;

  return (
    <div className="mx-auto flex h-[calc(100dvh-5.5rem)] w-full max-w-7xl flex-col gap-3 overflow-hidden pb-20 lg:pb-2">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/captain/${slug}/tables`}
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" /> My Tables
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Captain POS</h1>
          <p className="text-sm text-neutral-500">
            Walk-in ordering for your assigned tables — place order &amp; send to kitchen. No phone required.
          </p>
        </div>
        <label className="text-sm font-medium text-neutral-700">
          Table
          <select
            value={tableNumber}
            onChange={(event) => {
              setTableNumber(event.target.value ? Number(event.target.value) : "");
              setMessage(null);
              setLastOrderId(null);
            }}
            className={`mt-1 block min-h-12 min-w-[11rem] rounded-xl border px-3 ${
              tableNumber === "" ? "border-rose-400 ring-2 ring-rose-200" : "border-neutral-200"
            }`}
          >
            <option value="">Select table</option>
            {tables.map((table) => (
              <option key={table.id} value={table.tableNumber}>
                T{table.tableNumber}
                {table.label ? ` · ${table.label}` : ""} · {table.status}
              </option>
            ))}
          </select>
        </label>
      </header>

      {message ? (
        <p
          role="status"
          className={`shrink-0 rounded-xl px-3 py-2 text-sm font-medium ${
            /unable|select|add at least|not assigned|failed|invalid|not permitted|exceeds/i.test(message)
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {message}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4">
          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search dishes or SKU"
              className="min-h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-3"
            />
          </div>
          <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
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
          <div className="grid min-h-0 flex-1 auto-rows-min content-start grid-cols-2 gap-2 overflow-y-auto overscroll-contain sm:grid-cols-3 xl:grid-cols-4">
            {availableDishes.map((dish) => (
              <button
                key={dish.id}
                type="button"
                onClick={() => beginCustomize(dish)}
                className="min-h-[4.75rem] rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-left hover:border-neutral-900"
              >
                <p className="line-clamp-2 text-sm font-semibold leading-snug">{dish.name}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {money((dish.variants?.[0]?.price ?? dish.price) as number, currency)}
                </p>
              </button>
            ))}
          </div>
        </section>

        <aside className="flex min-h-[22rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-neutral-900 bg-neutral-900 text-white lg:min-h-0">
          <div className="shrink-0 border-b border-white/10 px-4 py-3">
            <h2 className="text-lg font-semibold">
              Current bill
              {tableNumber !== "" ? (
                <span className="ml-2 text-sm font-normal text-white/60">· Table {tableNumber}</span>
              ) : null}
              <span className="ml-2 text-sm font-normal text-white/60">
                ({session.cart.reduce((sum, line) => sum + line.quantity, 0)} items)
              </span>
            </h2>
          </div>

          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3">
            {session.cart.length === 0 ? (
              <li className="flex min-h-[7rem] items-center justify-center rounded-xl border border-dashed border-white/20 p-4 text-center text-sm text-white/60">
                Tap dishes to build this table&apos;s cart. Switching tables keeps each cart separate.
              </li>
            ) : (
              session.cart.map((line) => (
                <li key={line.key} className="rounded-xl bg-white/10 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">
                        {line.name}
                        {line.variantName ? ` · ${line.variantName}` : ""}
                      </p>
                      {line.addons.length > 0 ? (
                        <p className="mt-0.5 text-xs text-white/60">
                          {line.addons.map((addon) => addon.name).join(", ")}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${line.name}`}
                      onClick={() =>
                        patchSession({ cart: session.cart.filter((entry) => entry.key !== line.key) })
                      }
                      className="rounded-lg bg-rose-500/30 p-1.5 text-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="grid h-9 w-9 place-items-center rounded-lg bg-white/15"
                        onClick={() =>
                          patchSession({
                            cart: session.cart
                              .map((entry) =>
                                entry.key === line.key
                                  ? { ...entry, quantity: Math.max(0, entry.quantity - 1) }
                                  : entry,
                              )
                              .filter((entry) => entry.quantity > 0),
                          })
                        }
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-6 text-center font-semibold">{line.quantity}</span>
                      <button
                        type="button"
                        className="grid h-9 w-9 place-items-center rounded-lg bg-white/15"
                        onClick={() =>
                          patchSession({
                            cart: session.cart.map((entry) =>
                              entry.key === line.key ? { ...entry, quantity: entry.quantity + 1 } : entry,
                            ),
                          })
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {permissions.applyDiscount ? (
                      <input
                        type="number"
                        min={0}
                        placeholder="Item disc."
                        aria-label="Item discount"
                        value={line.itemDiscountAmount || ""}
                        onChange={(event) => {
                          const value = Number(event.target.value) || 0;
                          patchSession({
                            cart: session.cart.map((entry) =>
                              entry.key === line.key ? { ...entry, itemDiscountAmount: value } : entry,
                            ),
                          });
                        }}
                        className="w-20 rounded-lg border border-white/20 bg-transparent px-2 py-1 text-xs"
                      />
                    ) : null}
                    <span className="text-sm font-semibold">
                      {money(
                        lineItemTotal({
                          unitPrice: line.unitPrice,
                          quantity: line.quantity,
                          addonTotals: line.addons.map((addon) => addon.price),
                          itemDiscountAmount: line.itemDiscountAmount,
                        }),
                        currency,
                      )}
                    </span>
                  </div>
                  <input
                    value={line.note}
                    onChange={(event) =>
                      patchSession({
                        cart: session.cart.map((entry) =>
                          entry.key === line.key ? { ...entry, note: event.target.value } : entry,
                        ),
                      })
                    }
                    placeholder="Item note / prep instruction"
                    className="mt-2 min-h-9 w-full rounded-lg border border-white/15 bg-transparent px-2 text-xs text-white placeholder:text-white/40"
                  />
                </li>
              ))
            )}
          </ul>

          <div className="shrink-0 space-y-2 border-t border-white/10 bg-neutral-900 p-3 sm:max-h-[min(48vh,26rem)] sm:overflow-y-auto sm:p-4">
            <label className="block text-xs text-white/70">
              Guest name (optional)
              <input
                value={session.guestName}
                onChange={(event) => patchSession({ guestName: event.target.value })}
                disabled={!tableKey}
                className="mt-1 min-h-10 w-full rounded-xl border border-white/20 bg-transparent px-3 text-sm text-white disabled:opacity-40"
              />
            </label>
            <label className="block text-xs text-white/70">
              Phone (optional — not required for walk-ins)
              <input
                value={session.customerPhone}
                onChange={(event) => patchSession({ customerPhone: event.target.value })}
                disabled={!tableKey}
                className="mt-1 min-h-10 w-full rounded-xl border border-white/20 bg-transparent px-3 text-sm text-white disabled:opacity-40"
              />
            </label>
            <label className="block text-xs text-white/70">
              Order note
              <textarea
                value={session.orderNote}
                onChange={(event) => patchSession({ orderNote: event.target.value })}
                disabled={!tableKey}
                rows={2}
                className="mt-1 min-h-10 w-full rounded-xl border border-white/20 bg-transparent px-3 py-2 text-sm text-white disabled:opacity-40"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              {permissions.applyCoupon ? (
                <label className="block text-xs text-white/70">
                  Coupon
                  <input
                    value={session.couponCode}
                    onChange={(event) => patchSession({ couponCode: event.target.value })}
                    disabled={!tableKey}
                    className="mt-1 min-h-10 w-full rounded-xl border border-white/20 bg-transparent px-3 text-sm disabled:opacity-40"
                  />
                </label>
              ) : (
                <div className="rounded-xl border border-white/10 px-3 py-2 text-[11px] text-white/50">
                  Coupons locked
                </div>
              )}
              {permissions.applyDiscount ? (
                <label className="block text-xs text-white/70">
                  Bill discount
                  <input
                    type="number"
                    min={0}
                    value={session.billDiscount || ""}
                    onChange={(event) =>
                      patchSession({ billDiscount: Number(event.target.value) || 0 })
                    }
                    disabled={!tableKey}
                    className="mt-1 min-h-10 w-full rounded-xl border border-white/20 bg-transparent px-3 text-sm disabled:opacity-40"
                  />
                </label>
              ) : (
                <div className="rounded-xl border border-white/10 px-3 py-2 text-[11px] text-white/50">
                  Discounts locked
                </div>
              )}
            </div>

            <div className="space-y-1 border-t border-white/15 pt-3 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{money(totals.itemsSubtotal, currency)}</span>
              </div>
              {totals.billDiscount > 0 ? (
                <div className="flex justify-between text-emerald-200">
                  <span>Discount</span>
                  <span>−{money(totals.billDiscount, currency)}</span>
                </div>
              ) : null}
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
              disabled={pending || session.cart.length === 0 || tableNumber === ""}
              onClick={() => placeOrder(false)}
              className="min-h-12 w-full rounded-xl bg-[#e7c27d] text-base font-bold text-neutral-900 disabled:opacity-40"
            >
              {pending ? "Sending…" : "Place order & send to kitchen"}
            </button>

            {canRecordAny ? (
              <>
                <button
                  type="button"
                  disabled={pending || session.cart.length === 0 || tableNumber === ""}
                  onClick={() => placeOrder(true)}
                  className="min-h-11 w-full rounded-xl border border-white/25 bg-white/10 text-sm font-semibold disabled:opacity-40"
                >
                  Place order &amp; pay ({payMethod})
                </button>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["CASH", "UPI", "CARD"] as PaymentMethod[]).map((method) => {
                    const allowed =
                      (method === "CASH" && permissions.recordCashPayment) ||
                      (method === "UPI" && permissions.recordUpiPayment) ||
                      (method === "CARD" && permissions.recordCardPayment);
                    return (
                      <button
                        key={method}
                        type="button"
                        disabled={!allowed}
                        onClick={() => setPayMethod(method)}
                        className={`min-h-10 rounded-lg text-xs font-semibold disabled:opacity-30 ${
                          payMethod === method ? "bg-[#e7c27d] text-neutral-900" : "bg-white/10"
                        }`}
                      >
                        {method}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={payAmount}
                    onChange={(event) =>
                      setPayAmount(event.target.value === "" ? "" : Number(event.target.value))
                    }
                    placeholder={String(roundMoney(totals.total))}
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/20 bg-transparent px-3 text-sm"
                  />
                  <button
                    type="button"
                    disabled={pending || !lastOrderId}
                    onClick={recordPay}
                    className="min-h-11 shrink-0 rounded-xl bg-white/15 px-4 text-sm disabled:opacity-40"
                  >
                    Record
                  </button>
                </div>
              </>
            ) : (
              <p className="rounded-lg bg-white/5 px-3 py-2 text-[11px] text-white/60">
                Payment recording is disabled for this captain — request bill / hand over to cashier.
              </p>
            )}
          </div>
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
