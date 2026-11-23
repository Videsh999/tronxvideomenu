"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import type {
  CaptainPermissions,
  Category,
  Dish,
  RestaurantBillingSettings,
  RestaurantTable,
} from "@/types";
import { lineItemTotal, roundMoney } from "@/lib/order-pricing";
import { calculateRestaurantBill } from "@/lib/billing/calculate-bill";
import { resolveLineTaxRate } from "@/lib/billing/resolve-tax-rate";
import { resolveCaptainPermissions } from "@/lib/captain-permissions";
import { locationName } from "@/lib/service-location";

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

type TableCartState = {
  cart: CartLine[];
  guestName: string;
  guestCount: string;
  orderNote: string;
  customerPhone: string;
  couponCode: string;
  billDiscount: number;
  discountMode: "AMOUNT" | "PERCENTAGE";
  discountInput: string;
  serviceChargePercent: number;
  serviceChargeInput: string;
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
  internalTracking?: boolean;
};

type Screen = "menu" | "cart";
type SubmitMode = "hold" | "kot" | "bill";

const ACCENT = "#1d4ed8";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function dishImage(dish: Dish) {
  if (dish.image) return dish.image;
  if (dish.imageUrl) return dish.imageUrl;
  const galleryImage = dish.gallery?.find((item) => item.type === "IMAGE");
  return galleryImage?.url ?? galleryImage?.posterUrl;
}

