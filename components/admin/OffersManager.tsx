"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Dish, MenuOffer, OfferThemePreset } from "@/types";
import { isMenuOfferLive } from "@/lib/offers/menu-offer";
import { Gift, Loader2, Percent, Sparkles } from "lucide-react";

type Props = { restaurantName: string; restaurantId: string };

const THEMES: { value: OfferThemePreset; label: string }[] = [
  { value: "NONE", label: "No festive theme" },
  { value: "CHRISTMAS", label: "Christmas" },
  { value: "NEW_YEAR", label: "New Year" },
  { value: "SANKRANTI", label: "Sankranti" },
  { value: "DIWALI", label: "Diwali" },
];

function statusLabel(offer: MenuOffer) {
  if (isMenuOfferLive(offer)) return { text: "Running", className: "bg-emerald-50 text-emerald-800" };
  if (offer.isActive) return { text: "Scheduled", className: "bg-amber-50 text-amber-800" };
  return { text: "Off", className: "bg-neutral-100 text-neutral-600" };
}

/** Convert ISO timestamp to `datetime-local` value in the browser's local zone. */
function toDatetimeLocal(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function OffersManager({ restaurantName, restaurantId }: Props) {
  const [offers, setOffers] = useState<MenuOffer[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [percentOff, setPercentOff] = useState(50);
  const [scope, setScope] = useState<"ALL_MENU" | "SELECTED_DISHES">("ALL_MENU");
  const [selectedDishIds, setSelectedDishIds] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [themePreset, setThemePreset] = useState<OfferThemePreset>("CHRISTMAS");
  const [bannerHeadline, setBannerHeadline] = useState("");
  const [bannerSubtext, setBannerSubtext] = useState("");
  const [badgeText, setBadgeText] = useState("");
  const [applyTheme, setApplyTheme] = useState(true);
  const [dishQuery, setDishQuery] = useState("");

  const filteredDishes = useMemo(() => {
    const q = dishQuery.trim().toLowerCase();
    if (!q) return dishes;
    return dishes.filter((dish) => dish.name.toLowerCase().includes(q));
  }, [dishes, dishQuery]);

  const editingOffer = editingId ? offers.find((offer) => offer.id === editingId) : null;

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [offerRes, dishRes] = await Promise.all([
        fetch("/api/offers"),
        fetch(`/api/dishes?restaurantId=${encodeURIComponent(restaurantId)}`),
      ]);
      const [offerJson, dishJson] = await Promise.all([offerRes.json(), dishRes.json()]);
      if (!offerRes.ok || !offerJson.success) {
        setError(offerJson.error || "Could not load offers.");
        setOffers([]);
      } else {
        setOffers(offerJson.data);
      }
      if (dishJson.success) setDishes(dishJson.data);
    } catch {
      setError("Could not load offers. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [restaurantId]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setPercentOff(50);
    setScope("ALL_MENU");
    setSelectedDishIds([]);
    setStartsAt("");
    setEndsAt("");
    setIsActive(true);
    setThemePreset("CHRISTMAS");
    setBannerHeadline("");
    setBannerSubtext("");
    setBadgeText("");
    setApplyTheme(true);
  }

  function loadOfferIntoForm(offer: MenuOffer) {
    setEditingId(offer.id);
    setName(offer.name);
    setDescription(offer.description ?? "");
    setPercentOff(offer.percentOff);
    setScope(offer.scope);
    setSelectedDishIds(offer.dishIds ?? []);
    setStartsAt(toDatetimeLocal(offer.startsAt));
    setEndsAt(toDatetimeLocal(offer.endsAt));
    setIsActive(offer.isActive);
    setThemePreset(offer.presentation.themePreset);
    setBannerHeadline(offer.presentation.bannerHeadline ?? "");
    setBannerSubtext(offer.presentation.bannerSubtext ?? "");
    setBadgeText(offer.presentation.badgeText ?? "");
    setApplyTheme(offer.presentation.applyTheme);
    setMessage(null);
    setError(null);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function buildPayload() {
    return {
      name,
      description: description || undefined,
      percentOff,
      scope,
      dishIds: scope === "SELECTED_DISHES" ? selectedDishIds : undefined,
      startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
      endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      isActive,
      presentation: {
        themePreset,
        bannerHeadline: bannerHeadline || undefined,
        bannerSubtext: bannerSubtext || undefined,
        badgeText: badgeText || undefined,
        applyTheme,
      },
    };
  }

  async function submitOffer(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    const payload = buildPayload();
    const response = await fetch(editingId ? `/api/offers/${editingId}` : "/api/offers", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    setSaving(false);
    if (!json.success) {
      setError(json.error || (editingId ? "Could not update offer." : "Could not create offer."));
      return;
    }
    if (editingId) {
      setMessage(`“${json.data.name}” updated.`);
    } else {
      setMessage(
        isActive
          ? `“${json.data.name}” is running on the guest menu.`
          : `“${json.data.name}” saved as draft.`,
      );
    }
    resetForm();
    await refresh();
  }

  async function setRunning(offer: MenuOffer, next: boolean) {
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/offers/${offer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    const json = await response.json();
    if (!json.success) {
      setError(json.error || "Could not update offer.");
      return;
    }
    setMessage(next ? `“${offer.name}” is now live.` : `“${offer.name}” stopped.`);
    if (editingId === offer.id) setIsActive(next);
    await refresh();
  }

  async function removeOffer(offer: MenuOffer) {
    if (!window.confirm(`Delete “${offer.name}”?`)) return;
    const response = await fetch(`/api/offers/${offer.id}`, { method: "DELETE" });
    const json = await response.json();
    if (!json.success) {
      setError(json.error || "Could not delete offer.");
      return;
    }
    setMessage(`Deleted “${offer.name}”.`);
    if (editingId === offer.id) resetForm();
    await refresh();
  }

  function toggleDish(id: string) {
    setSelectedDishIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">{restaurantName}</p>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          <Gift className="h-7 w-7 text-rose-600" />
          Offers & Discounts
        </h1>
        <p className="max-w-2xl text-sm text-neutral-600">
          Festival and seasonal % off — entire menu or selected dishes (e.g. Diwali 10% off everything).
          Turning an offer on updates guest prices and can switch the banner to a festive theme.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <form
        onSubmit={submitOffer}
        className="space-y-5 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Sparkles className="h-4 w-4 text-amber-500" />
            {editingId ? `Edit offer${editingOffer ? ` — ${editingOffer.name}` : ""}` : "Create offer"}
          </div>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-semibold text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
            >
              Cancel edit
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Christmas special"
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-400"
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Description</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Festive feast — 50% off"
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-400"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Percent off</span>
            <div className="relative">
              <Percent className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="number"
                min={1}
                max={100}
                required
                value={percentOff}
                onChange={(e) => setPercentOff(Number(e.target.value))}
                className="h-11 w-full rounded-xl border border-neutral-200 pl-9 pr-3 text-sm outline-none focus:border-neutral-400"
              />
            </div>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Apply to</span>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as "ALL_MENU" | "SELECTED_DISHES")}
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-400"
            >
              <option value="ALL_MENU">Entire menu</option>
              <option value="SELECTED_DISHES">Selected dishes only</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Starts</span>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-400"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Ends</span>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-400"
            />
          </label>
        </div>

        {scope === "SELECTED_DISHES" ? (
          <div className="space-y-3 rounded-2xl border border-neutral-100 bg-neutral-50/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-neutral-800">
                Dishes ({selectedDishIds.length} selected)
              </p>
              <input
                value={dishQuery}
                onChange={(e) => setDishQuery(e.target.value)}
                placeholder="Search dishes"
                className="h-9 w-full max-w-xs rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none sm:w-56"
              />
            </div>
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {filteredDishes.map((dish) => (
                <li key={dish.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-white">
                    <input
                      type="checkbox"
                      checked={selectedDishIds.includes(dish.id)}
                      onChange={() => toggleDish(dish.id)}
                      className="rounded border-neutral-300"
                    />
                    <span className="min-w-0 flex-1 truncate">{dish.name}</span>
                    <span className="tabular-nums text-neutral-500">₹{dish.price}</span>
                  </label>
                </li>
              ))}
              {filteredDishes.length === 0 ? (
                <li className="px-2 py-3 text-sm text-neutral-500">No dishes match.</li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-4 rounded-2xl border border-rose-100 bg-rose-50/40 p-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Banner theme</span>
            <select
              value={themePreset}
              onChange={(e) => setThemePreset(e.target.value as OfferThemePreset)}
              className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
            >
              {THEMES.map((theme) => (
                <option key={theme.value} value={theme.value}>
                  {theme.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 pt-6 text-sm font-medium text-neutral-800">
            <input
              type="checkbox"
              checked={applyTheme}
              onChange={(e) => setApplyTheme(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Apply festive colours on guest menu
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Banner headline</span>
            <input
              value={bannerHeadline}
              onChange={(e) => setBannerHeadline(e.target.value)}
              placeholder="Merry Christmas — 50% off"
              className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Banner subtext</span>
            <input
              value={bannerSubtext}
              onChange={(e) => setBannerSubtext(e.target.value)}
              placeholder="Celebrate with us — offer on selected favourites"
              className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Dish badge</span>
            <input
              value={badgeText}
              onChange={(e) => setBadgeText(e.target.value)}
              placeholder="50% OFF"
              className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
            />
          </label>
          <label className="flex items-center gap-3 pt-6 text-sm font-medium text-neutral-800">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-neutral-300"
            />
            {editingId ? "Offer is running / scheduled" : "Start running immediately"}
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            {editingId
              ? "Save changes"
              : isActive
                ? "Create & run offer"
                : "Save draft offer"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 px-5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Your offers</h2>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : offers.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
            No offers yet. Create a Christmas or Sankranti campaign above.
          </p>
        ) : (
          <ul className="space-y-3">
            {offers.map((offer) => {
              const status = statusLabel(offer);
              const isEditing = editingId === offer.id;
              return (
                <li
                  key={offer.id}
                  className={`flex flex-col gap-3 rounded-2xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between ${
                    isEditing ? "border-neutral-900" : "border-neutral-200"
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-neutral-900">{offer.name}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${status.className}`}>
                        {status.text}
                      </span>
                      {isEditing ? (
                        <span className="rounded-full bg-neutral-900 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                          Editing
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-neutral-600">
                      {offer.percentOff}% off ·{" "}
                      {offer.scope === "ALL_MENU"
                        ? "Entire menu"
                        : `${offer.dishIds.length} dish${offer.dishIds.length === 1 ? "" : "es"}`}
                      {offer.presentation.themePreset !== "NONE"
                        ? ` · ${offer.presentation.themePreset.replace("_", " ").toLowerCase()} theme`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => loadOfferIntoForm(offer)}
                      className="h-9 rounded-lg border border-neutral-900 px-3 text-xs font-semibold text-neutral-900 hover:bg-neutral-900 hover:text-white"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void setRunning(offer, !offer.isActive)}
                      className="h-9 rounded-lg border border-neutral-200 px-3 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                    >
                      {offer.isActive ? "Stop" : "Run"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeOffer(offer)}
                      className="h-9 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
