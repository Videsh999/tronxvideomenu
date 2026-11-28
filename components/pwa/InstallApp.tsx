"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, PlusSquare, Share, X } from "lucide-react";
import {
  dismissInstallBanner,
  getDismissedServerSnapshot,
  getDismissedSnapshot,
  getInstallServerSnapshot,
  getInstallSnapshot,
  getIosServerSnapshot,
  getIosSnapshot,
  promptInstall,
  subscribeDismissed,
  subscribeInstall,
  subscribeNothing,
} from "@/lib/pwa/install-store";

type Props = {
  /** `banner`: dismissible card (guest menu). `button`: compact always-available row (admin/super admin). */
  variant?: "banner" | "button";
  /** App name shown in copy, e.g. restaurant name or "TRONX". */
  appName?: string;
  className?: string;
};

function IosSteps() {
  return (
    <ol className="mt-3 space-y-2 text-sm text-neutral-700">
      <li className="flex items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs font-bold">1</span>
        <span>Tap <Share className="mx-0.5 inline h-4 w-4 align-[-3px]" aria-label="Share" /> <strong>Share</strong> in Safari&rsquo;s toolbar</span>
      </li>
      <li className="flex items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs font-bold">2</span>
        <span>Choose <PlusSquare className="mx-0.5 inline h-4 w-4 align-[-3px]" aria-hidden="true" /> <strong>Add to Home Screen</strong></span>
      </li>
      <li className="flex items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs font-bold">3</span>
        <span>Tap <strong>Add</strong> &mdash; open it from your home screen</span>
      </li>
    </ol>
  );
}

export default function InstallApp({ variant = "banner", appName = "TRONX", className = "" }: Props) {
  const install = useSyncExternalStore(subscribeInstall, getInstallSnapshot, getInstallServerSnapshot);
  const ios = useSyncExternalStore(subscribeNothing, getIosSnapshot, getIosServerSnapshot);
  const dismissed = useSyncExternalStore(subscribeDismissed, getDismissedSnapshot, getDismissedServerSnapshot);
  const [showIos, setShowIos] = useState(false);

  const available = !install.installed && (install.canPrompt || ios);
  if (!available) return null;
  if (variant === "banner" && dismissed) return null;

  async function onInstall() {
    if (install.canPrompt) {
      const outcome = await promptInstall();
      if (outcome === "accepted" && variant === "banner") dismissInstallBanner();
      return;
    }
    setShowIos((v) => !v);
  }

  if (variant === "button") {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={onInstall}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
        >
          <span className="flex items-center gap-3"><Download className="h-4 w-4" /> Install app</span>
        </button>
        {showIos ? (
          <div className="mx-1 mt-1 rounded-xl border border-neutral-200 bg-white p-3">
            <p className="text-xs font-semibold text-neutral-900">Add {appName} to your Home Screen</p>
            <IosSteps />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section
      aria-label={`Install ${appName}`}
      className={`relative rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm ${className}`}
    >
      <button
        type="button"
        onClick={dismissInstallBanner}
        aria-label="Dismiss install suggestion"
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-neutral-900">Install {appName}</p>
          <p className="mt-0.5 text-xs text-neutral-500">Open the menu in one tap from your home screen, full screen like an app.</p>
        </div>
      </div>
      {showIos ? <IosSteps /> : null}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onInstall}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-neutral-900 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800"
        >
          <Download className="h-3.5 w-3.5" />
          {install.canPrompt ? "Install app" : showIos ? "Hide steps" : "How to install"}
        </button>
        <button
          type="button"
          onClick={dismissInstallBanner}
          className="inline-flex h-10 items-center rounded-full px-3 text-xs font-semibold text-neutral-500 hover:text-neutral-900"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
