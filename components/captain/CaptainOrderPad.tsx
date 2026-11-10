"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, Search, ShoppingBag, Trash2, X } from "lucide-react";
import type { CaptainPermissions, Category, Dish, DynamicPaymentRequest, OrderSummary, PaymentMethod, RestaurantBillingSettings, RestaurantTable } from "@/types";
import { lineItemTotal, roundMoney } from "@/lib/order-pricing";
import { calculateRestaurantBill } from "@/lib/billing/calculate-bill";
import { resolveLineTaxRate } from "@/lib/billing/resolve-tax-rate";
import { resolveCaptainPermissions } from "@/lib/captain-permissions";
import { locationName } from "@/lib/service-location";
import { printQueuedKitchenOrderTicket } from "@/lib/kot-print";

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
  billing?: RestaurantBillingSettings;
  categories: Category[];
  dishes: Dish[];
  tables: RestaurantTable[];
  initialTableId?: string | null;
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
  billing,
  categories,
  dishes,
  tables,
  initialTableId = null,
  permissions: rawPermissions,
}: Props) {
  const permissions = resolveCaptainPermissions({ permissions: rawPermissions ?? undefined });
  const [tableId, setTableId] = useState<string>(
    initialTableId && tables.some((table) => table.id === initialTableId) ? initialTableId : "",
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
  const [lastOrderNumber, setLastOrderNumber] = useState<string | number | null>(null);
  const [lastSavedOrder, setLastSavedOrder] = useState<OrderSummary | null>(null);
  const [previousKotLineIds, setPreviousKotLineIds] = useState<string[]>([]);
  const [kotSent, setKotSent] = useState(false);
  const [kotPending, setKotPending] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethod>(permissions.recordCashPayment ? "CASH" : permissions.recordCardPayment ? "CARD" : "UPI");
  const [payAmount, setPayAmount] = useState<number | "">("");
  const [upiRequest, setUpiRequest] = useState<DynamicPaymentRequest | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const tableKey = tableId;
  const session = cartsByTable[tableKey] ?? emptyCartState();
  const selectedLocation = tables.find((item) => item.id === tableId) ?? null;
  const selectedLocationName = selectedLocation ? locationName(selectedLocation) : "location not selected";

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

  useEffect(() => {
    if (!tableId) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/captain/tables/${encodeURIComponent(tableId)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) return;
        const json = await response.json();
        if (controller.signal.aborted || !json.success || !json.data?.activeOrder) return;
        const order: OrderSummary = json.data.activeOrder;
        setLastOrderId(order.id);
        setLastOrderNumber(order.orderNumber);
        setLastSavedOrder(order);
        setPreviousKotLineIds(order.kotLineIds ?? []);
        setKotSent(false);
        const due = roundMoney(Math.max(0, order.total - (order.payment?.amountPaid ?? 0)));
        setPayAmount(due > 0 ? due : "");
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Unable to load the table order.");
      }
    })();
    return () => controller.abort();
  }, [tableId]);

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
    return calculateRestaurantBill({
      lines: session.cart.map((line, index) => {
        const dish = dishes.find((entry) => entry.id === line.dishId);
        const category = dish ? categories.find((entry) => entry.id === dish.categoryId) : undefined;
        return { lineTotal: lineTotals[index], quantity: line.quantity, gstRatePercent: resolveLineTaxRate({ dish, category, billing }).rate };
      }),
      billDiscountAmount: session.billDiscount,
      billing: billing ?? { taxRatePercent, gstEnabled: taxRatePercent > 0, gstRatePercent: taxRatePercent, taxLabel },
    });
  }, [billing, categories, dishes, session.cart, session.billDiscount, taxLabel, taxRatePercent]);
  const cartItemCount = session.cart.reduce((sum, line) => sum + line.quantity, 0);
  const savedUnsentCount = lastSavedOrder?.items.filter((item) => item.lineId && !(lastSavedOrder.kotLineIds ?? []).includes(item.lineId)).length ?? 0;
  const upiRequestNeedsReplacement = upiRequest ? ["CANCELLED", "EXPIRED", "FAILED", "WRONG_AMOUNT"].includes(upiRequest.status) : false;

  function dishNeedsCustomize(dish: Dish) {
    const variants = (dish.variants ?? []).filter((variant) => variant.isAvailable !== false);
    const groups = (dish.addonGroups ?? []).filter((group) => group.isActive !== false);
    return variants.length > 0 || groups.length > 0;
  }

  function beginCustomize(dish: Dish) {
    if (!tableKey) {
      setMessage("Select an assigned table or room first.");
      return;
    }
    if (!dishNeedsCustomize(dish)) {
      addSimple(dish);
      return;
    }
    const availableVariants = (dish.variants ?? []).filter((variant) => variant.isAvailable !== false);
    const activeGroups = (dish.addonGroups ?? []).filter((group) => group.isActive !== false);
    if (availableVariants.length === 1 && activeGroups.length === 0) {
      addSimple(dish, availableVariants[0]);
      return;
    }
    const firstVariant = (dish.variants ?? []).find((variant) => variant.isAvailable !== false);
    setSelectedVariantId(firstVariant?.id ?? "");
    setSelectedAddons({});
    setCustomizing(dish);
  }

  function addSimple(dish: Dish, variant?: NonNullable<Dish["variants"]>[number]) {
    if (!tableKey) return;
    const existing = session.cart.find((line) => line.dishId === dish.id && line.variantId === variant?.id && line.addons.length === 0 && !line.note && !line.itemDiscountAmount);
    if (existing) {
      if (existing.quantity >= 99) { setMessage("Maximum 99 of one item per line."); return; }
      patchSession({ cart: session.cart.map((line) => line.key === existing.key ? { ...line, quantity: line.quantity + 1 } : line) });
      setMessage(`${dish.name} ×${existing.quantity + 1} · ${selectedLocationName}`);
      return;
    }
    const next: CartLine = {
      key: crypto.randomUUID(),
      dishId: dish.id,
      name: dish.name,
      variantId: variant?.id,
      variantName: variant?.name,
      unitPrice: variant?.price ?? dish.price,
      quantity: 1,
      itemDiscountAmount: 0,
      note: "",
      addons: [],
    };
    patchSession({ cart: [...session.cart, next] });
    setMessage(`Added ${dish.name} · ${selectedLocationName}`);
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
    for (const group of customizing.addonGroups ?? []) {
      if (group.isActive === false) continue;
      const count = (selectedAddons[group.id] ?? []).length;
      const minimum = group.isRequired ? Math.max(1, group.minSelect) : group.minSelect;
      if (count < minimum || count > group.maxSelect) {
        setMessage(`Choose ${minimum}–${group.maxSelect} options for ${group.name}.`);
        return;
      }
    }
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
    setMessage(`Added ${customizing.name}${variant ? ` · ${variant.name}` : ""} · ${selectedLocationName}`);
    setCustomizing(null);
  }

  function placeOrder() {
    if (!selectedLocation) {
      setMessage("Select an assigned table or room first.");
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
            tableId: selectedLocation.id,
            tableNumber: selectedLocation.tableNumber,
            guestName: session.guestName.trim() || undefined,
            orderNote: session.orderNote.trim() || undefined,
            customerPhone: phone || undefined,
            billDiscountAmount: session.billDiscount || undefined,
            couponCode: session.couponCode.trim() || undefined,
            redeemLoyaltyPoints: session.redeemLoyaltyPoints || undefined,
            idempotencyKey: session.idempotencyKey,
            sendToKitchen: false,
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
        setLastOrderNumber(json.data?.orderNumber ?? null);
        setLastSavedOrder(json.data);
        setPreviousKotLineIds(json.data?.kotLineIds ?? []);
        setKotSent(false);
        setPayAmount(roundMoney(Math.max(0, (json.data?.total ?? totals.total) - (json.data?.payment?.amountPaid ?? 0))));
        setUpiRequest(null);
        setCartOpen(true);

        patchSession(emptyCartState());
        const warning = json.meta?.warning ? ` · ${json.meta.warning}` : "";
        setMessage(
          `Order #${json.data.orderNumber} ${json.meta?.appended ? "updated" : "placed"} for ${selectedLocationName}${
            json.meta?.sentToKitchen ? " · KOT sent to kitchen" : ""
          }${warning}`,
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
    if (payMethod === "UPI") {
      setMessage("Use Generate UPI QR and wait for verified payment confirmation.");
      return;
    }
    const canPay =
      (payMethod === "CASH" && permissions.recordCashPayment) ||
      (payMethod === "CARD" && permissions.recordCardPayment);
    if (!canPay) {
      setMessage(`You are not permitted to record ${payMethod} payments.`);
      return;
    }
    if (payAmount === "" || !Number.isFinite(payAmount) || payAmount <= 0) {
      setMessage("Enter a valid payment amount.");
      return;
    }
    startTransition(async () => {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(lastOrderId)}/payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: payMethod,
            amount: payAmount,
          }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Unable to record payment");
        const outstanding = roundMoney(Math.max(0, (json.data?.total ?? 0) - (json.data?.payment?.amountPaid ?? 0)));
        setMessage(`${payMethod} payment recorded.${outstanding > 0 ? ` ${money(outstanding, currency)} remains due.` : " Order paid."}`);
        if (json.data) setLastSavedOrder(json.data);
        setPayAmount(outstanding > 0 ? outstanding : "");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to record payment");
      }
    });
  }

  function sendKot() {
    if (!lastOrderId) return;
    setKotPending(true);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/captain/orders/${encodeURIComponent(lastOrderId)}/send-kot`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || "Unable to send KOT.");
        setLastSavedOrder(json.data);
        setKotSent(true);
        setMessage(`Order #${lastOrderNumber} · new items sent to kitchen.`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to send KOT.");
      } finally {
        setKotPending(false);
      }
    });
  }

  const refreshUpiStatus = useCallback(async (orderId: string) => {
    const response = await fetch(`/api/captain/orders/${encodeURIComponent(orderId)}/upi/status`, { cache: "no-store" });
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.error || "Unable to refresh UPI status.");
    setUpiRequest(json.data);
    if (json.data.status === "PAID") {
      setMessage(`Order #${lastOrderNumber} · UPI payment verified and recorded.`);
      const orderResponse = await fetch(`/api/captain/orders/${encodeURIComponent(orderId)}`, { cache: "no-store" });
      if (orderResponse.ok) {
        const orderJson = await orderResponse.json();
        if (orderJson.success) {
          setLastSavedOrder(orderJson.data);
          const due = roundMoney(Math.max(0, orderJson.data.total - (orderJson.data.payment?.amountPaid ?? 0)));
          setPayAmount(due > 0 ? due : "");
        }
      }
    }
  }, [lastOrderNumber]);

  useEffect(() => {
    if (!lastOrderId || !upiRequest || !["CREATING", "PENDING", "PROCESSING", "PARTIAL"].includes(upiRequest.status)) return;
    const timer = window.setInterval(() => {
      void refreshUpiStatus(lastOrderId).catch((error) => setMessage(error instanceof Error ? error.message : "Unable to refresh UPI status."));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [lastOrderId, refreshUpiStatus, upiRequest?.status]);

  function createUpiQr() {
    if (!lastOrderId) return;
    setPaymentPending(true);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/captain/orders/${encodeURIComponent(lastOrderId)}/upi`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || "Unable to create UPI QR.");
        setUpiRequest(json.data);
        setMessage(`Order #${lastOrderNumber} · waiting for UPI payment.`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to create UPI QR.");
      } finally {
        setPaymentPending(false);
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 pb-24 lg:h-[calc(100dvh-4rem)] lg:overflow-hidden lg:pb-2">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/captain/${slug}/tables`}
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" /> My Tables
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Captain POS</h1>
          <p className="hidden text-sm text-neutral-500 sm:block">
            Select a table, add menu items, then review and submit the order.
          </p>
        </div>
        <label className="text-sm font-medium text-neutral-700">
          Table
          <select
            value={tableId}
            onChange={(event) => {
              setTableId(event.target.value);
              setMessage(null);
              setLastOrderId(null);
              setLastOrderNumber(null);
              setLastSavedOrder(null);
              setKotSent(false);
              setUpiRequest(null);
            }}
            className={`mt-1 block min-h-12 w-full min-w-[11rem] rounded-xl border bg-white px-3 ${
              !selectedLocation ? "border-rose-400 ring-2 ring-rose-200" : "border-neutral-200"
            }`}
          >
            <option value="">Select table</option>
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.locationType === "ROOM" ? "Room" : "T"}{table.tableNumber}
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
            /unable|select|add at least|not assigned|failed|invalid|not permitted|exceeds|not configured|cannot|error/i.test(message)
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {message}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,26rem)]">
        <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4 lg:min-h-0 lg:overflow-hidden">
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-50 p-1">
              <span className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white">Dine-in</span>
              {selectedLocation ? (
                <span className="px-3 py-2 text-xs font-semibold text-neutral-700">{locationName(selectedLocation)}</span>
              ) : (
                <span className="px-3 py-2 text-xs font-semibold text-rose-600">Pick a table</span>
              )}
            </div>
            <div className="relative min-w-0 flex-1 basis-[12rem]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search menu"
                className="min-h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm"
              />
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[7.5rem_minmax(0,1fr)]">
            <nav
              aria-label="Menu categories"
              className="scrollbar-none flex shrink-0 gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0"
            >
              <button
                type="button"
                onClick={() => setCategoryId("ALL")}
                className={`min-h-10 shrink-0 rounded-xl px-3 text-left text-xs font-semibold lg:w-full ${
                  categoryId === "ALL" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
                }`}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryId(category.id)}
                  className={`min-h-10 shrink-0 rounded-xl px-3 text-left text-xs font-semibold lg:w-full ${
                    categoryId === category.id
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-700"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </nav>

            <div className="grid min-h-0 flex-1 auto-rows-min content-start grid-cols-2 gap-2 sm:grid-cols-3 lg:overflow-y-auto lg:overscroll-contain xl:grid-cols-4">
              {availableDishes.map((dish) => (
                <button
                  key={dish.id}
                  type="button"
                  onClick={() => beginCustomize(dish)}
                  className="relative min-h-[7rem] rounded-2xl border border-neutral-200 bg-[#fafafa] p-3 text-left transition active:scale-[0.98] hover:border-neutral-900 hover:shadow-sm"
                >
                  <span
                    className={`mb-2 inline-block h-2.5 w-2.5 rounded-full ${
                      dish.isVeg ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                    aria-hidden
                  />
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-neutral-900">
                    {dish.name}
                  </p>
                  <p className="mt-1 text-xs font-medium text-neutral-500">
                    {money((dish.variants?.[0]?.price ?? dish.price) as number, currency)}
                  </p>
                  <span className="absolute bottom-2.5 right-2.5 grid h-7 w-7 place-items-center rounded-full bg-neutral-900 text-white">
                    <Plus className="h-4 w-4" />
                  </span>
                </button>
              ))}
              {availableDishes.length === 0 ? (
                <p className="col-span-full py-10 text-center text-sm text-neutral-400">No dishes in this filter.</p>
              ) : null}
            </div>
          </div>
        </section>

        {cartOpen ? (
          <button
            type="button"
            aria-label="Close cart"
            onClick={() => setCartOpen(false)}
            className="fixed inset-0 z-40 bg-black/45 lg:hidden"
          />
        ) : null}
        <aside className={`${cartOpen ? "translate-y-0" : "translate-y-full"} safe-bottom fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] min-w-0 flex-col overflow-hidden rounded-t-3xl border border-neutral-900 bg-neutral-900 text-white shadow-2xl transition-transform duration-200 lg:static lg:max-h-none lg:min-h-0 lg:translate-y-0 lg:rounded-2xl lg:shadow-none`}>
          <div className="shrink-0 border-b border-white/10 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              Current bill
              {selectedLocation ? (
                <span className="ml-2 text-sm font-normal text-white/60">· {selectedLocationName}</span>
              ) : null}
              <span className="ml-2 text-sm font-normal text-white/60">({cartItemCount} new{lastSavedOrder ? ` · ${lastSavedOrder.items.length} saved` : ""})</span>
            </h2>
            <button type="button" onClick={() => setCartOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 lg:hidden" aria-label="Close cart">
              <X className="h-5 w-5" />
            </button>
            </div>
          </div>

          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3">
            {lastSavedOrder ? lastSavedOrder.items.map((item) => (
              <li key={item.lineId ?? `${item.dishId}-${item.dishNameSnapshot}`} className="rounded-xl border border-white/15 bg-white/5 p-3">
                <div className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0 font-semibold">{item.quantity}× {item.dishNameSnapshot}{item.variantNameSnapshot ? ` · ${item.variantNameSnapshot}` : ""}</span><span className="shrink-0 font-semibold">{money(item.itemTotal, currency)}</span></div>
                <p className="mt-1 text-[11px] text-white/60">{item.lineId && (lastSavedOrder.kotLineIds ?? []).includes(item.lineId) ? "Sent to kitchen" : "Waiting for KOT"}{item.note ? ` · ${item.note}` : ""}</p>
              </li>
            )) : null}
            {session.cart.length === 0 && !lastSavedOrder ? (
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
                              entry.key === line.key ? { ...entry, quantity: Math.min(99, entry.quantity + 1) } : entry,
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
                    placeholder="Notes"
                    className="mt-2 min-h-8 w-full rounded-lg border border-white/15 bg-transparent px-2 text-xs text-white placeholder:text-white/40"
                  />
                </li>
              ))
            )}
          </ul>

          {/* Compact dock — ordered items stay the main view */}
          <div className="max-h-[58dvh] shrink-0 overflow-y-auto border-t border-white/10 bg-neutral-950 px-3 py-2.5 sm:px-4 lg:max-h-[65dvh]">
            <div className="flex items-center gap-2">
              <span className="shrink-0 rounded-lg border border-white/15 px-2 py-1.5 text-[11px] font-semibold text-white/70">
                ₹ off
              </span>
              <input
                type="number"
                min={0}
                value={session.billDiscount || ""}
                onChange={(event) =>
                  patchSession({ billDiscount: Number(event.target.value) || 0 })
                }
                disabled={!tableKey || !permissions.applyDiscount}
                placeholder="0"
                className="min-h-9 min-w-0 flex-1 rounded-lg border border-white/20 bg-transparent px-2 text-sm disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => setExtrasOpen((open) => !open)}
                className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-white/80"
              >
                {extrasOpen ? "Hide" : "Coupon · note · phone"}
              </button>
            </div>

            {extrasOpen ? (
              <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                <input
                  value={session.couponCode}
                  onChange={(event) => patchSession({ couponCode: event.target.value })}
                  disabled={!tableKey || !permissions.applyCoupon}
                  placeholder="Coupon"
                  className="min-h-9 rounded-lg border border-white/20 bg-transparent px-2 text-xs disabled:opacity-40"
                />
                <input
                  value={session.orderNote}
                  onChange={(event) => patchSession({ orderNote: event.target.value })}
                  disabled={!tableKey}
                  placeholder="Order note"
                  className="min-h-9 rounded-lg border border-white/20 bg-transparent px-2 text-xs disabled:opacity-40"
                />
                <input
                  value={session.customerPhone}
                  onChange={(event) => patchSession({ customerPhone: event.target.value })}
                  disabled={!tableKey}
                  placeholder="Phone (optional)"
                  className="min-h-9 rounded-lg border border-white/20 bg-transparent px-2 text-xs disabled:opacity-40"
                />
              </div>
            ) : null}

            <div className="mt-2 space-y-0.5 text-sm">
              {lastSavedOrder ? <div className="space-y-0.5 border-b border-white/15 pb-1.5">
                <div className="flex justify-between font-semibold"><span>Saved order #{lastOrderNumber}</span><span>{money(lastSavedOrder.total, currency)}</span></div>
                <div className="flex justify-between text-xs text-white/55"><span>Items subtotal</span><span>{money(lastSavedOrder.subtotal, currency)}</span></div>
                {(lastSavedOrder.serviceCharge ?? 0) > 0 ? <div className="flex justify-between text-xs text-white/55"><span>Service charge</span><span>{money(lastSavedOrder.serviceCharge ?? 0, currency)}</span></div> : null}
                {(lastSavedOrder.taxAmount ?? 0) > 0 ? <div className="flex justify-between text-xs text-white/55"><span>{taxLabel} included in total</span><span>{money(lastSavedOrder.taxAmount ?? 0, currency)}</span></div> : null}
                {(lastSavedOrder.cgstAmount ?? 0) > 0 ? <div className="flex justify-between pl-3 text-[11px] text-white/45"><span>Includes CGST</span><span>{money(lastSavedOrder.cgstAmount ?? 0, currency)}</span></div> : null}
                {(lastSavedOrder.sgstAmount ?? 0) > 0 ? <div className="flex justify-between pl-3 text-[11px] text-white/45"><span>Includes SGST</span><span>{money(lastSavedOrder.sgstAmount ?? 0, currency)}</span></div> : null}
                {(lastSavedOrder.payment.amountPaid ?? 0) > 0 ? <div className="flex justify-between text-xs text-emerald-200"><span>Paid</span><span>{money(lastSavedOrder.payment.amountPaid ?? 0, currency)}</span></div> : null}
              </div> : null}
              <div className="flex justify-between text-white/65">
                <span>{lastSavedOrder ? "New items subtotal" : "Subtotal"}</span>
                <span>{money(totals.itemsSubtotal, currency)}</span>
              </div>
              {totals.billDiscount > 0 ? (
                <div className="flex justify-between text-emerald-200">
                  <span>Discount</span>
                  <span>−{money(totals.billDiscount, currency)}</span>
                </div>
              ) : null}
              {totals.packagingCharge > 0 ? <div className="flex justify-between text-white/65"><span>Packaging</span><span>{money(totals.packagingCharge, currency)}</span></div> : null}
              {totals.serviceCharge > 0 ? <div className="flex justify-between text-white/65"><span>Service charge</span><span>{money(totals.serviceCharge, currency)}</span></div> : null}
              {totals.taxAmount > 0 ? <div className="flex justify-between text-white/65">
                <span>
                  {totals.taxLabel} ({totals.gstRatePercent}%)
                </span>
                <span>{money(totals.taxAmount, currency)}</span>
              </div> : null}
              {totals.cgstAmount > 0 ? <div className="flex justify-between pl-3 text-xs text-white/50"><span>Includes CGST</span><span>{money(totals.cgstAmount, currency)}</span></div> : null}
              {totals.sgstAmount > 0 ? <div className="flex justify-between pl-3 text-xs text-white/50"><span>Includes SGST</span><span>{money(totals.sgstAmount, currency)}</span></div> : null}
              <div className="flex justify-between text-lg font-bold">
                <span>{lastSavedOrder ? cartItemCount > 0 ? "Estimated with new items" : "Running total" : "Total"}</span>
                <span>{money((lastSavedOrder?.total ?? 0) + totals.total, currency)}</span>
              </div>
            </div>

            <div className="mt-2 space-y-1.5">
              <button
                type="button"
                disabled={pending || session.cart.length === 0 || !selectedLocation}
                onClick={placeOrder}
                className="min-h-11 w-full rounded-xl bg-[#f59e0b] text-sm font-bold text-neutral-950 disabled:opacity-40"
              >
                {pending ? "Saving…" : "Save order"}
              </button>
              {lastOrderId ? (
                <section className="space-y-2 rounded-xl border border-white/15 bg-white/5 p-3" aria-label="Saved order actions">
                  <div className="flex items-center justify-between gap-2 text-xs"><strong>Saved order #{lastOrderNumber}</strong><span className="text-white/70">{selectedLocationName}</span></div>
                  <div className="flex gap-2"><button type="button" disabled={kotPending || savedUnsentCount === 0} onClick={sendKot} className="min-h-10 flex-1 rounded-lg bg-amber-500 px-3 text-xs font-bold text-neutral-950 disabled:opacity-50">{kotPending ? "Sending KOT…" : savedUnsentCount > 0 ? `Send ${savedUnsentCount} new item${savedUnsentCount === 1 ? "" : "s"} to kitchen` : "All items sent"}</button>{kotSent && lastSavedOrder ? <button type="button" onClick={() => printQueuedKitchenOrderTicket(lastSavedOrder, undefined, previousKotLineIds)} className="min-h-10 rounded-lg border border-white/30 px-3 text-xs font-bold">Print KOT copy</button> : null}</div>
                  {canRecordAny ? <>
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
                          onClick={() => { setPayMethod(method); if (method === "UPI" && !upiRequest && !paymentPending) createUpiQr(); }}
                          className={`min-h-10 rounded-lg text-xs font-semibold disabled:opacity-30 ${
                            payMethod === method ? "bg-[#f59e0b] text-neutral-950" : "bg-white/10"
                          }`}
                        >
                          {method}
                        </button>
                      );
                    })}
                  </div>
                  {payMethod === "UPI" ? upiRequest ? (
                    <div className="space-y-2 rounded-xl bg-white p-3 text-center text-neutral-900">
                      <p className="text-xs font-bold">{upiRequest.status === "PAID" ? "Verified UPI payment" : "Scan exact-amount UPI QR"}</p>
                      {upiRequest.qrImageUrl && !upiRequestNeedsReplacement ? <img src={upiRequest.qrImageUrl} alt={`UPI QR for order ${lastOrderNumber}`} className="mx-auto h-56 w-56 max-w-full object-contain" /> : null}
                      <p className="text-xl font-black">{money(upiRequest.amount, currency)}</p>
                      <p className="break-all text-[11px] text-neutral-600">Ref {upiRequest.paymentReferenceId}</p>
                      <p className="text-xs font-semibold">{upiRequest.status === "PAID" ? "Provider confirmed · payment recorded" : upiRequestNeedsReplacement ? `Request ${upiRequest.status.toLowerCase()} · do not scan this QR` : `Status: ${upiRequest.status} · waiting for provider confirmation`}</p>
                      {upiRequestNeedsReplacement ? <button type="button" onClick={createUpiQr} className="min-h-9 rounded-lg border px-3 text-xs">Create new request</button> : upiRequest.status !== "PAID" ? <div className="flex justify-center gap-2"><button type="button" onClick={() => void refreshUpiStatus(lastOrderId).catch((error) => setMessage(error instanceof Error ? error.message : "Refresh failed"))} className="min-h-9 rounded-lg border px-3 text-xs">Refresh status</button><button type="button" onClick={() => void fetch(`/api/captain/orders/${encodeURIComponent(lastOrderId)}/upi/cancel`, { method: "POST", body: "{}" }).then(async (response) => { const json = await response.json(); if (!response.ok || !json.success) throw new Error(json.error || "Cancel failed"); setUpiRequest(json.data); }).catch((error) => setMessage(error instanceof Error ? error.message : "Cancel failed"))} className="min-h-9 rounded-lg border px-3 text-xs">Cancel request</button></div> : null}
                    </div>
                  ) : <button type="button" disabled={paymentPending || pending} onClick={createUpiQr} className="min-h-10 w-full rounded-lg bg-white text-sm font-bold text-neutral-900 disabled:opacity-50">{paymentPending ? "Creating QR…" : "Generate UPI QR"}</button> : (
                    <div className="flex gap-2"><label className="min-w-0 flex-1 text-xs text-white/70">{payMethod} received<input type="number" min="0.01" step="0.01" value={payAmount} onChange={(event) => setPayAmount(event.target.value === "" ? "" : Number(event.target.value))} className="mt-1 min-h-10 w-full rounded-lg border border-white/20 bg-transparent px-2 text-sm text-white" /></label><button type="button" disabled={pending || payAmount === ""} onClick={recordPay} className="self-end min-h-10 rounded-lg bg-white px-3 text-xs font-bold text-neutral-900 disabled:opacity-40">Confirm {payMethod}</button></div>
                  )}
                  </> : <p className="text-xs text-white/60">Payment is handled by an authorized cashier.</p>}
                </section>
              ) : (
                <p className="text-[11px] text-white/55">
                  Save the order first. Send KOT and payment stay in this panel.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>

      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className="safe-bottom fixed inset-x-3 bottom-[4.55rem] z-30 flex min-h-16 items-center justify-between rounded-2xl bg-neutral-900 px-4 pt-3 text-left text-white shadow-[0_14px_35px_rgba(0,0,0,0.28)] lg:hidden"
      >
        <span className="flex items-center gap-3">
          <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-white/10">
            <ShoppingBag className="h-5 w-5" />
            {cartItemCount > 0 ? <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-neutral-950">{cartItemCount}</span> : null}
          </span>
          <span><span className="block text-sm font-bold">{cartItemCount ? "Review new items" : lastSavedOrder ? `Order #${lastOrderNumber} · ${savedUnsentCount} unsent` : "Cart is empty"}</span><span className="block text-xs text-white/60">{selectedLocationName}</span></span>
        </span>
        <span className="text-base font-bold">{money((lastSavedOrder?.total ?? 0) + totals.total, currency)}</span>
      </button>

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
