"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import type {
  Category,
  Dish,
  KitchenStation,
  OrderChannel,
  PaymentMethod,
  PosShift,
  RestaurantTable,
} from "@/types";
import { computeBillTotals, lineItemTotal, roundMoney } from "@/lib/order-pricing";
import { useBarcodeWedge } from "@/components/admin/useBarcodeWedge";
import { MonitorSmartphone, Search, Trash2 } from "lucide-react";

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
  kitchenStation?: KitchenStation;
};

type PosTerminalProps = {
  restaurantName: string;
  currency: string;
  taxRatePercent: number;
  taxLabel: string;
  categories: Category[];
  dishes: Dish[];
  tables: RestaurantTable[];
  initialShift: PosShift | null;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function PosTerminal({
  restaurantName,
  currency,
  taxRatePercent,
  taxLabel,
  categories,
  dishes,
  tables,
  initialShift,
}: PosTerminalProps) {
  const [channel, setChannel] = useState<OrderChannel>("POS_DINE_IN");
  const [tableNumber, setTableNumber] = useState<number | "">("");
  const [categoryId, setCategoryId] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [billDiscount, setBillDiscount] = useState(0);
  const [orderNote, setOrderNote] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [redeemLoyaltyPoints, setRedeemLoyaltyPoints] = useState(0);
  const [shift, setShift] = useState(initialShift);
  const [openingFloat, setOpeningFloat] = useState(0);
  const [closingCash, setClosingCash] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("CASH");
  const [payAmount, setPayAmount] = useState<number | "">("");
  const [pending, startTransition] = useTransition();
  const [customizing, setCustomizing] = useState<Dish | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [selectedAddons, setSelectedAddons] = useState<
    Record<string, string[]>
  >({});

  const availableDishes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dishes.filter((dish) => {
      if (!dish.isAvailable) return false;
      if (categoryId !== "ALL" && dish.categoryId !== categoryId) return false;
      if (!q) return true;
      return (
        dish.name.toLowerCase().includes(q) ||
        (dish.sku ?? "").toLowerCase().includes(q)
      );
    });
  }, [dishes, categoryId, query]);

  const onBarcodeScan = useCallback(
    (code: string) => {
      const match = dishes.find(
        (dish) => dish.isAvailable && (dish.sku ?? "").toLowerCase() === code.toLowerCase(),
      );
      if (!match) {
        setMessage(`Unknown barcode: ${code} (inventory not changed)`);
        return;
      }
      if (dishNeedsCustomize(match)) {
        beginCustomize(match);
        setMessage(`Scanned ${match.name?.trim() || "item"} — complete options`);
        return;
      }
      addSimpleDish(match);
      setMessage(`Added ${match.name?.trim() || "item"} from barcode (stock unchanged)`);
    },
    [dishes],
  );
  useBarcodeWedge(onBarcodeScan, Boolean(shift));

  const lineTotals = cart.map((line) =>
    lineItemTotal({
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      addonTotals: line.addons.map((addon) => addon.price),
      itemDiscountAmount: line.itemDiscountAmount,
    }),
  );
  const totals = computeBillTotals({
    lineTotals,
    billDiscountAmount: billDiscount,
    taxRatePercent,
  });

  function dishNeedsCustomize(dish: Dish) {
    const hasVariants = (dish.variants ?? []).some((variant) => variant.isAvailable !== false);
    const hasAddons = (dish.addonGroups ?? []).some(
      (group) =>
        group.isActive !== false &&
        (group.addons ?? []).some((addon) => addon.isActive !== false && addon.isAvailable !== false),
    );
    return hasVariants || hasAddons;
  }

  function beginCustomize(dish: Dish) {
    if (!dishNeedsCustomize(dish)) {
      addSimpleDish(dish);
      return;
    }
    const variants = (dish.variants ?? []).filter((variant) => variant.isAvailable !== false);
    setCustomizing(dish);
    setSelectedVariantId(variants[0]?.id ?? "");
    const initial: Record<string, string[]> = {};
    for (const group of dish.addonGroups ?? []) {
      initial[group.id] = [];
    }
    setSelectedAddons(initial);
  }

  function addSimpleDish(dish: Dish) {
    const label = dish.name?.trim() || "Unnamed dish";
    setCart((prev) => [
      ...prev,
      {
        key: `${dish.id}-simple-${Date.now()}`,
        dishId: dish.id,
        name: label,
        unitPrice: dish.price,
        quantity: 1,
        itemDiscountAmount: 0,
        note: "",
        addons: [],
        kitchenStation: dish.kitchenStation,
      },
    ]);
    setMessage(`Added ${label}`);
  }

  function addCustomizedToCart() {
    if (!customizing) return;
    const variants = (customizing.variants ?? []).filter((entry) => entry.isAvailable !== false);
    if (variants.length > 0 && !selectedVariantId) {
      setMessage("Select a variant.");
      return;
    }
    const variant = variants.find((entry) => entry.id === selectedVariantId);
    const unitPrice = variant?.price ?? customizing.price;
    const addons: CartLine["addons"] = [];
    for (const group of customizing.addonGroups ?? []) {
      if (group.isActive === false) continue;
      const ids = selectedAddons[group.id] ?? [];
      const min = group.isRequired ? Math.max(1, group.minSelect) : group.minSelect;
      if (ids.length < min || ids.length > group.maxSelect) {
        setMessage(`Select options for ${group.name}.`);
        return;
      }
      for (const id of ids) {
        const addon = group.addons.find((entry) => entry.id === id);
        if (!addon) continue;
        addons.push({
          addonId: addon.id,
          name: addon.name,
          price: addon.price,
          groupId: group.id,
        });
      }
    }

    const label = customizing.name?.trim() || "Unnamed dish";
    setCart((prev) => [
      ...prev,
      {
        key: `${customizing.id}-${selectedVariantId}-${Date.now()}`,
        dishId: customizing.id,
        name: label,
        variantId: variant?.id,
        variantName: variant?.name,
        unitPrice,
        quantity: 1,
        itemDiscountAmount: 0,
        note: "",
        addons,
        kitchenStation: customizing.kitchenStation,
      },
    ]);
    setCustomizing(null);
    setMessage(`Added ${label}`);
  }

  function updateQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((line) =>
          line.key === key
            ? { ...line, quantity: Math.max(0, line.quantity + delta) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((line) => line.key !== key));
    setMessage("Item removed from bill");
  }

  function clearBill() {
    setCart([]);
    setBillDiscount(0);
    setOrderNote("");
    setCouponCode("");
    setRedeemLoyaltyPoints(0);
    setMessage("Bill cleared");
  }

  function canPlaceOrder() {
    if (!shift) return "Open a POS shift before taking orders.";
    if (cart.length === 0) return "Add at least one item.";
    if (channel === "POS_DINE_IN" && (tableNumber === "" || Number(tableNumber) < 1)) {
      return "Select a table for dine-in orders.";
    }
    if (tables.length === 0 && channel === "POS_DINE_IN") {
      return "No tables configured. Switch to Takeaway or add tables first.";
    }
    return null;
  }

  async function submitPosOrder(): Promise<{ id: string; orderNumber: number | string; total: number }> {
    if (!shift) throw new Error("Open a POS shift before taking orders.");
    const idempotencyKey = crypto.randomUUID();
    const payload: Record<string, unknown> = {
      channel,
      orderNote: orderNote.trim() || undefined,
      billDiscountAmount: billDiscount || undefined,
      customerPhone: customerPhone.trim() || undefined,
      couponCode: couponCode.trim() || undefined,
      redeemLoyaltyPoints: redeemLoyaltyPoints || undefined,
      idempotencyKey,
      shiftId: shift.id,
      items: cart.map((line) => ({
        dishId: line.dishId,
        variantId: line.variantId,
        quantity: line.quantity,
        itemDiscountAmount: line.itemDiscountAmount || undefined,
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
    };
    if (channel === "POS_DINE_IN") {
      payload.tableNumber = Number(tableNumber);
    }

    const response = await fetch("/api/pos/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    if (!json.success) {
      const detail =
        Array.isArray(json.details) && json.details[0]?.message
          ? String(json.details[0].message)
          : null;
      throw new Error(detail || json.error || "Checkout failed");
    }
    return json.data;
  }

  function placeOrder() {
    const block = canPlaceOrder();
    if (block) {
      setMessage(block);
      return;
    }
    startTransition(async () => {
      try {
        const order = await submitPosOrder();
        setLastOrderId(order.id);
        setCart([]);
        setBillDiscount(0);
        setOrderNote("");
        setCouponCode("");
        setRedeemLoyaltyPoints(0);
        setPayAmount(order.total);
        setMessage(
          `Order #${order.orderNumber} placed · ${money(order.total, currency)}. Now tap Record to take payment.`,
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Checkout failed");
      }
    });
  }

  function placeAndPay() {
    const block = canPlaceOrder();
    if (block) {
      setMessage(block);
      return;
    }
    startTransition(async () => {
      try {
        const order = await submitPosOrder();
        setLastOrderId(order.id);
        setCart([]);
        setBillDiscount(0);
        setOrderNote("");
        setCouponCode("");
        setRedeemLoyaltyPoints(0);
        setPayAmount(order.total);

        const response = await fetch(`/api/orders/${order.id}/payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method: payMethod, amount: order.total }),
        });
        const json = await response.json();
        if (!json.success) {
          setMessage(
            `Order #${order.orderNumber} placed, but payment failed: ${json.error || "try Record"}.`,
          );
          return;
        }
        setPayAmount("");
        setMessage(
          `Order #${order.orderNumber} placed & ${json.data.payment.status} via ${payMethod} · ${money(order.total, currency)}`,
        );
        if (json.data.payment.status === "PAID") setLastOrderId(null);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Checkout failed");
      }
    });
  }

  function recordPay() {
    if (!lastOrderId) {
      setMessage("Place an order first, then Record payment.");
      return;
    }
    startTransition(async () => {
      try {
        const body: { method: PaymentMethod; amount?: number } = { method: payMethod };
        if (payAmount !== "" && Number(payAmount) > 0) body.amount = Number(payAmount);
        const response = await fetch(`/api/orders/${lastOrderId}/payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Payment failed");
        setMessage(`Payment ${json.data.payment.status} for order #${json.data.orderNumber}`);
        if (json.data.payment.status === "PAID") {
          setPayAmount("");
          setLastOrderId(null);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Payment failed");
      }
    });
  }

  function openShift() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/pos/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ openingFloat }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Could not open shift");
        setShift(json.data);
        setMessage("Shift opened");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not open shift");
      }
    });
  }

  function closeShift() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/pos/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "CLOSE", closingCashCounted: closingCash }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Could not close shift");
        setShift(null);
        setMessage(
          `Shift closed · expected ${money(json.data.expectedCash ?? 0, currency)} · counted ${money(json.data.closingCashCounted ?? 0, currency)}`,
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not close shift");
      }
    });
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full min-w-0 max-w-full flex-col gap-3 overflow-x-hidden bg-[linear-gradient(160deg,#f7f4ef_0%,#ebe4d8_45%,#f3eee6_100%)] p-2 sm:gap-4 sm:p-3 md:p-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d9cfc0] bg-[#fffaf3]/90 px-3 py-3 sm:px-4">
        <div className="flex items-center gap-3">
          <MonitorSmartphone className="h-6 w-6 text-[#5c4634]" />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#8a7460]">POS</p>
            <h1 className="font-serif text-2xl text-[#2f241c]">{restaurantName}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["POS_DINE_IN", "POS_TAKEAWAY", "POS_DELIVERY"] as OrderChannel[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setChannel(value)}
              className={`min-h-11 rounded-xl px-4 text-sm font-medium ${
                channel === value
                  ? "bg-[#2f241c] text-[#f7f1e8]"
                  : "bg-[#efe6d8] text-[#2f241c]"
              }`}
            >
              {value === "POS_DINE_IN" ? "Dine-in" : value === "POS_TAKEAWAY" ? "Takeaway" : "Delivery"}
            </button>
          ))}
        </div>
      </header>

      {!shift ? (
        <section className="rounded-2xl border border-[#d9cfc0] bg-white/80 p-4">
          <h2 className="mb-2 text-lg font-semibold text-[#2f241c]">Open shift</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-[#5c4634]">
              Opening float
              <input
                type="number"
                min={0}
                value={openingFloat}
                onChange={(event) => setOpeningFloat(Number(event.target.value) || 0)}
                className="mt-1 block min-h-11 w-40 rounded-xl border border-[#d9cfc0] px-3"
              />
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={openShift}
              className="min-h-11 rounded-xl bg-[#2f241c] px-5 text-[#f7f1e8]"
            >
              Open shift
            </button>
          </div>
        </section>
      ) : (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d9cfc0] bg-white/80 px-4 py-3 text-sm text-[#5c4634]">
          <p>
            Shift open since {new Date(shift.openedAt).toLocaleTimeString()} · float{" "}
            {money(shift.openingFloat, currency)}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label>
              Closing cash
              <input
                type="number"
                min={0}
                value={closingCash}
                onChange={(event) => setClosingCash(Number(event.target.value) || 0)}
                className="ml-2 min-h-10 w-28 rounded-lg border border-[#d9cfc0] px-2"
              />
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={closeShift}
              className="min-h-10 rounded-lg bg-[#8b3a2b] px-4 text-white"
            >
              Close shift
            </button>
          </div>
        </section>
      )}

      <div className="grid min-w-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(17.5rem,22rem)] lg:gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <section className="flex min-h-[22rem] min-w-0 flex-col gap-3 rounded-2xl border border-[#d9cfc0] bg-white/85 p-3 lg:min-h-[28rem]">
          <div className="flex min-w-0 flex-wrap gap-2">
            {channel === "POS_DINE_IN" ? (
              <select
                value={tableNumber}
                onChange={(event) =>
                  setTableNumber(event.target.value ? Number(event.target.value) : "")
                }
                aria-invalid={tableNumber === ""}
                className={`min-h-11 max-w-full rounded-xl border bg-[#fffaf3] px-3 ${
                  tableNumber === ""
                    ? "border-rose-400 ring-2 ring-rose-200"
                    : "border-[#d9cfc0]"
                }`}
              >
                <option value="">Select table (required)</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.tableNumber}>
                    Table {table.tableNumber}
                    {table.label ? ` · ${table.label}` : ""}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="relative min-w-0 flex-1 basis-[12rem]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a7460]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search dishes or SKU"
                className="min-h-11 w-full rounded-xl border border-[#d9cfc0] bg-[#fffaf3] pl-9 pr-3"
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoryId("ALL")}
              className={`min-h-10 shrink-0 rounded-xl px-3 text-sm ${
                categoryId === "ALL" ? "bg-[#2f241c] text-white" : "bg-[#efe6d8]"
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
                  categoryId === category.id ? "bg-[#2f241c] text-white" : "bg-[#efe6d8]"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
          <div className="grid max-h-[min(55vh,36rem)] auto-rows-min content-start grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:max-h-none lg:flex-1 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {availableDishes.map((dish) => (
              <button
                key={dish.id}
                type="button"
                onClick={() => beginCustomize(dish)}
                className="min-h-[5.5rem] min-w-0 self-start rounded-2xl border border-[#e4dacb] bg-[#fffaf3] p-3 text-left transition hover:border-[#2f241c]"
              >
                <p className="line-clamp-2 font-medium leading-snug text-[#2f241c]">
                  {dish.name?.trim() || "Unnamed dish"}
                </p>
                <p className="mt-1 text-sm text-[#8a7460]">
                  {money(
                    (dish.variants?.[0]?.price ?? dish.price) as number,
                    currency,
                  )}
                </p>
              </button>
            ))}
          </div>
        </section>

        <aside className="grid min-h-[22rem] min-w-0 grid-rows-[auto_minmax(14rem,1fr)_auto] rounded-2xl border border-[#d9cfc0] bg-[#2f241c] text-[#f7f1e8] lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]">
          <div className="shrink-0 space-y-2 border-b border-white/10 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">
                Current bill
                {cart.length > 0 ? (
                  <span className="ml-2 text-sm font-normal text-[#d9cfc0]">
                    ({cart.reduce((sum, line) => sum + line.quantity, 0)} items)
                  </span>
                ) : null}
              </h2>
              {cart.length > 0 ? (
                <button
                  type="button"
                  onClick={clearBill}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-rose-500/20 px-2.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear bill
                </button>
              ) : null}
            </div>
            {message ? (
              <p
                role="status"
                className={`rounded-xl px-3 py-2 text-xs font-medium ${
                  /failed|select|open a pos|add at least|unavailable|invalid/i.test(message)
                    ? "bg-rose-500/20 text-rose-100"
                    : "bg-emerald-500/15 text-emerald-100"
                }`}
              >
                {message}
              </p>
            ) : null}
          </div>

          <ul className="min-h-[14rem] space-y-2 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
            {cart.length === 0 ? (
              <li className="flex min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-white/20 px-4 text-center text-sm text-[#d9cfc0]">
                Tap a dish to add it. Each line will show − / + and Remove here.
              </li>
            ) : (
              cart.map((line) => (
                <li key={line.key} className="rounded-xl bg-white/10 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">
                        {line.name?.trim() || "Item"}
                        {line.variantName ? ` · ${line.variantName}` : ""}
                      </p>
                      {line.addons.length > 0 ? (
                        <p className="mt-0.5 text-xs text-[#d9cfc0]">
                          {line.addons.map((addon) => addon.name).join(", ")}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-[#d9cfc0]">
                        {money(line.unitPrice, currency)} each
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-rose-500/25 px-2 py-1.5 text-xs font-semibold text-rose-50 hover:bg-rose-500/40"
                      aria-label={`Remove ${line.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="min-h-9 min-w-9 rounded-lg bg-white/15 text-lg font-semibold"
                        onClick={() => updateQty(line.key, -1)}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center font-semibold">{line.quantity}</span>
                      <button
                        type="button"
                        className="min-h-9 min-w-9 rounded-lg bg-white/15 text-lg font-semibold"
                        onClick={() => updateQty(line.key, 1)}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <input
                      type="number"
                      min={0}
                      placeholder="Item disc."
                      aria-label="Item discount"
                      value={line.itemDiscountAmount || ""}
                      onChange={(event) => {
                        const value = Number(event.target.value) || 0;
                        setCart((prev) =>
                          prev.map((entry) =>
                            entry.key === line.key
                              ? { ...entry, itemDiscountAmount: value }
                              : entry,
                          ),
                        );
                      }}
                      className="w-24 rounded-lg border border-white/20 bg-transparent px-2 py-1 text-sm"
                    />
                    <span className="font-semibold">
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
                </li>
              ))
            )}
          </ul>

          <div className="shrink-0 space-y-2 border-t border-white/10 p-3 sm:max-h-[48%] sm:overflow-y-auto sm:p-4">
          <label className="block text-sm text-[#d9cfc0]">
            Order note
            <textarea
              value={orderNote}
              onChange={(event) => setOrderNote(event.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border border-white/20 bg-transparent px-3 py-2 text-[#f7f1e8]"
            />
          </label>
          <label className="block text-sm text-[#d9cfc0]">
            Customer phone
            <input
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              className="mt-1 min-h-10 w-full rounded-xl border border-white/20 bg-transparent px-3"
              placeholder="Loyalty lookup"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm text-[#d9cfc0]">
              Coupon
              <input
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value)}
                className="mt-1 min-h-10 w-full rounded-xl border border-white/20 bg-transparent px-3"
              />
            </label>
            <label className="block text-sm text-[#d9cfc0]">
              Redeem points
              <input
                type="number"
                min={0}
                value={redeemLoyaltyPoints || ""}
                onChange={(event) => setRedeemLoyaltyPoints(Number(event.target.value) || 0)}
                className="mt-1 min-h-10 w-full rounded-xl border border-white/20 bg-transparent px-3"
              />
            </label>
          </div>
          <label className="block text-sm text-[#d9cfc0]">
            Bill discount
            <input
              type="number"
              min={0}
              value={billDiscount || ""}
              onChange={(event) => setBillDiscount(Number(event.target.value) || 0)}
              className="mt-1 min-h-10 w-full rounded-xl border border-white/20 bg-transparent px-3"
            />
          </label>

          <div className="space-y-1 border-t border-white/15 pt-3 text-sm">
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

          <div className="grid gap-2">
            <button
              type="button"
              disabled={pending || !shift || cart.length === 0}
              onClick={placeAndPay}
              className="min-h-12 rounded-xl bg-[#e7c27d] text-base font-semibold text-[#2f241c] disabled:opacity-50"
            >
              {pending ? "Working…" : `Place & pay (${payMethod})`}
            </button>
            <button
              type="button"
              disabled={pending || !shift || cart.length === 0}
              onClick={placeOrder}
              className="min-h-11 rounded-xl border border-white/25 bg-white/10 text-sm font-semibold disabled:opacity-50"
            >
              Place order only
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2">
            {(["CASH", "UPI", "CARD"] as PaymentMethod[]).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPayMethod(method)}
                className={`min-h-10 min-w-0 rounded-lg px-1 text-xs font-semibold sm:text-sm ${
                  payMethod === method ? "bg-[#e7c27d] text-[#2f241c]" : "bg-white/10"
                }`}
              >
                {method}
              </button>
            ))}
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap gap-2">
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder={`Pay up to ${roundMoney(lastOrderId ? Number(payAmount) || totals.total : totals.total)}`}
              value={payAmount}
              onChange={(event) =>
                setPayAmount(event.target.value === "" ? "" : Number(event.target.value))
              }
              className="min-h-11 min-w-0 flex-1 basis-[7rem] rounded-xl border border-white/20 bg-transparent px-3"
            />
            <button
              type="button"
              disabled={pending || !lastOrderId}
              onClick={recordPay}
              title={!lastOrderId ? "Place an order first" : "Record payment"}
              className="min-h-11 shrink-0 rounded-xl bg-white/15 px-4 disabled:opacity-40"
            >
              Record
            </button>
          </div>
          {!lastOrderId ? (
            <p className="mt-2 text-[11px] text-[#d9cfc0]/80">
              Record unlocks after an order is placed. Prefer <strong>Place &amp; pay</strong> for one step.
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-emerald-200/90">
              Order ready for payment — choose method and tap Record.
            </p>
          )}
          </div>
        </aside>
      </div>

      {customizing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[#fffaf3] p-4 shadow-xl">
            <h3 className="text-xl font-semibold text-[#2f241c]">{customizing.name}</h3>
            {(customizing.variants ?? []).length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {customizing.variants!.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    disabled={variant.isAvailable === false}
                    onClick={() => setSelectedVariantId(variant.id)}
                    className={`min-h-11 rounded-xl px-3 text-sm ${
                      selectedVariantId === variant.id
                        ? "bg-[#2f241c] text-white"
                        : "bg-[#efe6d8]"
                    }`}
                  >
                    {variant.name} · {money(variant.price, currency)}
                  </button>
                ))}
              </div>
            ) : null}
            {(customizing.addonGroups ?? []).map((group) => (
              <div key={group.id} className="mt-4">
                <p className="text-sm font-medium text-[#5c4634]">
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
                                return {
                                  ...prev,
                                  [group.id]: current.filter((id) => id !== addon.id),
                                };
                              }
                              const next =
                                group.maxSelect <= 1
                                  ? [addon.id]
                                  : [...current, addon.id].slice(0, group.maxSelect);
                              return { ...prev, [group.id]: next };
                            });
                          }}
                          className={`min-h-10 rounded-xl px-3 text-sm ${
                            selected ? "bg-[#2f241c] text-white" : "bg-[#efe6d8]"
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
                className="min-h-11 flex-1 rounded-xl bg-[#efe6d8]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addCustomizedToCart}
                className="min-h-11 flex-1 rounded-xl bg-[#2f241c] text-white"
              >
                Add to bill
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
