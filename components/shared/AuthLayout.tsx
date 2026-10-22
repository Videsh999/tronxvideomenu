"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import BrandMark from "@/components/shared/BrandMark";

type AuthLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  children: ReactNode;
};

export default function AuthLayout({ eyebrow, title, description, highlights, children }: AuthLayoutProps) {
  return (
    <main className="relative grid min-h-screen bg-background text-neutral-900 lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-neutral-200 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0 bg-grid" />
        <Link href="/" className="relative w-fit"><BrandMark subtitle="Digital video menus" /></Link>
        <div className="relative max-w-md">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">{eyebrow}</p>
          <h2 className="font-display mt-4 text-5xl font-semibold leading-[1.05] tracking-tight">
            Run a sharper <span className="text-brand-gradient italic">service.</span>
          </h2>
          <ul className="mt-8 space-y-3">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-neutral-600">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-neutral-900" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-neutral-400">© {new Date().getFullYear()} TRONX</p>
      </aside>

      <section className="relative flex flex-col px-5 py-6 sm:px-10">
        <div className="relative flex items-center justify-between">
          <Link href="/" className="lg:hidden"><BrandMark /></Link>
          <Link href="/" className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>
        </div>
        <div className="relative flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm animate-fade-up">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-400">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-neutral-500">{description}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </section>
    </main>
  );
}

export const authInputClass =
  "mt-2 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-neutral-100 focus:ring-4 focus:ring-neutral-900/10";

export function AuthField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-medium text-neutral-700">{label}{children}</label>;
}

export function PasswordInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="current-password"
        required
        className={`${authInputClass} pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-1.5 top-[calc(50%+4px)] grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-600">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}

export function AuthSubmit({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="bg-brand-gradient inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white shadow-[0_12px_32px_-12px_rgb(0_0_0/0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {busy ? busyLabel : label}
    </button>
  );
}

export function AuthFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-neutral-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="sr-only">Loading…</span>
    </main>
  );
}
