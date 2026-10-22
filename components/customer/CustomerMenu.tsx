"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Dish, RestaurantMenu } from "@/types";
import type { TableStatus } from "@/types";
import CategoryNav from "@/components/customer/CategoryNav";
import MenuSection from "@/components/customer/MenuSection";
import RestaurantHero from "@/components/customer/RestaurantHero";
import DishDetailModal from "@/components/customer/DishDetailModal";
import { api } from "@/lib/api";
import { AlertTriangle, CalendarDays, Check, ChevronDown, Dices, Minus, Plus, QrCode, Receipt, Search, ShoppingBag, SlidersHorizontal, Trash2, Utensils, Wifi, X } from "lucide-react";
import SmartImage from "@/components/shared/SmartImage";
import FeaturedCarousel from "@/components/customer/FeaturedCarousel";
import SurpriseMe from "@/components/customer/SurpriseMe";
import LanguageMenu from "@/components/customer/LanguageMenu";
import { useI18n } from "@/components/customer/I18nProvider";
import { directionsUrl, heroPill } from "@/components/customer/RestaurantHero";
import type { MessageKey } from "@/lib/i18n/messages";
import type { DishSort } from "@/components/customer/MenuSection";
import type { OrderSummary } from "@/types";
import ReservationPanel from "@/components/customer/ReservationPanel";
import WifiAccessPanel from "@/components/customer/WifiAccessPanel";

type CartSelection = { groupId: string; addonIds: string[] };
type CartLine = { key: string; dishId: string; quantity: number; selections: CartSelection[] };
type CustomerOrderReceipt = Pick<OrderSummary, "id" | "orderNumber" | "tableNumber" | "total" | "status"> & Partial<Pick<OrderSummary, "items" | "subtotal" | "createdAt" | "updatedAt">> & { token: string; restaurantId?: string; restaurantSlug?: string; tableId?: string; customerSessionId?: string };

const orderStatusMessage: Record<OrderSummary["status"], MessageKey> = {
  PENDING: "statusPending",
  ACCEPTED: "statusAccepted",
  PREPARING: "statusPreparing",
  READY: "statusReady",
  SERVED: "statusServed",
  CANCELLED: "statusCancelled",
};

const orderSteps: { status: OrderSummary["status"]; label: MessageKey }[] = [
  { status: "PENDING", label: "stepReceived" },
  { status: "ACCEPTED", label: "stepAccepted" },
  { status: "PREPARING", label: "stepPreparing" },
  { status: "READY", label: "stepReady" },
  { status: "SERVED", label: "stepServed" },
];

function OrderProgress({ status }: { status: OrderSummary["status"] }) {
  const { t } = useI18n();
  if (status === "CANCELLED") return null;
  const current = orderSteps.findIndex((step) => step.status === status);
  return (
    <ol className="mt-3 grid grid-cols-5 gap-1.5">
      {orderSteps.map((step, index) => {
        const done = index <= current;
        return (
          <li key={step.status} className="min-w-0">
            <span className={`block h-1.5 rounded-full transition-colors ${done ? "bg-[var(--restaurant-primary)]" : "bg-[var(--customer-border)]"} ${index === current && status !== "SERVED" ? "animate-pulse" : ""}`} />
            <span className={`mt-1.5 block truncate text-[10px] font-semibold uppercase tracking-wider ${done ? "text-[var(--restaurant-primary)]" : "text-[var(--restaurant-text-muted)]/70"}`}>{t(step.label)}</span>
          </li>
        );
      })}
    </ol>
  );
}

// crypto.randomUUID only exists in secure contexts (HTTPS/localhost); guests may open the menu over plain HTTP on a LAN.
function createUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<CartLine>;
  return typeof line.key === "string" && typeof line.dishId === "string" && typeof line.quantity === "number" && Number.isInteger(line.quantity) && line.quantity > 0 && Array.isArray(line.selections) && line.selections.every((selection) => Boolean(selection && typeof selection.groupId === "string" && Array.isArray(selection.addonIds) && selection.addonIds.every((id) => typeof id === "string")));
}

function isCustomerOrderReceipt(value: unknown): value is CustomerOrderReceipt {
  if (!value || typeof value !== "object") return false;
  const receipt = value as Partial<CustomerOrderReceipt>;
  return typeof receipt.id === "string" && typeof receipt.token === "string" && typeof receipt.orderNumber === "number" && typeof receipt.tableNumber === "number" && typeof receipt.total === "number" && Boolean(receipt.status && receipt.status in orderStatusMessage);
}

function parseCustomerOrderReceipts(value: unknown): CustomerOrderReceipt[] {
  const candidates = Array.isArray(value) ? value : value ? [value] : [];
  return candidates.filter(isCustomerOrderReceipt);
}

function readStoredCustomerOrders(value: string | null): CustomerOrderReceipt[] {
  if (!value) return [];
  try { return parseCustomerOrderReceipts(JSON.parse(value)); }
  catch { return []; }
}

type CustomerMenuProps = {
  initialMenu: RestaurantMenu;
  restaurantIdOrSlug: string;
  tableNumber: number | null;
  tableId: string | null;
  tableStatus: TableStatus | null;
  invalidTable: boolean;
  reservationsEnabled?: boolean;
  initialReservationView?: boolean;
  wifiEnabled?: boolean;
  videoMenuEnabled?: boolean;
  tableOrderingEnabled?: boolean;
};

