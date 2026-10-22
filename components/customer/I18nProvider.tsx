"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LANGUAGE, LANGUAGES, getLanguage, isLanguageCode, type Language, type LanguageCode } from "@/lib/i18n/languages";
import { EN_MESSAGES, MESSAGE_OVERRIDES, formatMessage, type MessageKey, type Messages } from "@/lib/i18n/messages";
import { warmUpVoices } from "@/lib/speech";

export type TextSize = "base" | "large" | "xlarge";
const TEXT_SIZE_SCALE: Record<TextSize, string> = { base: "100%", large: "112.5%", xlarge: "125%" };
const LANG_STORAGE_KEY = "tronx:lang";
const TEXT_SIZE_STORAGE_KEY = "tronx:text-size";

type TranslationPayload = { ui: Partial<Messages>; content: Record<string, string>; complete: boolean };
type Status = "idle" | "loading" | "ready" | "error";

type I18nContextValue = {
  lang: LanguageCode;
  language: Language;
  setLang: (lang: LanguageCode) => void;
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
  status: Status;
  /** Interface text. */
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  /** Interface text with a singular form (`${key}One`) when count is 1. */
  tn: (key: MessageKey, count: number, vars?: Record<string, string | number>) => string;
  /** Menu content (dish names, descriptions, categories…) in the selected language. */
  tc: (source: string | undefined) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function detectLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (isLanguageCode(saved)) return saved;
  } catch { /* storage unavailable */ }
  const preferred = (navigator.languages ?? [navigator.language]).map((tag) => tag.toLowerCase().split("-")[0]);
  return (preferred.find((code) => isLanguageCode(code)) as LanguageCode | undefined) ?? DEFAULT_LANGUAGE;
}

export function I18nProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [textSize, setTextSizeState] = useState<TextSize>("base");
  const [payloads, setPayloads] = useState<Partial<Record<LanguageCode, TranslationPayload>>>({});
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLangState(detectLanguage());
      try {
        const savedSize = localStorage.getItem(TEXT_SIZE_STORAGE_KEY);
        if (savedSize === "large" || savedSize === "xlarge") setTextSizeState(savedSize);
      } catch { /* storage unavailable */ }
    }, 0);
    const stopWarmUp = warmUpVoices();
    return () => { window.clearTimeout(timer); stopWarmUp(); };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const previousLang = root.lang;
    root.lang = getLanguage(lang).speechTag;
    return () => { root.lang = previousLang; };
  }, [lang]);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.fontSize;
    root.style.fontSize = TEXT_SIZE_SCALE[textSize];
    return () => { root.style.fontSize = previous; };
  }, [textSize]);

  useEffect(() => {
    if (lang === "en") return;
    let active = true;
    const storageKey = `tronx:translations:${slug}:${lang}`;
    const kickoff = window.setTimeout(() => {
      if (!active) return;
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as TranslationPayload;
          setPayloads((current) => ({ ...current, [lang]: parsed }));
          if (parsed.complete) { setStatus("ready"); return; }
        }
      } catch { /* ignore corrupt cache */ }
      setStatus("loading");
      void fetch(`/api/public/restaurants/${encodeURIComponent(slug)}/translations?lang=${lang}`)
        .then(async (response) => {
          const result = await response.json() as { success: boolean; data?: TranslationPayload };
          if (!response.ok || !result.success || !result.data) throw new Error("Translation failed");
          if (!active) return;
          const data = result.data;
          setPayloads((current) => ({ ...current, [lang]: data }));
          setStatus("ready");
          try { sessionStorage.setItem(storageKey, JSON.stringify(data)); } catch { /* quota */ }
        })
        .catch(() => { if (active) setStatus("error"); });
    }, 0);
    return () => { active = false; window.clearTimeout(kickoff); };
  }, [lang, slug]);

  const setLang = useCallback((next: LanguageCode) => {
    setLangState(next);
    setStatus(next === "en" ? "idle" : "loading");
    try { localStorage.setItem(LANG_STORAGE_KEY, next); } catch { /* storage unavailable */ }
  }, []);

  const setTextSize = useCallback((size: TextSize) => {
    setTextSizeState(size);
    try { localStorage.setItem(TEXT_SIZE_STORAGE_KEY, size); } catch { /* storage unavailable */ }
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const payload = lang === "en" ? undefined : payloads[lang];
    const overrides = lang === "en" ? {} : MESSAGE_OVERRIDES[lang];
    const lookup = (key: MessageKey) => payload?.ui[key] ?? overrides[key] ?? EN_MESSAGES[key];
    const t: I18nContextValue["t"] = (key, vars) => formatMessage(lookup(key), vars);
    const tn: I18nContextValue["tn"] = (key, count, vars) => {
      const singularKey = `${key}One` as MessageKey;
      const useSingular = count === 1 && singularKey in EN_MESSAGES;
      return formatMessage(lookup(useSingular ? singularKey : key), { count, ...vars });
    };
    const tc: I18nContextValue["tc"] = (source) => {
      if (!source) return "";
      return payload?.content[source] ?? source;
    };
    return { lang, language: getLanguage(lang), setLang, textSize, setTextSize, status: lang === "en" ? "idle" : status, t, tn, tc };
  }, [lang, payloads, setLang, setTextSize, status, textSize]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}

export { LANGUAGES };