function emptyCartState(): TableCartState {
  return {
    cart: [],
    guestName: "",
    guestCount: "",
    orderNote: "",
    customerPhone: "",
    couponCode: "",
    billDiscount: 0,
    discountMode: "PERCENTAGE",
    discountInput: "",
    serviceChargePercent: 0,
    serviceChargeInput: "",
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
  internalTracking = false,
}: Props) {
  const router = useRouter();
  const permissions = resolveCaptainPermissions({ permissions: rawPermissions ?? undefined });
  const [screen, setScreen] = useState<Screen>("menu");
  const [tableId, setTableId] = useState<string>(
    initialTableId && tables.some((table) => table.id === initialTableId) ? initialTableId : "",
  );
  const [cartsByTable, setCartsByTable] = useState<Record<string, TableCartState>>({});
  const [categoryId, setCategoryId] = useState("ALL");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [customizing, setCustomizing] = useState<Dish | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string[]>>({});
  const [customerOpen, setCustomerOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [draftDiscountMode, setDraftDiscountMode] = useState<"AMOUNT" | "PERCENTAGE">("PERCENTAGE");
  const [draftDiscountValue, setDraftDiscountValue] = useState("");
  const [draftServiceValue, setDraftServiceValue] = useState("");

  const tableKey = tableId || "__draft__";
  const session = cartsByTable[tableKey] ?? emptyCartState();
  const selectedLocation = tables.find((item) => item.id === tableId) ?? null;

  function patchSession(patch: Partial<TableCartState>) {
    setCartsByTable((prev) => ({
      ...prev,
      [tableKey]: { ...(prev[tableKey] ?? emptyCartState()), ...patch },
    }));
  }

  useEffect(() => {
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

  const effectiveBilling = useMemo<RestaurantBillingSettings>(() => {
    const base =
      billing ??
      ({
        taxRatePercent,
        gstEnabled: taxRatePercent > 0,
        gstRatePercent: taxRatePercent,
        taxLabel,
      } satisfies RestaurantBillingSettings);
    if (session.serviceChargePercent > 0) {
      return {
        ...base,
        serviceChargeEnabled: true,
        serviceChargeType: "PERCENT",
        serviceChargePercent: session.serviceChargePercent,
      };
    }
    return base;
  }, [billing, session.serviceChargePercent, taxLabel, taxRatePercent]);

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
        return {
          lineTotal: lineTotals[index],
          quantity: line.quantity,
          gstRatePercent: resolveLineTaxRate({ dish, category, billing: effectiveBilling }).rate,
        };
      }),
      billDiscountAmount: session.billDiscount,
      billing: effectiveBilling,
    });
  }, [categories, dishes, effectiveBilling, session.billDiscount, session.cart]);

  const cartItemCount = session.cart.reduce((sum, line) => sum + line.quantity, 0);

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
    const availableVariants = (dish.variants ?? []).filter((variant) => variant.isAvailable !== false);
    const activeGroups = (dish.addonGroups ?? []).filter((group) => group.isActive !== false);
    if (availableVariants.length === 1 && activeGroups.length === 0) {
      addSimple(dish, availableVariants[0]);
      return;
    }
    const firstVariant = availableVariants[0];
    setSelectedVariantId(firstVariant?.id ?? "");
    setSelectedAddons({});
    setCustomizing(dish);
  }

  function addSimple(dish: Dish, variant?: NonNullable<Dish["variants"]>[number]) {
    const existing = session.cart.find(
      (line) =>
        line.dishId === dish.id &&
        line.variantId === variant?.id &&
        line.addons.length === 0 &&
        !line.note &&
        !line.itemDiscountAmount,
    );
    if (existing) {
      if (existing.quantity >= 99) {
        setMessage("Maximum 99 of one item per line.");
        return;
      }
      patchSession({
        cart: session.cart.map((line) =>
          line.key === existing.key ? { ...line, quantity: line.quantity + 1 } : line,
        ),
      });
      return;
    }
    patchSession({
      cart: [
        ...session.cart,
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
      ],
    });
  }

  function setLineQty(key: string, quantity: number) {
    patchSession({
      cart: session.cart
        .map((line) => (line.key === key ? { ...line, quantity } : line))
        .filter((line) => line.quantity > 0),
    });
  }

  function confirmCustomize() {
    if (!customizing) return;
    const availableVariants = (customizing.variants ?? []).filter(
      (variant) => variant.isAvailable !== false,
    );
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
    patchSession({
      cart: [
        ...session.cart,
        {
          key: `${customizing.id}-${selectedVariantId}-${Date.now()}`,
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
      ],
    });
    setCustomizing(null);
  }

  function applyDiscountDraft() {
    const raw = Number(draftDiscountValue);
    if (!Number.isFinite(raw) || raw < 0) {
      setMessage("Enter a valid discount.");
      return;
    }
    if (draftDiscountMode === "PERCENTAGE") {
      const pct = Math.min(100, raw);
      const amount = roundMoney((totals.itemsSubtotal * pct) / 100);
      patchSession({
        billDiscount: amount,
        discountMode: "PERCENTAGE",
        discountInput: String(pct),
      });
    } else {
      patchSession({
        billDiscount: roundMoney(raw),
        discountMode: "AMOUNT",
        discountInput: String(raw),
      });
    }
    setDiscountOpen(false);
  }

  function applyServiceDraft() {
    const raw = Number(draftServiceValue);
    if (!Number.isFinite(raw) || raw < 0 || raw > 100) {
      setMessage("Enter a service charge between 0 and 100%.");
      return;
    }
    patchSession({ serviceChargePercent: raw, serviceChargeInput: String(raw) });
    setServiceOpen(false);
  }

  async function submitOrder(mode: SubmitMode) {
    if (!selectedLocation) {
      setMessage("Select a table first.");
      setScreen("cart");
      return;
    }
    if (session.cart.length === 0) {
      setMessage("Add at least one item.");
      return;
    }
    if (session.billDiscount > 0 && !permissions.applyDiscount) {
      setMessage("You are not permitted to apply discounts.");
      return;
    }

    const snapshot = session;
    setSubmitting(true);
    // hold = save only · kot = send kitchen, keep table open · bill = send kitchen + open bill
    setMessage(mode === "hold" ? "Saving…" : mode === "bill" ? "Sending KOT and opening bill…" : "Sending KOT…");
    patchSession(emptyCartState());

    try {
      const phone = snapshot.customerPhone.trim();
      const guestCount = Number(snapshot.guestCount);
      const response = await fetch("/api/captain/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: selectedLocation.id,
          tableNumber: selectedLocation.tableNumber,
          guestName: snapshot.guestName.trim() || undefined,
          guestCount: Number.isFinite(guestCount) && guestCount >= 1 ? guestCount : undefined,
          orderNote: snapshot.orderNote.trim() || undefined,
          customerPhone: phone || undefined,
          billDiscountAmount: snapshot.billDiscount || undefined,
          couponCode: snapshot.couponCode.trim() || undefined,
          redeemLoyaltyPoints: snapshot.redeemLoyaltyPoints || undefined,
          idempotencyKey: snapshot.idempotencyKey,
          items: snapshot.cart.map((line) => ({
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
      // Order is already saved — never restore the cart on later failures (avoids duplicate tickets).
      if ((mode === "kot" || mode === "bill") && orderId) {
        const kotResponse = await fetch(
          `/api/captain/orders/${encodeURIComponent(orderId)}/send-kot`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
        );
        const kotJson = await kotResponse.json().catch(() => ({}));
        if (!kotResponse.ok || !kotJson.success) {
          setScreen("menu");
          setMessage(
            typeof kotJson.error === "string"
              ? `${kotJson.error} Order is on the table — open it and tap Send KOT.`
              : "Order saved on the table, but KOT failed. Open the table and tap Send KOT.",
          );
          router.push(`/captain/${slug}/tables/${encodeURIComponent(selectedLocation.id)}`);
          return;
        }
      }

      if (mode === "bill") {
        const tip =
          snapshot.serviceChargePercent > 0
            ? `&tip=${encodeURIComponent(String(snapshot.serviceChargePercent))}`
            : "";
        router.push(
          `/captain/${slug}/tables/${encodeURIComponent(selectedLocation.id)}?bill=1${tip}`,
        );
        return;
      }

      setScreen("menu");
      setMessage(
        mode === "hold"
          ? `Saved on ${locationName(selectedLocation)}. Not sent to kitchen yet — use Send KOT on the table when ready.`
          : `KOT sent · ${locationName(selectedLocation)} still open for more items.`,
      );
    } catch (error) {
      // Only restore cart when create order itself failed (items never saved).
      patchSession(snapshot);
      setMessage(error instanceof Error ? error.message : "Unable to place order");
    } finally {
      setSubmitting(false);
    }
  }

  if (tables.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center">
        <h1 className="text-xl font-bold text-amber-950">No tables available</h1>
        <p className="mt-2 text-sm text-amber-900/80">Ask a manager to assign tables to your captain login.</p>
        <Link href={`/captain/${slug}/tables`} className="mt-4 inline-flex text-sm font-semibold text-amber-950 underline">
          View tables
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col bg-[#f3f4f6] text-neutral-900">
      {message ? (
        <p
          role="status"
          className={`mx-3 mt-3 rounded-xl px-3 py-2 text-sm font-medium ${
            /unable|select|add at least|not permitted|failed|invalid|error/i.test(message)
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {message}
        </p>
      ) : null}

      {screen === "menu" ? (
        <div className="flex min-h-[100dvh] flex-col pb-36">
          <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white px-3 py-3">
            <div className="flex items-center gap-3">
              <Link
                href={`/captain/${slug}/tables`}
                className="grid h-10 w-10 place-items-center rounded-full text-neutral-700"
                aria-label="Back to tables"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="flex-1 text-xl font-black">Add Order</h1>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                  className="min-h-11 w-full rounded-full border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm"
                />
              </div>
            </div>
            <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setCategoryId("ALL")}
                className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-semibold ${
                  categoryId === "ALL"
                    ? "border-blue-600 text-blue-700"
                    : "border-neutral-200 bg-white text-neutral-600"
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
                    categoryId === category.id
                      ? "border-blue-600 text-blue-700"
                      : "border-neutral-200 bg-white text-neutral-600"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </header>

          <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4">
            {availableDishes.map((dish) => {
              const inCart = session.cart.find(
                (line) =>
                  line.dishId === dish.id &&
                  line.addons.length === 0 &&
                  !line.note &&
                  !line.itemDiscountAmount,
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
                      <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-lg bg-blue-600 px-1 py-0.5 text-white shadow">
                        <button
                          type="button"
                          aria-label={`Decrease ${dish.name}`}
                          className="grid h-7 w-7 place-items-center"
                          onClick={() => inCart && setLineQty(inCart.key, qty - 1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-4 text-center text-xs font-bold">{qty}</span>
                        <button
                          type="button"
                          aria-label={`Increase ${dish.name}`}
                          className="grid h-7 w-7 place-items-center"
                          onClick={() => beginCustomize(dish)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Add ${dish.name}`}
                        onClick={() => beginCustomize(dish)}
                        className="absolute bottom-1.5 right-1.5 grid h-8 w-8 place-items-center rounded-lg text-white shadow"
                        style={{ backgroundColor: ACCENT }}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="line-clamp-2 px-2 py-2 text-xs font-semibold leading-snug">{dish.name}</p>
                </div>
              );
            })}
            {availableDishes.length === 0 ? (
              <p className="col-span-full py-12 text-center text-sm text-neutral-400">No dishes in this filter.</p>
            ) : null}
          </div>

          <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 space-y-2 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur">
            {cartItemCount > 0 ? (
              <button
                type="button"
                onClick={() => setScreen("cart")}
                className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-semibold shadow-sm"
              >
                <span className="inline-flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-blue-700" />
                  View Cart | {cartItemCount} Items | {money(totals.total, currency)}
                </span>
              </button>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={submitting || cartItemCount === 0}
                onClick={() => void submitOrder("kot")}
                className="min-h-12 rounded-2xl border border-neutral-300 bg-white text-sm font-bold disabled:opacity-40"
              >
                {submitting ? "Please wait…" : "KOT & Hold"}
              </button>
              <button
                type="button"
                disabled={submitting || cartItemCount === 0}
                onClick={() => void submitOrder("bill")}
                className="min-h-12 rounded-2xl text-base font-bold text-white disabled:opacity-40"
                style={{ backgroundColor: ACCENT }}
              >
                {submitting ? "Please wait…" : "KOT & Bill"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[100dvh] flex-col pb-28">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-neutral-200 bg-white px-3 py-3">
            <button
              type="button"
              onClick={() => setScreen("menu")}
              className="grid h-10 w-10 place-items-center rounded-full"
              aria-label="Back to menu"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold">Cart</h1>
          </header>

          <div className="space-y-3 p-3">
            <section className="scrollbar-none flex gap-3 overflow-x-auto pb-1">
              {session.cart.map((line) => (
                <article
                  key={line.key}
                  className="w-40 shrink-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                >
                  <div className="relative aspect-[4/3] bg-neutral-100">
                    {line.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={line.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-neutral-300">
                        <UtensilsCrossed className="h-6 w-6" />
                      </div>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove ${line.name}`}
                      onClick={() =>
                        patchSession({ cart: session.cart.filter((entry) => entry.key !== line.key) })
                      }
                      className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2 p-2">
                    <p className="line-clamp-2 text-xs font-semibold leading-snug">
                      {line.name}
                      {line.variantName ? `(${line.variantName})` : ""}
                    </p>
                    <p className="text-xs font-bold text-neutral-700">{money(line.unitPrice, currency)}</p>
                    <div className="inline-flex items-center rounded-lg bg-blue-600 text-white">
                      <button
                        type="button"
                        className="grid h-8 w-8 place-items-center"
                        onClick={() => setLineQty(line.key, line.quantity - 1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-5 text-center text-xs font-bold">{line.quantity}</span>
                      <button
                        type="button"
                        className="grid h-8 w-8 place-items-center"
                        onClick={() => setLineQty(line.key, Math.min(99, line.quantity + 1))}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {session.cart.length === 0 ? (
                <p className="w-full rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
                  Cart is empty. Add dishes from the menu.
                </p>
              ) : null}
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white">
              <button
                type="button"
                onClick={() => setCustomerOpen((open) => !open)}
                className="flex min-h-12 w-full items-center justify-between px-4 text-sm font-semibold"
              >
                <span>Customer Details</span>
                <span className="font-bold text-blue-700">{customerOpen ? "HIDE" : "ADD"}</span>
              </button>
              {customerOpen ? (
                <div className="grid gap-2 border-t border-neutral-100 px-4 py-3">
                  <input
                    value={session.guestName}
                    onChange={(event) => patchSession({ guestName: event.target.value })}
                    placeholder="Name"
                    className="min-h-11 rounded-xl border border-neutral-200 px-3 text-sm"
                  />
                  <input
                    value={session.customerPhone}
                    onChange={(event) => patchSession({ customerPhone: event.target.value })}
                    placeholder="Phone"
                    inputMode="tel"
                    className="min-h-11 rounded-xl border border-neutral-200 px-3 text-sm"
                  />
                  {internalTracking ? (
                    <>
                      <input
                        value={session.guestCount}
                        onChange={(event) => patchSession({ guestCount: event.target.value })}
                        placeholder="Guests"
                        inputMode="numeric"
                        className="min-h-11 rounded-xl border border-neutral-200 px-3 text-sm"
                      />
                      <input
                        value={session.orderNote}
                        onChange={(event) => patchSession({ orderNote: event.target.value })}
                        placeholder="Note"
                        className="min-h-11 rounded-xl border border-neutral-200 px-3 text-sm"
                      />
                    </>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="flex min-h-12 items-center justify-center gap-1 rounded-xl border border-blue-600 bg-blue-50 text-sm font-bold text-blue-700">
                  <UtensilsCrossed className="h-4 w-4" />
                  Dine-In
                </div>
                <div className="flex min-h-12 items-center justify-center rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-400">
                  Takeaway
                </div>
                <div className="flex min-h-12 items-center justify-center rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-400">
                  Delivery
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold text-neutral-500">Payment Type</p>
              <div className="scrollbar-none flex gap-2 overflow-x-auto">
                {(["CASH", "UPI", "CARD"] as const).map((method) => (
                  <span
                    key={method}
                    className={`min-h-11 shrink-0 rounded-xl border px-4 text-sm font-semibold leading-[2.75rem] ${
                      method === "CASH"
                        ? "border-blue-600 text-blue-700"
                        : "border-neutral-200 text-neutral-700"
                    }`}
                  >
                    {method === "CASH" ? "Cash" : method === "UPI" ? "UPI" : "Card"}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-neutral-500">Pay on the table bill after KOT & Bill.</p>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-3">
              <label className="block text-xs font-semibold text-neutral-500">
                Table Number
                <select
                  value={tableId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    const moving = session;
                    setTableId(nextId);
                    if (nextId && moving.cart.length) {
                      setCartsByTable((prev) => ({
                        ...prev,
                        [nextId]: {
                          ...(prev[nextId] ?? emptyCartState()),
                          cart: [...(prev[nextId]?.cart ?? []), ...moving.cart],
                          idempotencyKey: crypto.randomUUID(),
                        },
                        __draft__: emptyCartState(),
                      }));
                    }
                    setMessage(null);
                  }}
                  className={`mt-1 block min-h-12 w-full rounded-xl border bg-white px-3 text-sm ${
                    !selectedLocation ? "border-rose-400" : "border-neutral-200"
                  }`}
                >
                  <option value="">Select Table</option>
                  {tables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.locationType === "ROOM" ? "Room" : "Table"} {table.tableNumber}
                      {table.label ? ` · ${table.label}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4">
              <h2 className="text-sm font-bold">Bill Details</h2>
              <dl className="mt-3 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Sub Total</dt>
                  <dd className="font-semibold">{money(totals.itemsSubtotal, currency)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-neutral-500">Discount</dt>
                  <dd>
                    {permissions.applyDiscount ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDraftDiscountMode(session.discountMode);
                          setDraftDiscountValue(session.discountInput || (session.billDiscount ? String(session.billDiscount) : ""));
                          setDiscountOpen(true);
                        }}
                        className="font-bold text-blue-700"
                      >
                        {session.billDiscount > 0
                          ? `−${money(session.billDiscount, currency)}`
                          : "ADD"}
                      </button>
                    ) : (
                      <span className="font-semibold">{money(0, currency)}</span>
                    )}
                  </dd>
                </div>
                {session.billDiscount > 0 ? (
                  <div className="flex justify-between text-emerald-700">
                    <dt>Effective Discount</dt>
                    <dd className="font-semibold">−{money(session.billDiscount, currency)}</dd>
                  </div>
                ) : null}
                {totals.taxAmount > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">{totals.taxLabel || taxLabel}</dt>
                    <dd className="font-semibold">{money(totals.taxAmount, currency)}</dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-neutral-500">Service Charge</dt>
                  <dd>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftServiceValue(
                          session.serviceChargeInput ||
                            (session.serviceChargePercent ? String(session.serviceChargePercent) : ""),
                        );
                        setServiceOpen(true);
                      }}
                      className="font-bold text-blue-700"
                    >
                      {totals.serviceCharge > 0 ? money(totals.serviceCharge, currency) : "ADD"}
                    </button>
                  </dd>
                </div>
                <div className="flex justify-between border-t border-dashed border-neutral-200 pt-3 text-base font-bold">
                  <dt>Total Amount</dt>
                  <dd>{money(totals.total, currency)}</dd>
                </div>
              </dl>
            </section>
          </div>

          <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 border-t border-neutral-200 bg-white p-3">
            <button
              type="button"
              disabled={submitting || cartItemCount === 0}
              onClick={() => void submitOrder("kot")}
              className="min-h-12 rounded-2xl border border-neutral-300 bg-white text-sm font-bold disabled:opacity-40"
            >
              KOT & Hold
            </button>
            <button
              type="button"
              disabled={submitting || cartItemCount === 0}
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
            <button
              type="button"
              aria-label="Close"
              onClick={() => setDiscountOpen(false)}
              className="absolute -top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-neutral-700 text-white"
            >
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
                    draftDiscountMode === mode
                      ? "border-blue-600 text-blue-700"
                      : "border-neutral-200 text-neutral-600"
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
              onClick={applyDiscountDraft}
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
            <button
              type="button"
              aria-label="Close"
              onClick={() => setServiceOpen(false)}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-neutral-100 text-neutral-600"
            >
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
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
                  %
                </span>
              </div>
            </label>
            <button
              type="button"
              onClick={applyServiceDraft}
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
                className="min-h-11 flex-1 rounded-xl text-white"
                style={{ backgroundColor: ACCENT }}
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
