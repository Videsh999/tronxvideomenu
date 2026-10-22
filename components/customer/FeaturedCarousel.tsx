"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, Utensils } from "lucide-react";
import type { Dish } from "@/types";
import SmartImage from "@/components/shared/SmartImage";
import SpeakButton from "./SpeakButton";
import { useI18n } from "./I18nProvider";

type FeaturedCarouselProps = {
  title: string;
  dishes: Dish[];
  onSelect: (dish: Dish) => void;
  videoMenuEnabled?: boolean;
};

export default function FeaturedCarousel({ title, dishes, onSelect, videoMenuEnabled = true }: FeaturedCarouselProps) {
  const { t, tc } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState({ start: 0, size: 1 });

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => {
      const max = track.scrollWidth;
      setProgress({ start: max ? track.scrollLeft / max : 0, size: max ? track.clientWidth / max : 1 });
    };
    update();
    track.addEventListener("scroll", update, { passive: true });
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(track);
    if (track.firstElementChild) resizeObserver.observe(track.firstElementChild);
    return () => {
      track.removeEventListener("scroll", update);
      resizeObserver.disconnect();
    };
  }, [dishes.length]);

  const scrollByPage = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: "smooth" });
  };

  if (dishes.length === 0) return null;
  const atStart = progress.start <= 0.001;
  const atEnd = progress.start + progress.size >= 0.999;

  return (
    <section aria-labelledby="featured-heading" className="mx-auto max-w-7xl px-3 pt-8 sm:px-6 sm:pt-10 lg:px-8">
      <div className="mb-4 flex items-end justify-between gap-3 px-1">
        <h2 id="featured-heading" className="font-condensed text-3xl uppercase text-[var(--restaurant-text)] sm:text-4xl">{title}</h2>
        <div className="hidden gap-2 sm:flex">
          <button type="button" onClick={() => scrollByPage(-1)} disabled={atStart} aria-label={t("scrollLeft")} className="grid h-10 w-10 place-items-center rounded-full border border-[var(--customer-border)] text-[var(--restaurant-text)] transition hover:bg-[var(--customer-cream)] disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => scrollByPage(1)} disabled={atEnd} aria-label={t("scrollRight")} className="grid h-10 w-10 place-items-center rounded-full border border-[var(--customer-border)] text-[var(--restaurant-text)] transition hover:bg-[var(--customer-cream)] disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>

      <div ref={trackRef} className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-3 px-3 pb-2 scrollbar-none sm:mx-0 sm:scroll-px-0 sm:gap-4 sm:px-0">
        {dishes.map((dish, index) => {
          const name = tc(dish.name);
          return (
            <div key={dish.id} className="group relative aspect-[3/4] w-[44%] shrink-0 snap-start overflow-hidden rounded-[1.25rem] bg-neutral-200 sm:w-[30%] md:w-[23%] lg:w-[18.5%]">
              <button type="button" onClick={() => onSelect(dish)} aria-label={`${name}, ₹${dish.price}`} className="absolute inset-0 z-10" />
              {dish.imageUrl ? (
                <SmartImage src={dish.imageUrl} alt="" sizes="(max-width: 640px) 45vw, 240px" priority={index < 3} className="object-cover transition duration-700 group-hover:scale-105" />
              ) : (
                <span className="grid h-full w-full place-items-center text-neutral-400"><Utensils className="h-8 w-8" /></span>
              )}
              <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/10 to-transparent" />
              {videoMenuEnabled && dish.videoUrl ? (
                <span className="pointer-events-none absolute left-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-neutral-900 shadow"><Play className="h-3 w-3 fill-current" /></span>
              ) : null}
              <SpeakButton text={name} originalText={dish.name} tone="dark" className="absolute right-2.5 top-2.5 z-20 backdrop-blur-md" />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 p-3 text-center text-white sm:p-4">
                <span className="font-condensed block text-xl uppercase sm:text-2xl">{name}</span>
                <span className="mt-1 block text-sm font-semibold tabular-nums text-white/85">₹{dish.price}</span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="mx-auto mt-3 h-1 w-28 overflow-hidden rounded-full bg-neutral-200" aria-hidden="true">
        <div className="h-full rounded-full bg-[var(--restaurant-text)] transition-[margin] duration-200" style={{ width: `${Math.max(12, progress.size * 100)}%`, marginLeft: `${progress.start * 100}%` }} />
      </div>
    </section>
  );
}
