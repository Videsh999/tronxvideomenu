"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Armchair, ChevronDown, Clock, MapPin, Phone } from "lucide-react";
import type { Restaurant } from "@/types";
import SmartImage from "@/components/shared/SmartImage";
import { useI18n } from "./I18nProvider";

type RestaurantHeroProps = {
  restaurant: Restaurant;
  tableNumber?: number | null;
  extraActions?: ReactNode;
};

export const heroPill = "inline-flex h-9 items-center gap-1.5 rounded-full border border-white/25 bg-black/30 px-3.5 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-black/45";

export function directionsUrl(restaurant: Restaurant) {
  return restaurant.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurant.name} ${restaurant.address}`)}`
    : null;
}

export default function RestaurantHero({ restaurant, tableNumber, extraActions }: RestaurantHeroProps) {
  const { t, tc } = useI18n();
  const [hoursOpen, setHoursOpen] = useState(false);
  const hoursRef = useRef<HTMLDivElement>(null);
  const directions = directionsUrl(restaurant);

  useEffect(() => {
    if (!hoursOpen) return;
    const close = (event: PointerEvent) => {
      if (hoursRef.current && !hoursRef.current.contains(event.target as Node)) setHoursOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [hoursOpen]);

  return (
    <section aria-label={restaurant.name} className="mx-auto max-w-7xl px-3 pt-3 sm:px-6 sm:pt-5 lg:px-8">
      <div className="relative isolate rounded-[1.75rem] bg-neutral-900 text-white shadow-[0_24px_60px_-30px_rgba(0,0,0,0.55)]">
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-[1.75rem]">
          {restaurant.coverUrl ? (
            <SmartImage src={restaurant.coverUrl} alt="" sizes="(max-width: 1280px) 100vw, 1280px" priority className="object-cover" />
          ) : (
            <div className="absolute inset-0 bg-linear-to-br from-[var(--restaurant-primary)] via-[var(--restaurant-secondary)] to-black" />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/35 to-black/10" />
        </div>

        <div className="flex min-h-[15rem] flex-col justify-end p-5 sm:min-h-[20rem] sm:p-8 lg:min-h-[23rem] lg:p-10">
          <div className="flex animate-fade-up items-end gap-4">
            <div className="relative hidden h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-white/80 bg-white shadow-xl sm:block lg:h-24 lg:w-24">
              {restaurant.logoUrl ? (
                <SmartImage src={restaurant.logoUrl} alt={`${restaurant.name} logo`} sizes="96px" className="object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-3xl font-bold text-[var(--restaurant-primary)]">{restaurant.name.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 translate="no" className="font-condensed text-5xl uppercase sm:text-6xl lg:text-7xl">{restaurant.name}</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/80 sm:text-base">
                {tc(restaurant.tagline?.trim() || restaurant.description?.trim()) || t("digitalMenu")}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <div ref={hoursRef} className="relative">
              <button
                type="button"
                onClick={() => setHoursOpen((open) => !open)}
                disabled={!restaurant.openingHours}
                aria-expanded={hoursOpen}
                className={`${heroPill} disabled:cursor-default disabled:hover:bg-black/30`}
              >
                <span className={`h-2 w-2 rounded-full ${restaurant.isOpen ? "bg-emerald-400" : "bg-rose-400"}`} />
                {restaurant.isOpen ? t("openNow") : t("closed")}
                {restaurant.openingHours ? <ChevronDown className={`h-3.5 w-3.5 transition-transform ${hoursOpen ? "rotate-180" : ""}`} /> : null}
              </button>
              {hoursOpen && restaurant.openingHours ? (
                <div role="dialog" aria-label={t("openingHours")} className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-64 animate-scale-in rounded-2xl bg-white p-4 text-neutral-900 shadow-2xl">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">{t("openingHours")}</p>
                  <p className="mt-2 flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4 text-neutral-500" />{restaurant.openingHours}</p>
                  <p className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${restaurant.isOpen ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${restaurant.isOpen ? "bg-emerald-500" : "bg-rose-500"}`} />
                    {restaurant.isOpen ? t("openNow") : t("closed")}
                  </p>
                </div>
              ) : null}
            </div>
            {tableNumber ? <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-xs font-bold text-neutral-900"><Armchair className="h-3.5 w-3.5" />{t("table", { number: tableNumber })}</span> : null}
            {restaurant.phone ? <a href={`tel:${restaurant.phone.replace(/\s+/g, "")}`} className={heroPill}><Phone className="h-3.5 w-3.5" />{t("call")}</a> : null}
            {directions ? <a href={directions} target="_blank" rel="noopener noreferrer" className={heroPill}><MapPin className="h-3.5 w-3.5" />{t("directions")}</a> : null}
            {extraActions}
          </div>
        </div>
      </div>
    </section>
  );
}
