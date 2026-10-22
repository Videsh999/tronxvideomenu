"use client";

import { ArrowUpRight, Clock, Images, Play, Plus, Utensils } from "lucide-react";
import type { Dish } from "@/types";
import { getDishMedia } from "@/lib/dish-media";
import SmartImage from "@/components/shared/SmartImage";
import VideoPlayer from "./VideoPlayer";
import SpeakButton from "./SpeakButton";
import { useI18n } from "./I18nProvider";

type DishCardProps = {
  dish: Dish;
  onClick: (dish: Dish) => void;
  priority?: boolean;
  videoMenuEnabled?: boolean;
  canOrder?: boolean;
};

export function VegMark({ isVeg, className = "" }: { isVeg: boolean; className?: string }) {
  return (
    <span
      title={isVeg ? "Vegetarian" : "Non-Vegetarian"}
      className={`grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border-[1.5px] bg-white ${isVeg ? "border-emerald-600" : "border-rose-700"} ${className}`}
    >
      {isVeg ? (
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
      ) : (
        <span className="h-0 w-0 border-x-[5px] border-b-[8px] border-x-transparent border-b-rose-700" />
      )}
      <span className="sr-only">{isVeg ? "Vegetarian" : "Non-Vegetarian"}</span>
    </span>
  );
}

export default function DishCard({
  dish,
  onClick,
  priority = false,
  videoMenuEnabled = true,
  canOrder = false,
}: DishCardProps) {
  const { t, tc } = useI18n();
  const hasVideo = Boolean(videoMenuEnabled && dish.videoUrl);
  const customisable = Boolean(dish.addonGroups?.length);
  const extraMedia = Math.max(0, getDishMedia(dish, videoMenuEnabled).length - (hasVideo ? 2 : 1));
  const name = tc(dish.name);
  const description = tc(dish.description);

  return (
    <article
      className="customer-card group relative flex w-full flex-col text-left has-[button:active]:scale-[0.98]"
    >
      <button
        type="button"
        onClick={() => onClick(dish)}
        aria-label={`${t("viewDetails", { name })}, ₹${dish.price}`}
        className="absolute inset-0 z-10 rounded-[1.25rem]"
      />

      <div className="relative aspect-square w-full overflow-hidden rounded-[1.25rem] bg-neutral-100">
        {dish.imageUrl ? (
          <SmartImage
            src={dish.imageUrl}
            alt={name}
            priority={priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition duration-700 group-hover:scale-[1.06]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-neutral-100 to-neutral-200">
            <Utensils className="h-8 w-8 text-neutral-400" />
          </div>
        )}

        {hasVideo && dish.videoUrl && (
          <VideoPlayer
            videoUrl={dish.videoUrl}
            posterUrl={dish.videoPosterUrl || dish.imageUrl}
            title={name}
            autoPlay
            muted
            loop
            controls={false}
            className="absolute inset-0 [&_video]:object-cover"
          />
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/35 to-transparent" />

        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2 sm:inset-x-3 sm:top-3">
          <VegMark isVeg={dish.isVeg} className="shadow-sm" />
          {hasVideo ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
              <Play className="h-2.5 w-2.5 fill-current" /><span className="hidden sm:inline">{t("video")}</span>
            </span>
          ) : null}
        </div>

        {extraMedia > 0 ? (
          <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md sm:bottom-3 sm:right-3 sm:text-[11px]">
            <Images className="h-3 w-3" /> +{extraMedia}
          </span>
        ) : null}

        {dish.preparationTime ? (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-neutral-800 backdrop-blur sm:bottom-3 sm:left-3 sm:text-[11px]">
            <Clock className="h-3 w-3" /> {t("minutes", { count: dish.preparationTime })}
          </span>
        ) : null}

        {!dish.isAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[2px]">
            <span className="rounded-full bg-neutral-900 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white">
              {t("soldOut")}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
        <div className="flex items-start gap-1.5">
          <h3 className="font-condensed min-w-0 flex-1 text-xl uppercase leading-none text-[var(--restaurant-text)] transition-colors group-hover:text-[var(--restaurant-primary)] sm:text-2xl">
            {name}
          </h3>
          <SpeakButton text={name} originalText={dish.name} className="relative z-20 -mt-0.5" />
        </div>
        {description && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-neutral-500 sm:text-[13px]">
            {description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <div className="min-w-0">
            <span className="block text-base font-bold tabular-nums text-[var(--restaurant-text)] sm:text-lg">₹{dish.price}</span>
            {customisable ? <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{t("customisable")}</span> : null}
          </div>
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--restaurant-text)] text-white shadow-[0_8px_18px_-8px_rgba(0,0,0,0.6)] transition group-hover:bg-[var(--restaurant-primary)] sm:h-10 sm:w-10"
          >
            {canOrder && dish.isAvailable ? <Plus className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
          </span>
        </div>
      </div>
    </article>
  );
}
