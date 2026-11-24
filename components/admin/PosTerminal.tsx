"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import type {
  Category,
  Dish,
  OrderChannel,
  PaymentMethod,
  PosShift,
  RestaurantTable,
} from "@/types";
import { computeBillTotals, lineItemTotal, roundMoney } from "@/lib/order-pricing";

type CartLine = {
  key: string;
  dishId: string;
  name: string;
  image?: string;
  variantId?: string;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  itemDiscountAmount: number;
  note: string;
  addons: { addonId: string; name: string; price: number; groupId: string }[];
};

type Props = {
  restaurantName: string;
  currency: string;
  taxRatePercent: number;
  taxLabel: string;
  categories: Category[];
  dishes: Dish[];
  tables: RestaurantTable[];
  initialTableId?: string;
  initialShift: PosShift | null;
  upiSettings?: { enabled: boolean; upiId: string; payeeName: string; staticQrUrl?: string };
};

const ACCENT = "#1d4ed8";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function dishImage(dish: Dish) {
  return dish.image || dish.imageUrl || dish.gallery?.find((item) => item.type === "IMAGE")?.url;
}

/**
 * Admin POS — same simple table-app flow as captain:
 * Add Order grid → Cart → KOT & Hold / KOT & Bill.
 */
export default function PosTerminal({
  restaurantName,
  currency,
  taxRatePercent,
  taxLabel,
  categories,
  dishes,
  tables,
  initialTableId,
  initialShift,
}: Props) {
  const [shift, setShift] = useState(initialShift);
  const [openingFloat, setOpeningFloat] = useState(0);
  const [screen, setScreen] = useState<"menu" | "cart">("menu");
  const [channel, setChannel] = useState<OrderChannel>("POS_DINE_IN");
  const [tableId, setTableId] = useState(
    initialTableId && tables.some((table) => table.id === initialTableId) ? initialTableId : "",
  );
  const selectedTable = tables.find((table) => table.id === tableId);
  const [categoryId, setCategoryId] = useState("ALL");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [billDiscount, setBillDiscount] = useState(0);
  const [discountMode, setDiscountMode] = useState<"AMOUNT" | "PERCENTAGE">("PERCENTAGE");
  const [discountInput, setDiscountInput] = useState("");
  const [serviceChargePercent, setServiceChargePercent] = useState(0);
  const [customerPhone, setCustomerPhone] = useState("");
  const [guestName, setGuestName] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [draftDiscountMode, setDraftDiscountMode] = useState<"AMOUNT" | "PERCENTAGE">("PERCENTAGE");
  const [draftDiscountValue, setDraftDiscountValue] = useState("");
  const [draftServiceValue, setDraftServiceValue] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("CASH");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [placeKey, setPlaceKey] = useState(() => crypto.randomUUID());
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

  const lineTotals = cart.map((line) =>
    lineItemTotal({
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      addonTotals: line.addons.map((addon) => addon.price),
      itemDiscountAmount: line.itemDiscountAmount,
    }),
  );
  const itemsSubtotal = roundMoney(lineTotals.reduce((sum, value) => sum + value, 0));
  const safeDiscount = Math.min(billDiscount, itemsSubtotal);
  const serviceCharge = roundMoney((Math.max(0, itemsSubtotal - safeDiscount) * serviceChargePercent) / 100);
  const totals = computeBillTotals({
    lineTotals,
    billDiscountAmount: safeDiscount,
    taxRatePercent,
  });
  const grandTotal = roundMoney(totals.total + serviceCharge);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  function dishNeedsCustomize(dish: Dish) {
    const variants = (dish.variants ?? []).filter((variant) => variant.isAvailable !== false);
    const groups = (dish.addonGroups ?? []).filter((group) => group.isActive !== false);
    return variants.length > 0 || groups.length > 0;
  }

  function addSimple(dish: Dish, variant?: NonNullable<Dish["variants"]>[number]) {
    const existing = cart.find(
      (line) =>
        line.dishId === dish.id &&
        line.variantId === variant?.id &&
        line.addons.length === 0 &&
        !line.note,
    );
    if (existing) {
      setCart((prev) =>
        prev.map((line) =>
          line.key === existing.key ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line,
        ),
      );
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        dishId: dish.id,
        name: dish.name,
        image: dishImage(dish),
        variantId: variant?.id,
        variantName: variant?.name,
        unitPrice: variant?.price ?? dish.price,
        quantity: 1,
        itemDiscountAmount: 0,
        note: "",
        addons: [],
      },
    ]);
  }

  function beginCustomize(dish: Dish) {
    if (!dishNeedsCustomize(dish)) {
      addSimple(dish);
      return;
    }
    const variants = (dish.variants ?? []).filter((variant) => variant.isAvailable !== false);
    const groups = (dish.addonGroups ?? []).filter((group) => group.isActive !== false);
    if (variants.length === 1 && groups.length === 0) {
      addSimple(dish, variants[0]);
      return;
    }
    setSelectedVariantId(variants[0]?.id ?? "");
    setSelectedAddons({});
    setCustomizing(dish);
  }

  function setQty(key: string, quantity: number) {
    setCart((prev) =>
      prev
        .map((line) => (line.key === key ? { ...line, quantity } : line))
        .filter((line) => line.quantity > 0),
    );
  }

  function confirmCustomize() {
    if (!customizing) return;
    const variants = (customizing.variants ?? []).filter((variant) => variant.isAvailable !== false);
    if (variants.length > 0 && !selectedVariantId) {
      setMessage(`Pick a size for ${customizing.name}`);
      return;
    }
    const variant = variants.find((entry) => entry.id === selectedVariantId);
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
        key: crypto.randomUUID(),
        dishId: customizing.id,
        name: customizing.name,
        image: dishImage(customizing),
        variantId: variant?.id,
        variantName: variant?.name,
        unitPrice: variant?.price ?? customizing.price,
        quantity: 1,
        itemDiscountAmount: 0,
        note: "",
        addons,
      },
    ]);
    setCustomizing(null);
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
        if (!json.success) throw new Error(json.error || "Could not start shift");
        setShift(json.data);
        setMessage("Shift open. Start taking orders.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not start shift");
      }
    });
  }

  async function submitOrder(mode: "hold" | "bill") {
    if (!shift) {
      setMessage("Start shift first.");
      return;
    }
    if (cart.length === 0) {
      setMessage("Add food first.");
      return;
    }
    if (channel === "POS_DINE_IN" && !selectedTable) {
      setMessage("Select a table.");
      setScreen("cart");
      return;
    }

    startTransition(async () => {
      try {
        const payload: Record<string, unknown> = {
          channel,
          customerPhone: customerPhone.trim() || undefined,
          billDiscountAmount: safeDiscount || undefined,
          idempotencyKey: placeKey,
          shiftId: shift.id,
          orderNote: guestName.trim() ? `Guest: ${guestName.trim()}` : undefined,
          items: cart.map((line) => ({
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
        };
        if (channel === "POS_DINE_IN" && selectedTable) {
          payload.tableId = selectedTable.id;
          payload.tableNumber = selectedTable.tableNumber;
        }

        const response = await fetch("/api/pos/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Order failed");

        const order = json.data as { id: string; orderNumber: number | string; total: number };
        setPlaceKey(crypto.randomUUID());
        setCart([]);
        setBillDiscount(0);
        setDiscountInput("");
        setServiceChargePercent(0);
        setCustomerPhone("");
        setGuestName("");
        setScreen("menu");

        if (mode === "bill" && payMethod !== "UPI") {
          const pay = await fetch(`/api/orders/${encodeURIComponent(order.id)}/payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ method: payMethod, amount: order.total }),
          });
          const payJson = await pay.json();
          if (!payJson.success) {
            setMessage(`Order #${order.orderNumber} saved. Payment failed — try again from Orders.`);
            return;
          }
          setMessage(`Order #${order.orderNumber} · Paid ${money(order.total, currency)}`);
          return;
        }

        setMessage(
          mode === "hold"
            ? `Order #${order.orderNumber} held · ${money(order.total, currency)}`
            : `Order #${order.orderNumber} ready · take ${payMethod} ${money(order.total, currency)}`,
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Order failed");
      }
    });
  }

  if (!shift) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-4 p-4">
        <h1 className="text-3xl font-black">Start POS</h1>
        <p className="text-base text-neutral-600">{restaurantName}</p>
        {message ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{message}</p> : null}
        <label className="text-sm font-bold text-neutral-700">
          Opening cash (₹)
          <input
            type="number"
            min={0}
            value={openingFloat}
            onChange={(event) => setOpeningFloat(Number(event.target.value) || 0)}
            className="mt-2 min-h-14 w-full rounded-2xl border border-neutral-200 px-4 text-lg"
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={openShift}
          className="min-h-14 rounded-2xl text-lg font-black text-white disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}
        >
          {pending ? "Opening…" : "Open shift"}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col bg-[#f3f4f6] text-neutral-900">
      {message ? (
        <p className="mx-3 mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          {message}
        </p>
      ) : null}

      {screen === "menu" ? (
        <div className="flex min-h-[100dvh] flex-col pb-36">
          <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white px-3 py-3">
            <h1 className="text-xl font-black">Add Order</h1>
            <p className="text-sm text-neutral-500">{restaurantName}</p>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                className="min-h-11 w-full rounded-full border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm"
              />
            </div>
            <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setCategoryId("ALL")}
                className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-semibold ${
                  categoryId === "ALL" ? "border-blue-600 text-blue-700" : "border-neutral-200 bg-white"
                }`}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryId(category.id)}
                  className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-semibold ${
                    categoryId === category.id ? "border-blue-600 text-blue-700" : "border-neutral-200 bg-white"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </header>

          <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4">
            {availableDishes.map((dish) => {
              const inCart = cart.find(
                (line) => line.dishId === dish.id && line.addons.length === 0 && !line.note,
              );
              const qty = inCart?.quantity ?? 0;
              const img = dishImage(dish);
              const price = (dish.variants?.[0]?.price ?? dish.price) as number;
              return (
                <div key={dish.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  <div className="relative aspect-square bg-neutral-100">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-neutral-300">
                        <UtensilsCrossed className="h-8 w-8" />
                      </div>
                    )}
                    <span className="absolute right-1.5 top-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {money(price, currency)}
                    </span>
                    {qty > 0 ? (
                      <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-lg bg-blue-600 px-1 py-0.5 text-white">
                        <button type="button" className="grid h-7 w-7 place-items-center" onClick={() => inCart && setQty(inCart.key, qty - 1)}>
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-4 text-center text-xs font-bold">{qty}</span>
                        <button type="button" className="grid h-7 w-7 place-items-center" onClick={() => beginCustomize(dish)}>
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => beginCustomize(dish)}
                        className="absolute bottom-1.5 right-1.5 grid h-8 w-8 place-items-center rounded-lg text-white"
                        style={{ backgroundColor: ACCENT }}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="line-clamp-2 px-2 py-2 text-xs font-semibold">{dish.name}</p>
                </div>
              );
            })}
          </div>

          <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 space-y-2 border-t border-neutral-200 bg-white p-3">
            {cartCount > 0 ? (
              <button
                type="button"
                onClick={() => setScreen("cart")}
                className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-semibold shadow-sm"
              >
                <span className="inline-flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-blue-700" />
                  View Cart | {cartCount} Items | {money(grandTotal, currency)}
                </span>
              </button>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={pending || cartCount === 0}
                onClick={() => void submitOrder("hold")}
                className="min-h-12 rounded-2xl border border-neutral-300 bg-white text-base font-bold disabled:opacity-40"
              >
                KOT & Hold
              </button>
              <button
                type="button"
                disabled={pending || cartCount === 0}
                onClick={() => void submitOrder("bill")}
                className="min-h-12 rounded-2xl text-base font-bold text-white disabled:opacity-40"
                style={{ backgroundColor: ACCENT }}
              >
                KOT & Bill
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[100dvh] flex-col pb-28">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-neutral-200 bg-white px-3 py-3">
            <button type="button" onClick={() => setScreen("menu")} className="grid h-10 w-10 place-items-center" aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold">Cart</h1>
          </header>

          <div className="space-y-3 p-3">
            <section className="scrollbar-none flex gap-3 overflow-x-auto pb-1">
              {cart.map((line) => (
                <article key={line.key} className="w-40 shrink-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                  <div className="relative aspect-[4/3] bg-neutral-100">
                    {line.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={line.image} alt="" className="h-full w-full object-cover" />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setCart((prev) => prev.filter((entry) => entry.key !== line.key))}
                      className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2 p-2">
                    <p className="line-clamp-2 text-xs font-semibold">{line.name}</p>
                    <p className="text-xs font-bold">{money(line.unitPrice, currency)}</p>
                    <div className="inline-flex items-center rounded-lg bg-blue-600 text-white">
                      <button type="button" className="grid h-8 w-8 place-items-center" onClick={() => setQty(line.key, line.quantity - 1)}>
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-5 text-center text-xs font-bold">{line.quantity}</span>
                      <button type="button" className="grid h-8 w-8 place-items-center" onClick={() => setQty(line.key, Math.min(99, line.quantity + 1))}>
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white">
              <button type="button" onClick={() => setCustomerOpen((open) => !open)} className="flex min-h-12 w-full items-center justify-between px-4 text-sm font-semibold">
                <span>Customer Details</span>
                <span className="font-bold text-blue-700">{customerOpen ? "HIDE" : "ADD"}</span>
              </button>
              {customerOpen ? (
                <div className="grid gap-2 border-t border-neutral-100 px-4 py-3">
                  <input value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Name" className="min-h-11 rounded-xl border border-neutral-200 px-3 text-sm" />
                  <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Phone" inputMode="tel" className="min-h-11 rounded-xl border border-neutral-200 px-3 text-sm" />
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-3">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setChannel("POS_DINE_IN")}
                  className={`flex min-h-12 items-center justify-center gap-1 rounded-xl border text-sm font-bold ${
                    channel === "POS_DINE_IN" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-neutral-200 text-neutral-600"
                  }`}
                >
                  <UtensilsCrossed className="h-4 w-4" /> Dine-In
                </button>
                <button
                  type="button"
                  onClick={() => setChannel("POS_TAKEAWAY")}
                  className={`flex min-h-12 items-center justify-center gap-1 rounded-xl border text-sm font-bold ${
                    channel === "POS_TAKEAWAY" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-neutral-200 text-neutral-600"
                  }`}
                >
                  Takeaway
                </button>
                <button
                  type="button"
                  disabled
                  title="Delivery channel is not enabled yet"
                  className="flex min-h-12 items-center justify-center gap-1 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-400"
                >
                  <Truck className="h-4 w-4" /> Delivery (soon)
                </button>
              </div>
            </section>

            {channel === "POS_DINE_IN" ? (
              <section className="rounded-2xl border border-neutral-200 bg-white p-3">
                <label className="block text-xs font-semibold text-neutral-500">
                  Table Number
                  <select
                    value={tableId}
                    onChange={(event) => setTableId(event.target.value)}
                    className={`mt-1 block min-h-12 w-full rounded-xl border bg-white px-3 text-sm ${
                      !selectedTable ? "border-rose-400" : "border-neutral-200"
                    }`}
                  >
                    <option value="">Select Table</option>
                    {tables.map((table) => (
                      <option key={table.id} value={table.id}>
                        Table {table.tableNumber}
                        {table.label ? ` · ${table.label}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            ) : null}

            <section className="rounded-2xl border border-neutral-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold text-neutral-500">Payment Type</p>
              <div className="flex gap-2 overflow-x-auto">
                {(["CASH", "UPI", "CARD"] as PaymentMethod[]).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPayMethod(method)}
                    className={`min-h-11 shrink-0 rounded-xl border px-4 text-sm font-semibold ${
                      payMethod === method ? "border-blue-600 text-blue-700" : "border-neutral-200"
                    }`}
                  >
                    {method === "CASH" ? "Cash" : method === "UPI" ? "UPI" : "Card"}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4">
              <h2 className="text-sm font-bold">Bill Details</h2>
              <dl className="mt-3 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Sub Total</dt>
                  <dd className="font-semibold">{money(totals.itemsSubtotal, currency)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-500">Discount</dt>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftDiscountMode(discountMode);
                      setDraftDiscountValue(discountInput || (safeDiscount ? String(safeDiscount) : ""));
                      setDiscountOpen(true);
                    }}
                    className="font-bold text-blue-700"
                  >
                    {safeDiscount > 0 ? `−${money(safeDiscount, currency)}` : "ADD"}
                  </button>
                </div>
                {totals.taxAmount > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">{taxLabel}</dt>
                    <dd className="font-semibold">{money(totals.taxAmount, currency)}</dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-500">Service Charge</dt>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftServiceValue(serviceChargePercent ? String(serviceChargePercent) : "");
                      setServiceOpen(true);
                    }}
                    className="font-bold text-blue-700"
                  >
                    {serviceCharge > 0 ? money(serviceCharge, currency) : "ADD"}
                  </button>
                </div>
                <div className="flex justify-between border-t border-dashed border-neutral-200 pt-3 text-base font-bold">
                  <dt>Total Amount</dt>
                  <dd>{money(grandTotal, currency)}</dd>
                </div>
              </dl>
            </section>
          </div>

          <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 border-t border-neutral-200 bg-white p-3">
            <button
              type="button"
              disabled={pending || cartCount === 0}
              onClick={() => void submitOrder("hold")}
              className="min-h-12 rounded-2xl border border-neutral-300 bg-white text-base font-bold disabled:opacity-40"
            >
              KOT & Hold
            </button>
            <button
              type="button"
              disabled={pending || cartCount === 0}
              onClick={() => void submitOrder("bill")}
              className="min-h-12 rounded-2xl text-base font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: ACCENT }}
            >
              KOT & Bill
            </button>
          </div>
        </div>
      )}

      {discountOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <button type="button" onClick={() => setDiscountOpen(false)} className="absolute -top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-neutral-700 text-white" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-bold">Add Discount</h3>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(["AMOUNT", "PERCENTAGE"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDraftDiscountMode(mode)}
                  className={`min-h-11 rounded-xl border text-sm font-semibold ${
                    draftDiscountMode === mode ? "border-blue-600 text-blue-700" : "border-neutral-200"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-xs font-semibold text-neutral-500">
              Discount
              <div className="relative mt-1">
                <input
                  inputMode="decimal"
                  value={draftDiscountValue}
                  onChange={(event) => setDraftDiscountValue(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-blue-500 px-3 pr-10 text-base"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
                  {draftDiscountMode === "PERCENTAGE" ? "%" : "₹"}
                </span>
              </div>
            </label>
            <button
              type="button"
              onClick={() => {
                const raw = Number(draftDiscountValue);
                if (!Number.isFinite(raw) || raw < 0) return;
                  if (draftDiscountMode === "PERCENTAGE") {
                  const pct = Math.min(100, raw);
                  setBillDiscount(roundMoney((totals.itemsSubtotal * pct) / 100));
                  setDiscountMode("PERCENTAGE");
                  setDiscountInput(String(pct));
                } else {
                  setBillDiscount(roundMoney(Math.min(raw, totals.itemsSubtotal)));
                  setDiscountMode("AMOUNT");
                  setDiscountInput(String(raw));
                }
                setDiscountOpen(false);
              }}
              className="mt-5 min-h-12 w-full rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: ACCENT }}
            >
              Save Details
            </button>
          </div>
        </div>
      ) : null}

      {serviceOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <button type="button" onClick={() => setServiceOpen(false)} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-neutral-100" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-bold">Add Service Charge</h3>
            <label className="mt-4 block text-xs font-semibold text-neutral-500">
              Service Charge
              <div className="relative mt-1">
                <input
                  inputMode="decimal"
                  value={draftServiceValue}
                  onChange={(event) => setDraftServiceValue(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-blue-500 px-3 pr-10 text-base"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">%</span>
              </div>
            </label>
            <button
              type="button"
              onClick={() => {
                const raw = Number(draftServiceValue);
                if (!Number.isFinite(raw) || raw < 0 || raw > 100) return;
                setServiceChargePercent(raw);
                setServiceOpen(false);
              }}
              className="mt-5 min-h-12 w-full rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: ACCENT }}
            >
              Save Details
            </button>
          </div>
        </div>
      ) : null}

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
                        selectedVariantId === variant.id ? "bg-blue-700 text-white" : "bg-neutral-100"
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
                  <p className="text-sm font-medium">{group.name}</p>
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
                                return {
                                  ...prev,
                                  [group.id]: selected
                                    ? current.filter((id) => id !== addon.id)
                                    : [...current, addon.id],
                                };
                              });
                            }}
                            className={`min-h-10 rounded-xl px-3 text-sm ${
                              selected ? "bg-blue-700 text-white" : "bg-neutral-100"
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
              <button type="button" onClick={() => setCustomizing(null)} className="min-h-11 flex-1 rounded-xl border">
                Cancel
              </button>
              <button type="button" onClick={confirmCustomize} className="min-h-11 flex-1 rounded-xl text-white" style={{ backgroundColor: ACCENT }}>
                Add to cart
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
