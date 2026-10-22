"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Globe, Loader2 } from "lucide-react";
import { LANGUAGES } from "@/lib/i18n/languages";
import { useI18n, type TextSize } from "./I18nProvider";

const sizes: { value: TextSize; label: string; className: string }[] = [
  { value: "base", label: "A", className: "text-sm" },
  { value: "large", label: "A", className: "text-base" },
  { value: "xlarge", label: "A", className: "text-xl" },
];

export default function LanguageMenu() {
  const { lang, language, setLang, textSize, setTextSize, status, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${t("languageAndText")}. ${t("language")}: ${language.nativeName}`}
        className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[var(--customer-border)] px-3 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
      >
        {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
        <span className="text-xs font-bold uppercase">{lang}</span>
      </button>

      {open && (
        <div role="dialog" aria-label={t("languageAndText")} className="fixed inset-x-3 top-16 z-50 animate-scale-in sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+0.5rem)] sm:w-[21rem] rounded-3xl border border-[var(--customer-border)] bg-white p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">{t("textSize")}</p>
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-neutral-100 p-1">
            {sizes.map((size) => (
              <button
                key={size.value}
                type="button"
                aria-pressed={textSize === size.value}
                aria-label={`${t("textSize")} ${size.value}`}
                onClick={() => setTextSize(size.value)}
                className={`h-10 rounded-xl font-bold transition ${size.className} ${textSize === size.value ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
              >
                {size.label}
              </button>
            ))}
          </div>

          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">{t("language")}</p>
          <ul className="mt-2 grid max-h-[50vh] grid-cols-2 gap-1.5 overflow-y-auto overscroll-contain">
            {LANGUAGES.map((option) => {
              const active = option.code === lang;
              return (
                <li key={option.code}>
                  <button
                    type="button"
                    lang={option.speechTag}
                    aria-pressed={active}
                    onClick={() => { setLang(option.code); setOpen(false); }}
                    className={`flex w-full items-center gap-2.5 rounded-2xl border px-2.5 py-2 text-left transition ${active ? "border-[var(--restaurant-text)] bg-neutral-50" : "border-transparent hover:bg-neutral-50"}`}
                  >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm font-bold ${active ? "bg-[var(--restaurant-text)] text-white" : "bg-neutral-100 text-neutral-700"}`}>{option.glyph}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-neutral-900">{option.nativeName}</span>
                      <span className="block truncate text-[11px] text-neutral-500">{option.englishName}</span>
                    </span>
                    {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
