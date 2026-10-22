"use client";

import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { isSpeechSupported, speak } from "@/lib/speech";
import { useI18n } from "./I18nProvider";

type SpeakButtonProps = {
  /** Text in the selected language. */
  text: string;
  /** Original (English) text, used if the device has no voice for the selected language. */
  originalText?: string;
  size?: "sm" | "md";
  tone?: "light" | "dark";
  className?: string;
};

export default function SpeakButton({ text, originalText, size = "sm", tone = "light", className = "" }: SpeakButtonProps) {
  const { t, language } = useI18n();
  const [supported, setSupported] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSupported(isSpeechSupported()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!supported) return null;

  const dimensions = size === "md" ? "h-10 w-10" : "h-7 w-7";
  const icon = size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  const palette = tone === "dark"
    ? "bg-white/15 text-white hover:bg-white/25"
    : speaking
      ? "bg-[var(--restaurant-text)] text-white"
      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-900";

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        speak({
          text,
          lang: language.speechTag,
          fallbackText: originalText,
          onStart: () => setSpeaking(true),
          onEnd: () => setSpeaking(false),
        });
        setSpeaking(true);
        window.setTimeout(() => setSpeaking(false), 6000);
      }}
      aria-label={t("hearName", { name: text })}
      title={t("hearName", { name: text })}
      className={`${/\b(absolute|fixed)\b/.test(className) ? "" : "relative"} inline-grid shrink-0 place-items-center rounded-full transition ${dimensions} ${palette} ${className}`}
    >
      {speaking ? <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-20" /> : null}
      <Volume2 className={`${icon} ${speaking ? "animate-pulse" : ""}`} />
    </button>
  );
}
