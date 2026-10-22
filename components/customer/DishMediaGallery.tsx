"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, Sparkles } from "lucide-react";
import type { DishMediaItem } from "@/types";
import SmartImage from "@/components/shared/SmartImage";
import VideoPlayer from "./VideoPlayer";

type DishMediaGalleryProps = {
  media: DishMediaItem[];
  title: string;
};

export default function DishMediaGallery({ media, title }: DishMediaGalleryProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | null>(null);
  const [active, setActive] = useState(0);
  const count = media.length;

  useEffect(() => () => {
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
  }, []);

  const goTo = (index: number) => {
    const track = trackRef.current;
    if (!track || !count) return;
    const target = (index + count) % count;
    track.scrollTo({ left: target * track.clientWidth, behavior: "smooth" });
    setActive(target);
  };

  if (!count) {
    return (
      <div className="relative flex aspect-[16/9] w-full items-center justify-center bg-linear-to-br from-neutral-800 to-black">
        <div className="flex flex-col items-center gap-2 text-white/40">
          <Sparkles className="h-8 w-8 text-white/30" />
          <span className="text-xs uppercase tracking-wider text-white/50">TRONX Video Menu</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative bg-neutral-900"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") { event.preventDefault(); goTo(active + 1); }
        if (event.key === "ArrowLeft") { event.preventDefault(); goTo(active - 1); }
      }}
    >
      <div
        ref={trackRef}
        onScroll={(event) => {
          const track = event.currentTarget;
          if (settleTimer.current) window.clearTimeout(settleTimer.current);
          settleTimer.current = window.setTimeout(() => {
            const index = Math.min(count - 1, Math.max(0, Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
            setActive((current) => (current === index ? current : index));
          }, 90);
        }}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scrollbar-none"
        aria-roledescription="carousel"
        aria-label={title}
      >
        {media.map((item, index) => (
          <div
            key={item.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} / ${count}`}
            className="relative aspect-[4/3] w-full shrink-0 snap-center overflow-hidden bg-neutral-900"
          >
            {item.type === "IMAGE" ? (
              <SmartImage src={item.url} alt={title} priority={index === 0} sizes="(max-width: 640px) 100vw, 512px" className="object-cover" />
            ) : (
              <>
                {item.posterUrl ? <SmartImage src={item.posterUrl} alt="" priority={index === 0} sizes="(max-width: 640px) 100vw, 512px" className="object-cover opacity-60 blur-sm" /> : null}
                {index === active ? (
                  <VideoPlayer
                    key={`${item.id}-${active}`}
                    videoUrl={item.url}
                    posterUrl={item.posterUrl}
                    title={title}
                    autoPlay
                    muted
                    loop
                    controls
                    playbackPriority
                    className="absolute inset-0 bg-neutral-900/70"
                  />
                ) : (
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-white/90 text-neutral-900 shadow-xl"><Play className="h-6 w-6 fill-current" /></span>
                  </span>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {count > 1 ? (
        <>
          <button type="button" onClick={() => goTo(active - 1)} aria-label="Previous" className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-neutral-900 shadow-lg transition hover:bg-white sm:grid">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => goTo(active + 1)} aria-label="Next" className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-neutral-900 shadow-lg transition hover:bg-white sm:grid">
            <ChevronRight className="h-5 w-5" />
          </button>
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold tabular-nums text-white backdrop-blur-md">
            {active + 1} / {count}
          </span>
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {media.map((item, index) => (
              <span key={item.id} className={`h-1.5 rounded-full transition-all ${index === active ? "w-5 bg-white" : "w-1.5 bg-white/50"}`} />
            ))}
          </div>
        </>
      ) : null}

      {count > 1 ? (
        <div className="flex gap-2 overflow-x-auto bg-white px-4 pt-3 scrollbar-none sm:px-6">
          {media.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`${index + 1} / ${count}`}
              aria-current={index === active}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-neutral-200 transition ${index === active ? "ring-2 ring-[var(--restaurant-text)] ring-offset-2" : "opacity-70 hover:opacity-100"}`}
            >
              {(item.type === "IMAGE" ? item.url : item.posterUrl) ? (
                <SmartImage src={(item.type === "IMAGE" ? item.url : item.posterUrl) as string} alt="" sizes="56px" className="object-cover" />
              ) : null}
              {item.type === "VIDEO" ? (
                <span className="absolute inset-0 grid place-items-center bg-black/25 text-white"><Play className="h-4 w-4 fill-current" /></span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