export default function CustomerMenu({
  initialMenu,
  restaurantIdOrSlug,
  tableNumber,
  tableId,
  tableStatus,
  invalidTable,
  reservationsEnabled = false,
  initialReservationView = false,
  wifiEnabled = false,
  videoMenuEnabled = true,
  tableOrderingEnabled = true,
}: CustomerMenuProps) {
  const [reservationOpen, setReservationOpen] = useState(initialReservationView);
  const [wifiOpen, setWifiOpen] = useState(false);
  const [refreshResult, setRefreshResult] = useState<{
    restaurantIdOrSlug: string;
    menu: RestaurantMenu;
  } | null>(null);
  const menu =
    refreshResult?.restaurantIdOrSlug === restaurantIdOrSlug
      ? refreshResult.menu
      : initialMenu;

  const activeCategories = useMemo(() => menu.categories
    .filter((category) => category.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder), [menu.categories]);

  const [activeCategory, setActiveCategory] = useState(
    () => activeCategories[0]?.id ?? "",
  );

  const { t, tn, tc, language, status: translationStatus } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [vegetarianOnly, setVegetarianOnly] = useState(false);
  const [videoOnly, setVideoOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [sort, setSort] = useState<DishSort>("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  const activeFilterCount = [vegetarianOnly, videoOnly && videoMenuEnabled, availableOnly, maxPrice !== null, sort !== "recommended"].filter(Boolean).length;
  const resetFilters = () => { setVegetarianOnly(false); setVideoOnly(false); setAvailableOnly(false); setMaxPrice(null); setSort("recommended"); };
  const filteredDishes = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return menu.dishes.filter((dish) => {
      const matchesQuery = !query || [dish.name, dish.description, tc(dish.name), tc(dish.description)]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase().includes(query));
      return matchesQuery
        && (!vegetarianOnly || dish.isVeg)
        && (!videoOnly || !videoMenuEnabled || Boolean(dish.videoUrl))
        && (!availableOnly || dish.isAvailable)
        && (maxPrice === null || dish.price <= maxPrice);
    });
  }, [availableOnly, maxPrice, menu.dishes, searchQuery, tc, vegetarianOnly, videoMenuEnabled, videoOnly]);
  const [selectedDishId, setSelectedDishId] = useState<string | null>(null);
  const selectedDish =
    menu.dishes.find((dish) => dish.id === selectedDishId) ?? null;
  const categoryOrder = useMemo(() => new Map(activeCategories.map((category, index) => [category.id, index])), [activeCategories]);
  const featuredDishes = useMemo(() => menu.dishes
    .filter((dish) => dish.isAvailable && categoryOrder.has(dish.categoryId))
    .sort((a, b) =>
      Number(Boolean(videoMenuEnabled && b.videoUrl)) - Number(Boolean(videoMenuEnabled && a.videoUrl))
      || (categoryOrder.get(a.categoryId) ?? 0) - (categoryOrder.get(b.categoryId) ?? 0)
      || a.sortOrder - b.sortOrder)
    .slice(0, 10), [categoryOrder, menu.dishes, videoMenuEnabled]);
  const [surpriseOpen, setSurpriseOpen] = useState(false);
  const surpriseMe = () => {
    setFiltersOpen(false);
    setSurpriseOpen(true);
  };

  useEffect(() => {
    if (!filtersOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target as Node)) setFiltersOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setFiltersOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [filtersOpen]);

  const isManualScrolling = useRef(false);
  const manualScrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const submitInFlight = useRef(false);
  const idempotencyRef = useRef<string | null>(null);
  const cartKey = `tronx-cart:${menu.restaurant.id}:${tableId ?? "no-table"}`;
  const orderKey = `${cartKey}:orders`;
  const legacyOrderKey = `${cartKey}:active-order`;
  const canOrder = Boolean(tableOrderingEnabled && tableNumber && !invalidTable && tableStatus !== "CLOSED");
  const tableResolved = Boolean(tableNumber && tableId && !invalidTable);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [loadedCartKey, setLoadedCartKey] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [customerOrders, setCustomerOrders] = useState<CustomerOrderReceipt[]>([]);
  const [unpollableOrderIds, setUnpollableOrderIds] = useState<string[]>([]);
  const [customerSessionId, setCustomerSessionId] = useState<string | null>(null);
  const [ordersExpanded, setOrdersExpanded] = useState(true);

  useEffect(() => {
    if (!cartOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setCartOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [cartOpen]);

  useEffect(() => {
    const hydrate = () => {
      let currentSessionId = createUuid();
      try {
        const savedCart = localStorage.getItem(cartKey);
        const parsedCart: unknown = savedCart ? JSON.parse(savedCart) : [];
        setCart(Array.isArray(parsedCart) ? parsedCart.filter(isCartLine) : []);
        const savedOrder = localStorage.getItem(orderKey);
        const savedLegacyOrder = localStorage.getItem(legacyOrderKey);
        const allSavedOrders = [...readStoredCustomerOrders(savedOrder), ...readStoredCustomerOrders(savedLegacyOrder)];
        const parsedOrders = [...new Map(allSavedOrders.map((order) => [order.id, order])).values()];
        const customerSessionStorageKey = `${cartKey}:customer-session`;
        try {
          currentSessionId = sessionStorage.getItem(customerSessionStorageKey) ?? currentSessionId;
          sessionStorage.setItem(customerSessionStorageKey, currentSessionId);
        } catch { /* A per-tab session still works when sessionStorage is disabled. */ }
        setCustomerSessionId(currentSessionId);
        const storedOrders = parsedOrders.map((order) => ({
          ...order,
          restaurantId: order.restaurantId ?? menu.restaurant.id,
          restaurantSlug: order.restaurantSlug ?? menu.restaurant.slug,
          tableId: order.tableId ?? tableId ?? undefined,
          customerSessionId: order.customerSessionId ?? currentSessionId,
        }));
        if (savedOrder || savedLegacyOrder) {
          localStorage.setItem(orderKey, JSON.stringify(storedOrders));
          localStorage.removeItem(legacyOrderKey);
        }
        setCustomerOrders(storedOrders.filter((order) => order.customerSessionId === currentSessionId));
        setUnpollableOrderIds([]);
        const savedKey = sessionStorage.getItem(`${cartKey}:submit-key`);
        idempotencyRef.current = savedKey;
        setLoadedCartKey(cartKey);
        setCartOpen(false);
      } catch {
        setCart([]);
        setCustomerOrders([]);
        setUnpollableOrderIds([]);
        setCustomerSessionId(currentSessionId);
        idempotencyRef.current = null;
        setLoadedCartKey(cartKey);
        setCartOpen(false);
      } finally { setCartReady(true); }
    };
    window.setTimeout(hydrate, 0);
  }, [cartKey, legacyOrderKey, menu.restaurant.id, menu.restaurant.slug, orderKey, tableId]);

  useEffect(() => {
    if (loadedCartKey !== cartKey || !customerSessionId) return;
    try {
      const existingOrders = parseCustomerOrderReceipts(JSON.parse(localStorage.getItem(orderKey) ?? "null"));
      const mergedOrders = [...existingOrders.filter((order) => order.customerSessionId !== customerSessionId), ...customerOrders];
      if (mergedOrders.length) localStorage.setItem(orderKey, JSON.stringify(mergedOrders));
      else localStorage.removeItem(orderKey);
    } catch { /* Keep customer order history available in component state if storage is unavailable. */ }
  }, [cartKey, customerOrders, customerSessionId, loadedCartKey, orderKey]);

  useEffect(() => {
    const syncOrders = (event: StorageEvent) => {
      if (event.key !== orderKey) return;
      try {
        const orders = parseCustomerOrderReceipts(event.newValue ? JSON.parse(event.newValue) : null);
        const currentSessionOrders = orders.filter((order) => order.customerSessionId === customerSessionId);
        setCustomerOrders((current) => JSON.stringify(current) === JSON.stringify(currentSessionOrders) ? current : currentSessionOrders);
        setUnpollableOrderIds([]);
      }
      catch { setCustomerOrders([]); }
    };
    window.addEventListener("storage", syncOrders);
    return () => window.removeEventListener("storage", syncOrders);
  }, [customerSessionId, orderKey]);

  useEffect(() => {
    if (!cartReady || loadedCartKey !== cartKey) return;
    try {
      if (cart.length) localStorage.setItem(cartKey, JSON.stringify(cart));
      else localStorage.removeItem(cartKey);
    } catch { /* Ordering remains usable if browser storage is unavailable. */ }
  }, [cart, cartKey, cartReady, loadedCartKey]);

  const priceForLine = (line: CartLine) => {
    const dish = menu.dishes.find((entry) => entry.id === line.dishId);
    if (!dish) return 0;
    const addonTotal = line.selections.flatMap((selection) => {
      const group = dish.addonGroups?.find((entry) => entry.id === selection.groupId);
      return selection.addonIds.map((addonId) => group?.addons.find((addon) => addon.id === addonId)?.price ?? 0);
    }).reduce((sum, price) => sum + price, 0);
    return (dish.price + addonTotal) * line.quantity;
  };
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cart.reduce((sum, line) => sum + priceForLine(line), 0);
  const customerOrdersTotal = customerOrders.reduce((sum, order) => sum + order.total, 0);

  const addToCart = (entry: { dishId: string; quantity: number; selections: CartSelection[] }) => {
    const canonicalSelections = [...entry.selections].map((selection) => ({ ...selection, addonIds: [...selection.addonIds].sort() })).sort((a, b) => a.groupId.localeCompare(b.groupId));
    const key = `${entry.dishId}:${JSON.stringify(canonicalSelections)}`;
    setCart((current) => {
      const existing = current.find((line) => line.key === key);
      return existing
        ? current.map((line) => line.key === key ? { ...line, quantity: Math.min(99, line.quantity + entry.quantity) } : line)
        : [...current, { key, dishId: entry.dishId, quantity: entry.quantity, selections: canonicalSelections }];
    });
    setOrderError("");
  };

  const changeQuantity = (key: string, delta: number) => setCart((current) => current.map((line) => line.key === key ? { ...line, quantity: line.quantity + delta } : line).filter((line) => line.quantity > 0 && line.quantity <= 99));

  const placeOrder = async () => {
    if (!canOrder || !customerSessionId || !cart.length || submitting || submitInFlight.current) return;
    submitInFlight.current = true;
    setSubmitting(true); setOrderError("");
    try {
      const key = idempotencyRef.current ?? createUuid();
      idempotencyRef.current = key;
      try { sessionStorage.setItem(`${cartKey}:submit-key`, key); } catch { /* The in-memory key still prevents repeat taps in this session. */ }
      const response = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: menu.restaurant.slug,
          tableNumber,
          idempotencyKey: key,
          items: cart.map((line) => {
            const dish = menu.dishes.find((entry) => entry.id === line.dishId)!;
            return {
              dishId: dish.id,
              quantity: line.quantity,
              expectedUnitPrice: dish.price,
              selections: line.selections.map((selection) => ({
                groupId: selection.groupId,
                addons: selection.addonIds.map((addonId) => ({
                  addonId,
                  expectedUnitPrice: dish.addonGroups?.find((group) => group.id === selection.groupId)?.addons.find((addon) => addon.id === addonId)?.price ?? -1,
                })),
              })),
            };
          }),
        }),
      });
      const result = await response.json() as { success: boolean; error?: string; data?: { order: OrderSummary; customerToken: string } };
      if (!response.ok || !result.success || !result.data) throw new Error(result.error || "Unable to place your order.");
      const receipt: CustomerOrderReceipt = {
        ...result.data.order,
        token: result.data.customerToken,
        restaurantId: menu.restaurant.id,
        restaurantSlug: menu.restaurant.slug,
        tableId: tableId ?? undefined,
        customerSessionId,
      };
      try { sessionStorage.removeItem(`${cartKey}:submit-key`); } catch { /* Ignore unavailable session storage. */ }
      idempotencyRef.current = null;
      setCustomerOrders((current) => [...current.filter((order) => order.id !== receipt.id), receipt]);
      setCart([]); setCartOpen(false);
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : "Unable to place your order.");
    } finally { submitInFlight.current = false; setSubmitting(false); }
  };

  const pollableOrders = useMemo(() => customerOrders.filter((order) =>
    order.status !== "SERVED" && order.status !== "CANCELLED" && !unpollableOrderIds.includes(order.id),
  ), [customerOrders, unpollableOrderIds]);

  useEffect(() => {
    if (!pollableOrders.length || loadedCartKey !== cartKey) return;
    let alive = true;
    const refreshStatus = async () => {
      const results = await Promise.all(pollableOrders.map(async (order) => {
        try {
          const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/status`, { cache: "no-store", headers: { Authorization: `Bearer ${order.token}` } });
          if (response.status === 401 || response.status === 403 || response.status === 404) return { id: order.id, rejected: true as const };
          const result = await response.json() as { success: boolean; data?: OrderSummary };
          return result.success && result.data ? { id: order.id, rejected: false as const, order: result.data } : null;
        } catch { return null; }
      }));
      if (!alive) return;
      const updates = results.filter((result): result is NonNullable<typeof result> => result !== null);
      const rejectedIds = updates.filter((result) => result.rejected).map((result) => result.id);
      if (rejectedIds.length) setUnpollableOrderIds((current) => [...new Set([...current, ...rejectedIds])]);
      const validUpdates = updates.filter((result): result is Extract<typeof result, { rejected: false }> => !result.rejected);
      if (validUpdates.length) {
        setCustomerOrders((current) => {
          let changed = false;
          const next = current.map((order) => {
            const result = validUpdates.find((entry) => entry.id === order.id)?.order;
            if (!result || (order.status === result.status && order.updatedAt === result.updatedAt)) return order;
            changed = true;
            return { ...order, ...result, token: order.token };
          });
          return changed ? next : current;
        });
      }
    };
    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), 8000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [cartKey, loadedCartKey, pollableOrders]);

  const refreshMenu = useCallback(async () => {
    try {
      const next = await api.getPublicMenu(restaurantIdOrSlug);
      setRefreshResult({ restaurantIdOrSlug, menu: next });
    } catch {
      return;
    }
  }, [restaurantIdOrSlug]);

  useEffect(() => {
    const onFocus = () => {
      void refreshMenu();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshMenu]);

  const handleCategorySelect = (categoryId: string) => {
    isManualScrolling.current = true;
    setActiveCategory(categoryId === "all" ? "" : categoryId);

    if (manualScrollTimeout.current) {
      clearTimeout(manualScrollTimeout.current);
    }

    manualScrollTimeout.current = setTimeout(() => {
      isManualScrolling.current = false;
    }, 750);
  };

  useEffect(() => {
    if (activeCategories.length === 0) return;

    const observerCallback: IntersectionObserverCallback = () => {
      if (isManualScrolling.current) return;

      if (window.scrollY < 100) {
        const firstId = activeCategories[0].id;
        setActiveCategory((prev) => (prev === firstId ? prev : firstId));
        return;
      }

      const current = activeCategories.find((cat) => {
        const el = document.getElementById(`category-${cat.id}`);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.top <= 170 && rect.bottom > 150;
      });

      if (current) {
        setActiveCategory((prev) => (prev === current.id ? prev : current.id));
      }
    };

    const observer = new IntersectionObserver(observerCallback, {
      root: null,
      rootMargin: "-120px 0px -40% 0px",
      threshold: [0, 0.25, 0.5, 0.75, 1.0],
    });

    activeCategories.forEach((cat) => {
      const element = document.getElementById(`category-${cat.id}`);
      if (element) {
        observer.observe(element);
      }
    });

    const handleScroll = () => {
      if (isManualScrolling.current) return;
      const isAtBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 40;

      if (isAtBottom && activeCategories.length > 0) {
        const lastCategoryId = activeCategories[activeCategories.length - 1].id;
        setActiveCategory((prev) =>
          prev === lastCategoryId ? prev : lastCategoryId,
        );
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
      if (manualScrollTimeout.current) {
        clearTimeout(manualScrollTimeout.current);
      }
    };
  }, [activeCategories]);

  return (
    <main data-script={language.script} className="customer-menu min-h-screen text-[var(--restaurant-text)] selection:bg-[var(--restaurant-primary)]/20">
      <header className="customer-menu-controls sticky top-0 z-30 border-b border-[var(--customer-border)] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 pt-3 sm:gap-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label={`${menu.restaurant.name} — ${t("backToTop")}`} className="flex shrink-0 items-center gap-2.5">
            <span className="relative h-10 w-10 overflow-hidden rounded-xl border border-[var(--customer-border)] bg-white">
              {menu.restaurant.logoUrl ? <SmartImage src={menu.restaurant.logoUrl} alt="" sizes="40px" className="object-cover" /> : <span className="grid h-full w-full place-items-center text-sm font-bold text-[var(--restaurant-primary)]">{menu.restaurant.name.charAt(0)}</span>}
            </span>
            <span translate="no" className="font-condensed hidden text-2xl uppercase lg:block">{menu.restaurant.name}</span>
          </button>

          <div ref={filtersRef} className="relative min-w-0 flex-1 lg:mx-auto lg:max-w-xl">
            <label className="relative block">
              <span className="sr-only">{t("search")}</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input type="search" enterKeyHint="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t("search")} className="h-11 w-full rounded-full border border-transparent bg-neutral-100 pl-10 pr-[6.5rem] text-sm text-[var(--restaurant-text)] outline-none transition placeholder:text-neutral-400 focus:border-neutral-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(0,0,0,0.05)] sm:pr-32 [&::-webkit-search-cancel-button]:hidden" />
            </label>
            <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {searchQuery && <button type="button" onClick={() => setSearchQuery("")} aria-label={t("clearSearch")} className="grid h-8 w-8 place-items-center rounded-full text-neutral-500 hover:bg-neutral-200"><X className="h-4 w-4" /></button>}
              <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} aria-haspopup="dialog" className={`inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition sm:px-3 ${activeFilterCount ? "bg-[var(--restaurant-text)] text-white" : "bg-white text-neutral-700 shadow-sm hover:bg-neutral-50"}`}>
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("filters")}</span>
                <span className="sr-only sm:hidden">{t("filters")}</span>
                {activeFilterCount ? <span className="grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[10px] text-[var(--restaurant-text)]">{activeFilterCount}</span> : null}
              </button>
            </div>

            {filtersOpen && (
              <div role="dialog" aria-label={t("filters")} className="fixed inset-x-3 top-16 z-40 max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain animate-scale-in sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+0.5rem)] sm:max-h-none sm:w-[22rem] sm:overflow-visible rounded-3xl border border-[var(--customer-border)] bg-white p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)] sm:p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">{t("showOnly")}</p>
                <div className="mt-2 space-y-1">
                  {[
                    { label: t("vegetarian"), checked: vegetarianOnly, toggle: () => setVegetarianOnly((value) => !value), show: true },
                    { label: t("hasVideo"), checked: videoOnly, toggle: () => setVideoOnly((value) => !value), show: videoMenuEnabled },
                    { label: t("availableNow"), checked: availableOnly, toggle: () => setAvailableOnly((value) => !value), show: true },
                  ].filter((option) => option.show).map((option) => (
                    <button key={option.label} type="button" role="switch" aria-checked={option.checked} onClick={option.toggle} className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50">
                      {option.label}
                      <span className={`relative h-6 w-10 rounded-full transition ${option.checked ? "bg-[var(--restaurant-text)]" : "bg-neutral-200"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${option.checked ? "left-[18px]" : "left-0.5"}`} /></span>
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">{t("price")}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[null, 200, 300, 400].map((value) => (
                    <button key={value ?? "any"} type="button" aria-pressed={maxPrice === value} onClick={() => setMaxPrice(value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${maxPrice === value ? "bg-[var(--restaurant-text)] text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}>{value === null ? t("any") : t("under", { price: `₹${value}` })}</button>
                  ))}
                </div>
                <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">{t("sortBy")}</p>
                <div className="mt-2 space-y-0.5">
                  {([["recommended", "recommended"], ["price-asc", "priceLowHigh"], ["price-desc", "priceHighLow"]] as const).map(([value, label]) => (
                    <button key={value} type="button" aria-pressed={sort === value} onClick={() => setSort(value)} className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50">{t(label)}{sort === value ? <Check className="h-4 w-4" /> : null}</button>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--customer-border)] pt-4">
                  <button type="button" onClick={resetFilters} disabled={!activeFilterCount} className="text-xs font-semibold text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline disabled:opacity-40">{t("reset")}</button>
                  <div className="flex gap-2">
                    <button type="button" onClick={surpriseMe} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--customer-border)] px-3 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"><Dices className="h-3.5 w-3.5" />{t("surpriseMe")}</button>
                    <button type="button" onClick={() => setFiltersOpen(false)} className="h-9 rounded-full bg-[var(--restaurant-text)] px-4 text-xs font-bold text-white">{t("show", { count: filteredDishes.length })}</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <LanguageMenu />
            {wifiEnabled && <button type="button" onClick={() => setWifiOpen(true)} aria-label={t("wifiTitle")} className="hidden h-11 items-center gap-2 rounded-full border border-[var(--customer-border)] px-4 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 sm:inline-flex"><Wifi className="h-4 w-4" /><span className="hidden md:inline">{t("wifi")}</span></button>}
            {reservationsEnabled && <button type="button" onClick={() => setReservationOpen(true)} aria-label={t("reserveTitle")} className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--restaurant-text)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--restaurant-primary)] sm:px-4"><CalendarDays className="h-4 w-4" /><span className="hidden md:inline">{t("reserve")}</span></button>}
          </div>
        </div>
        {translationStatus === "loading" && <div role="status" className="mx-auto flex max-w-7xl items-center gap-2 px-4 pt-2 text-[11px] font-semibold text-neutral-500 sm:px-6 lg:px-8"><span className="h-1.5 w-1.5 animate-ping rounded-full bg-[var(--restaurant-text)]" />{t("translating")}</div>}
        <CategoryNav categories={activeCategories} activeCategory={activeCategory} onCategoryChange={handleCategorySelect} totalDishCount={menu.dishes.length} />
      </header>

      <RestaurantHero
        restaurant={menu.restaurant}
        tableNumber={tableResolved ? tableNumber : null}
        extraActions={<>
          {wifiEnabled && <button type="button" onClick={() => setWifiOpen(true)} className={`${heroPill} sm:hidden`}><Wifi className="h-3.5 w-3.5" />{t("wifi")}</button>}
          <button type="button" onClick={surpriseMe} className={heroPill}><Dices className="h-3.5 w-3.5" />{t("surpriseMe")}</button>
        </>}
      />

      {invalidTable ? (
        <div role="alert" className="mx-auto mt-5 max-w-7xl px-4 sm:px-6 lg:px-8"><p className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{t("invalidTable")}</p></div>
      ) : !tableResolved && tableOrderingEnabled ? (
        <div className="mx-auto mt-5 max-w-7xl px-4 sm:px-6 lg:px-8"><p className="flex items-center gap-3 rounded-2xl border border-[var(--customer-border)] bg-white/70 px-4 py-3 text-sm text-[var(--restaurant-text-muted)]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--restaurant-primary)]/10 text-[var(--restaurant-primary)]"><QrCode className="h-4 w-4" /></span>{t("scanToOrderNotice")}</p></div>
      ) : null}

      {tableResolved && tableStatus === "CLOSED" && <div role="status" className="mx-auto mt-5 max-w-7xl px-4 sm:px-6 lg:px-8"><p className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm text-rose-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{t("tableClosed")}</p></div>}

      {loadedCartKey === cartKey && customerOrders.length > 0 && (
        <section aria-live="polite" aria-label={t("yourOrders")} className="mx-auto mt-5 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-[var(--customer-border)] bg-white shadow-[0_12px_32px_-20px_rgba(36,20,22,0.35)]">
            <button type="button" onClick={() => setOrdersExpanded((value) => !value)} aria-expanded={ordersExpanded} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-5">
              <span className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--restaurant-primary)] text-white"><Receipt className="h-5 w-5" /></span>
                <span>
                  <span className="block text-sm font-bold text-[var(--restaurant-text)]">{t("yourOrders")}</span>
                  <span className="block text-xs text-[var(--restaurant-text-muted)]">{tn("ordersCount", customerOrders.length)}{tableNumber ? ` · ${t("table", { number: tableNumber })}` : ""}</span>
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-right"><span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--restaurant-text-muted)]">{t("total")}</span><span className="block text-base font-bold tabular-nums text-[var(--restaurant-primary)]">₹{customerOrdersTotal}</span></span>
                <ChevronDown className={`h-5 w-5 text-[var(--restaurant-text-muted)] transition-transform ${ordersExpanded ? "rotate-180" : ""}`} />
              </span>
            </button>
            {ordersExpanded && <div className="max-h-[55vh] space-y-3 overflow-y-auto border-t border-[var(--customer-border)] bg-[var(--customer-cream)]/50 p-3 sm:p-4">
              {customerOrders.map((order) => <article key={order.id} className="rounded-2xl border border-[var(--customer-border)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--restaurant-text-muted)]">{t("orderNumber", { number: order.orderNumber })}{order.createdAt && <span className="font-medium normal-case tracking-normal"> · {new Date(order.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}</p>
                    <p className={`mt-1 text-sm font-semibold ${order.status === "CANCELLED" ? "text-rose-700" : order.status === "READY" ? "text-emerald-700" : "text-[var(--restaurant-text)]"}`}>{t(orderStatusMessage[order.status])}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-[var(--restaurant-primary)]">₹{order.total}</span>
                </div>
                <OrderProgress status={order.status} />
                {order.items && order.items.length > 0 && <ul className="mt-3 space-y-1.5 border-t border-dashed border-[var(--customer-border)] pt-3">{order.items.map((item, index) => <li key={`${item.dishId}-${index}`} className="text-sm"><div className="flex justify-between gap-3"><span className="font-medium text-[var(--restaurant-text)]"><span className="tabular-nums text-[var(--restaurant-text-muted)]">{item.quantity}×</span> {tc(item.dishNameSnapshot)}</span><span className="text-xs tabular-nums text-[var(--restaurant-text-muted)]">₹{item.itemTotal}</span></div>{item.addons.length > 0 && <p className="mt-0.5 pl-5 text-xs text-[var(--restaurant-text-muted)]">{item.addons.map((addon) => `${tc(addon.nameSnapshot)}${addon.quantity > 1 ? ` × ${addon.quantity}` : ""}`).join(" · ")}</p>}</li>)}</ul>}
              </article>)}
            </div>}
          </div>
        </section>
      )}

      {!searchQuery.trim() && !activeFilterCount && featuredDishes.length >= 3 && (
        <FeaturedCarousel title={t("chefsPicks")} dishes={featuredDishes} onSelect={(dish) => setSelectedDishId(dish.id)} videoMenuEnabled={videoMenuEnabled} />
      )}

      <div id="menu-content" className="mx-auto max-w-7xl scroll-mt-36 px-3 py-10 sm:px-6 sm:py-14 lg:px-8">
        {(searchQuery.trim() || activeFilterCount > 0) && <div className="mb-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          <p><span className="font-bold text-[var(--restaurant-text)]">{tn("resultCount", filteredDishes.length)}</span>{searchQuery.trim() ? <> {t("resultFor", { query: searchQuery.trim() })}</> : null}{activeFilterCount ? ` · ${tn("filtersActive", activeFilterCount)}` : ""}</p>
          <button type="button" onClick={() => { setSearchQuery(""); resetFilters(); }} className="font-semibold text-[var(--restaurant-text)] underline-offset-4 hover:underline">{t("clearAll")}</button>
        </div>}
        <div className="space-y-16 sm:space-y-20">
        {filteredDishes.length === 0 && <div className="rounded-3xl border border-dashed border-neutral-200 px-6 py-16 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-neutral-100 text-neutral-500"><Utensils className="h-6 w-6" /></span><p className="font-condensed mt-4 text-3xl uppercase">{menu.dishes.length === 0 ? t("emptyMenuTitle") : t("noMatchTitle")}</p><p className="mx-auto mt-1.5 max-w-sm text-sm text-neutral-500">{menu.dishes.length === 0 ? t("emptyMenuBody") : t("noMatchBody")}</p></div>}
        {activeCategories.map((category, index) => (
          <MenuSection
            key={category.id}
            category={category}
            dishes={filteredDishes}
            onDishClick={(dish: Dish) => setSelectedDishId(dish.id)}
            isFirstCategory={index === 0}
            videoMenuEnabled={videoMenuEnabled}
            canOrder={canOrder}
            sort={sort}
          />
        ))}
        </div>
      </div>

      <footer aria-label={menu.restaurant.name} className="border-t border-[var(--customer-border)] bg-neutral-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div className="lg:col-span-2">
            <p translate="no" className="font-condensed text-4xl uppercase">{menu.restaurant.name}</p>
            <p className="mt-2 max-w-md text-sm text-neutral-500">{tc(menu.restaurant.tagline?.trim() || menu.restaurant.description?.trim()) || t("digitalMenu")}</p>
          </div>
          {menu.restaurant.openingHours ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">{t("openingHours")}</p>
              <p className="mt-2 text-sm font-semibold">{menu.restaurant.openingHours}</p>
              <p className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold ${menu.restaurant.isOpen ? "text-emerald-700" : "text-rose-700"}`}><span className={`h-1.5 w-1.5 rounded-full ${menu.restaurant.isOpen ? "bg-emerald-500" : "bg-rose-500"}`} />{menu.restaurant.isOpen ? t("openNow") : t("closed")}</p>
            </div>
          ) : null}
          {(menu.restaurant.address || menu.restaurant.phone) ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">{t("visitUs")}</p>
              {menu.restaurant.address ? <p className="mt-2 text-sm text-neutral-700">{menu.restaurant.address}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {directionsUrl(menu.restaurant) ? <a href={directionsUrl(menu.restaurant) ?? undefined} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-full border border-neutral-300 px-3.5 text-xs font-semibold hover:bg-white">{t("directions")}</a> : null}
                {menu.restaurant.phone ? <a href={`tel:${menu.restaurant.phone.replace(/\s+/g, "")}`} className="inline-flex h-9 items-center rounded-full border border-neutral-300 px-3.5 text-xs font-semibold hover:bg-white">{t("call")} · {menu.restaurant.phone}</a> : null}
              </div>
            </div>
          ) : null}
        </div>
        <div className="border-t border-[var(--customer-border)]">
          <p className="mx-auto max-w-7xl px-5 pb-28 pt-5 text-xs text-neutral-400 sm:px-6 lg:px-8">{t("poweredBy")} <Link href="/" className="font-semibold text-neutral-600 hover:text-neutral-900">TRONX</Link></p>
        </div>
      </footer>

      <button
        type="button"
        onClick={surpriseMe}
        title={t("surpriseHint")}
        className={`fixed right-3 z-30 inline-flex h-12 items-center gap-2 rounded-full border border-[var(--customer-border)] bg-white pl-2 pr-4 text-sm font-semibold text-neutral-900 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.4)] transition hover:-translate-y-0.5 sm:right-6 ${tableOrderingEnabled && loadedCartKey === cartKey && cart.length > 0 ? "bottom-24" : "bottom-5"}`}
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--restaurant-text)] text-white"><Dices className="h-4 w-4" /></span>
        {t("surpriseMe")}
      </button>

      {selectedDish ? (
        <DishDetailModal
          key={selectedDish.id}
          dish={selectedDish}
          onClose={() => setSelectedDishId(null)}
          canOrder={canOrder}
          orderingEnabled={tableOrderingEnabled}
          videoMenuEnabled={videoMenuEnabled}
          categoryName={activeCategories.find((category) => category.id === selectedDish.categoryId)?.name}
          onAddToCart={addToCart}
        />
      ) : null}

      {surpriseOpen && (
        <SurpriseMe
          dishes={menu.dishes}
          categories={activeCategories}
          canOrder={canOrder}
          onClose={() => setSurpriseOpen(false)}
          onOpenDish={(dish) => setSelectedDishId(dish.id)}
          onAddToCart={addToCart}
          onViewCart={() => { setSurpriseOpen(false); setCartOpen(true); }}
        />
      )}

      {reservationsEnabled && reservationOpen && <ReservationPanel restaurantSlug={menu.restaurant.slug} onClose={() => setReservationOpen(false)} />}
      {wifiEnabled && wifiOpen && <WifiAccessPanel slug={menu.restaurant.slug} onClose={() => setWifiOpen(false)} />}

      {tableOrderingEnabled && loadedCartKey === cartKey && cart.length > 0 && (
        <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 sm:px-6">
          <button type="button" onClick={() => setCartOpen(true)} className="pointer-events-auto mx-auto flex w-full max-w-2xl animate-sheet-up items-center justify-between gap-4 rounded-full bg-[var(--restaurant-primary)] py-2.5 pl-2.5 pr-5 text-left text-white shadow-[0_18px_40px_-12px_var(--restaurant-primary)] ring-1 ring-white/10 transition hover:bg-[var(--restaurant-primary-dark)] active:scale-[0.99]">
            <span className="flex items-center gap-3">
              <span className="relative grid h-11 w-11 place-items-center rounded-full bg-white/15"><ShoppingBag className="h-5 w-5" /><span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold tabular-nums text-[var(--restaurant-primary)]">{cartCount}</span></span>
              <span><span className="block text-sm font-bold">{t("viewCart")}</span><span className="block text-xs text-white/70">{tn("itemsCount", cartCount)} · {t("table", { number: tableNumber ?? "–" })}</span></span>
            </span>
            <span className="text-lg font-bold tabular-nums">₹{cartTotal}</span>
          </button>
        </div>
      )}

      {tableOrderingEnabled && cartOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="cart-title" className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-5" onClick={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
          <div className="flex max-h-[92dvh] w-full max-w-xl animate-sheet-up flex-col overflow-hidden rounded-t-[2rem] bg-[var(--restaurant-background)] shadow-2xl sm:animate-scale-in sm:rounded-[2rem]">
            <div className="flex justify-center pt-3 sm:hidden"><span className="h-1.5 w-12 rounded-full bg-[var(--customer-border)]" /></div>
            <header className="flex items-center justify-between gap-3 px-5 pb-4 pt-3 sm:pt-5">
              <div><h2 id="cart-title" className="font-serif text-2xl font-semibold text-[var(--restaurant-text)]">{t("yourOrder")}</h2><p className="mt-0.5 text-xs text-[var(--restaurant-text-muted)]">{t("table", { number: tableNumber ?? "–" })} · {tn("itemsCount", cartCount)}</p></div>
              <button type="button" onClick={() => setCartOpen(false)} aria-label={t("closeCart")} className="grid h-10 w-10 place-items-center rounded-full bg-[var(--customer-cream)] text-[var(--restaurant-text)] transition hover:bg-[var(--customer-border)]"><X className="h-5 w-5" /></button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain border-t border-[var(--customer-border)] bg-[var(--customer-cream)]/40 p-4 sm:p-5">
              {cart.map((line) => {
                const dish = menu.dishes.find((entry) => entry.id === line.dishId);
                if (!dish) return <p key={line.key} className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{t("dishMissing")}</p>;
                const addonNames = line.selections.flatMap((selection) => selection.addonIds.map((id) => dish.addonGroups?.find((group) => group.id === selection.groupId)?.addons.find((addon) => addon.id === id)?.name).filter((name): name is string => Boolean(name)).map((name) => tc(name)));
                const dishName = tc(dish.name);
                return <article key={line.key} className="flex gap-3 rounded-2xl border border-[var(--customer-border)] bg-white p-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--restaurant-secondary)]">
                    {dish.imageUrl ? <SmartImage src={dish.imageUrl} alt="" sizes="80px" className="object-cover" /> : <span className="grid h-full w-full place-items-center text-white/50"><Utensils className="h-5 w-5" /></span>}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold leading-snug text-[var(--restaurant-text)]">{dishName}</h3>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--restaurant-text)]">₹{priceForLine(line)}</span>
                    </div>
                    {addonNames.length > 0 && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[var(--restaurant-text-muted)]">{addonNames.join(" · ")}</p>}
                    {!dish.isAvailable && <p className="mt-0.5 text-xs font-semibold text-rose-700">{t("currentlyUnavailable")}</p>}
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center rounded-full border border-[var(--customer-border)] bg-white">
                        <button type="button" aria-label={`${t("decrease")} · ${dishName}`} onClick={() => changeQuantity(line.key, -1)} className="grid h-8 w-8 place-items-center rounded-full text-[var(--restaurant-primary)] hover:bg-[var(--customer-cream)]"><Minus className="h-3.5 w-3.5" /></button>
                        <span className="min-w-6 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                        <button type="button" aria-label={`${t("increase")} · ${dishName}`} onClick={() => changeQuantity(line.key, 1)} className="grid h-8 w-8 place-items-center rounded-full text-[var(--restaurant-primary)] hover:bg-[var(--customer-cream)]"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                      <button type="button" onClick={() => setCart((current) => current.filter((entry) => entry.key !== line.key))} aria-label={t("remove", { name: dishName })} className="grid h-8 w-8 place-items-center rounded-full text-rose-700/80 transition hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </article>;
              })}
            </div>
            <footer className="safe-bottom border-t border-[var(--customer-border)] bg-white px-4 pt-4 sm:px-5">
              <div className="mb-3 flex items-center justify-between">
                <button type="button" onClick={() => setCart([])} className="text-xs font-semibold text-[var(--restaurant-text-muted)] underline-offset-4 hover:text-rose-700 hover:underline">{t("clearCart")}</button>
                <p className="text-sm text-[var(--restaurant-text-muted)]">{t("subtotal")} <span className="ml-1 text-lg font-bold tabular-nums text-[var(--restaurant-text)]">₹{cartTotal}</span></p>
              </div>
              {orderError && <p role="alert" className="mb-3 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{orderError}</p>}
              <button type="button" disabled={!canOrder || cart.length === 0 || submitting || cart.some((line) => !menu.dishes.some((dish) => dish.id === line.dishId && dish.isAvailable))} onClick={() => void placeOrder()} className="mb-1 inline-flex h-14 w-full items-center justify-between rounded-full bg-[var(--restaurant-primary)] px-6 text-sm font-bold text-white shadow-[0_12px_28px_-12px_var(--restaurant-primary)] transition hover:bg-[var(--restaurant-primary-dark)] disabled:cursor-not-allowed disabled:opacity-45">
                <span>{submitting ? t("placingOrder") : t("placeOrder")}</span>
                <span className="tabular-nums">₹{cartTotal}</span>
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}
