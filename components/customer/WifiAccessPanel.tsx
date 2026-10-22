"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Eye, EyeOff, Lock, Wifi, X } from "lucide-react";
import { useI18n } from "./I18nProvider";

type WifiDetails = { ssid: string; security: "WPA2" | "WPA3" | "OPEN"; password?: string };

export default function WifiAccessPanel({ slug, onClose }: { slug: string; onClose: () => void }) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const [details, setDetails] = useState<WifiDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus({ preventScroll: true });

    const getFocusableElements = () => Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => element.getAttribute("aria-hidden") !== "true");

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusableElements();
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (previousActiveElement?.isConnected) previousActiveElement.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetch(`/api/public/restaurants/${encodeURIComponent(slug)}/wifi`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { success: boolean; data?: WifiDetails; error?: string };
        if (!response.ok || !result.success || !result.data) throw new Error(result.error ?? "Wi-Fi information is unavailable.");
        if (active) setDetails(result.data);
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load Wi-Fi information."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  const copyPassword = async () => {
    if (!details?.password) return;
    try {
      await navigator.clipboard.writeText(details.password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copy is unavailable in this browser. You can reveal and select the password.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wifi-title"
      aria-describedby="wifi-description"
      className="fixed inset-0 z-[70] flex animate-fade-in items-end justify-center bg-black/55 p-0 backdrop-blur-md sm:items-center sm:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      {/* Always light sheet + dark text so Wi-Fi details stay readable on any restaurant theme */}
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="safe-bottom w-full max-w-md animate-sheet-up rounded-t-[2rem] bg-white px-5 pt-3 text-neutral-900 shadow-2xl outline-none sm:animate-scale-in sm:rounded-[2rem] sm:p-6"
      >
        <div className="mb-3 flex justify-center sm:hidden">
          <span className="h-1.5 w-12 rounded-full bg-neutral-200" />
        </div>
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--restaurant-primary)] text-white">
              <Wifi className="h-5 w-5" />
            </span>
            <div>
              <h2 id="wifi-title" className="font-serif text-2xl font-semibold leading-tight text-neutral-900">
                {t("wifiTitle")}
              </h2>
              <p id="wifi-description" className="mt-0.5 text-xs text-neutral-500">
                {t("wifiSubtitle")}
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t("closeWifi")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-800 transition hover:bg-neutral-200"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {loading ? (
          <div role="status" className="mt-6 space-y-3 pb-4">
            <span className="sr-only">Loading Wi-Fi details…</span>
            {[0, 1].map((key) => (
              <div key={key} className="h-[72px] animate-pulse rounded-2xl bg-neutral-100" />
            ))}
          </div>
        ) : error ? (
          <p role="alert" className="mb-4 mt-6 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>
        ) : details ? (
          <div className="mt-6 space-y-3 pb-4">
            <div className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{t("networkName")}</p>
                <p className="mt-1 break-all text-lg font-bold text-neutral-900">{details.ssid || "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{t("security")}</p>
                <p className="mt-1 inline-flex items-center justify-end gap-1 text-sm font-bold text-neutral-900">
                  {details.security !== "OPEN" ? <Lock className="h-3.5 w-3.5 text-neutral-700" /> : null}
                  {details.security === "OPEN" ? t("openNetwork") : details.security}
                </p>
              </div>
            </div>

            {details.password ? (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{t("password")}</p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    readOnly
                    aria-label={t("password")}
                    type={revealed ? "text" : "password"}
                    value={details.password}
                    className="h-12 min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 font-mono text-base font-semibold tracking-wide text-neutral-900 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setRevealed((value) => !value)}
                    aria-label={revealed ? t("hidePassword") : t("showPassword")}
                    aria-pressed={revealed}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-neutral-300 bg-white text-neutral-800 shadow-sm transition hover:bg-neutral-100"
                  >
                    {revealed ? <EyeOff className="h-5 w-5" strokeWidth={2.25} /> : <Eye className="h-5 w-5" strokeWidth={2.25} />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void copyPassword()}
                  aria-label={t("copyPassword")}
                  className={`mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-white transition ${
                    copied
                      ? "bg-emerald-600"
                      : "bg-[var(--restaurant-primary)] hover:bg-[var(--restaurant-primary-dark)]"
                  }`}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? t("copied") : t("copyPassword")}
                </button>
              </div>
            ) : details.security !== "OPEN" ? (
              <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{t("noWifiPassword")}</p>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
