"use client";

// Tiny external store for PWA install state. `beforeinstallprompt` can fire before any
// install button mounts, so PwaRegister (in the root layout) captures it here.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallSnapshot = {
  /** Chrome/Edge/Android: native install prompt available. */
  canPrompt: boolean;
  /** Already running as an installed app. */
  installed: boolean;
};

const SERVER_SNAPSHOT: InstallSnapshot = { canPrompt: false, installed: false };

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
let snapshot: InstallSnapshot = SERVER_SNAPSHOT;
let started = false;
const listeners = new Set<() => void>();

function isStandalone() {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function publish() {
  const next = { canPrompt: Boolean(deferred), installed };
  if (next.canPrompt !== snapshot.canPrompt || next.installed !== snapshot.installed) {
    snapshot = next;
    listeners.forEach((fn) => fn());
  }
}

export function startInstallListeners() {
  if (started || typeof window === "undefined") return;
  started = true;
  installed = isStandalone();
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    publish();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    publish();
  });
  window.matchMedia("(display-mode: standalone)").addEventListener("change", () => {
    installed = isStandalone();
    publish();
  });
  publish();
}

export function subscribeInstall(listener: () => void) {
  startInstallListeners();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getInstallSnapshot = () => snapshot;
export const getInstallServerSnapshot = () => SERVER_SNAPSHOT;

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  const event = deferred;
  deferred = null; // a prompt event can only be used once
  publish();
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  } catch {
    return "dismissed";
  }
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as Macintosh; detect via touch points.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

// --- "Not now" memory (banner variant) ---------------------------------------
const DISMISS_KEY = "tronx:pwa-install-dismissed-at";
const DISMISS_DAYS = 30;
const dismissListeners = new Set<() => void>();

function readDismissed() {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY));
    return Boolean(at) && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export function dismissInstallBanner() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* storage blocked: dismissal just won't persist */
  }
  dismissListeners.forEach((fn) => fn());
}

export function subscribeDismissed(listener: () => void) {
  dismissListeners.add(listener);
  return () => dismissListeners.delete(listener);
}

export const getDismissedSnapshot = () => readDismissed();
export const getDismissedServerSnapshot = () => true; // hidden until hydrated: no flash, no mismatch

export const subscribeNothing = () => () => {};
export const getIosSnapshot = () => isIosDevice();
export const getIosServerSnapshot = () => false;
