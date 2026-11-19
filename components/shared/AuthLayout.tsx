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
    <main className="grid min-h-dvh bg-neutral-50 text-neutral-900 lg:grid-cols-[1.05fr_1fr] lg:bg-background">
      <aside className="relative hidden overflow-hidden border-r border-neutral-200 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0 bg-grid" />
        <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-neutral-900/[0.04] blur-3xl" />
        <Link href="/" className="relative w-fit">
          <BrandMark subtitle="Digital video menus" />
        </Link>
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

      <section className="flex min-h-dvh flex-col px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-10 lg:justify-center">
        <div className="mx-auto flex w-full max-w-md items-center justify-between">
          <Link href="/" aria-label="TRONX home">
            <BrandMark />
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>
        <div className="mx-auto mt-8 w-full max-w-md">
          <p className="text-sm font-semibold text-neutral-500">{eyebrow}</p>
          <h1 className="mt-1 text-3xl font-black leading-tight">{title}</h1>
          <p className="mt-2 text-base text-neutral-600">{description}</p>
          <p className="mt-3 text-sm leading-snug text-neutral-500 lg:hidden">{highlights[0]}</p>
          <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">{children}</div>
        </div>
      </section>
    </main>
  );
}

export const authInputClass =
  "mt-2 h-14 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-base text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white";

export function AuthField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-medium text-neutral-700">{label}{children}</label>;
}

type PasswordInputProps = {
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
};

const authPasswordInputClass =
  "h-14 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 pr-12 text-base text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white";

export function PasswordInput({
  value,
  onChange,
  autoComplete = "current-password",
  required = true,
  minLength,
  maxLength,
  placeholder,
  className,
  id,
  name,
  "aria-label": ariaLabel,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={className ? "relative" : "relative mt-2"}>
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={className ?? authPasswordInputClass}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
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
      className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 text-base font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {busy ? busyLabel : label}
    </button>
  );
}

export function AuthFallback() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background text-neutral-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="sr-only">Loading…</span>
    </main>
  );
}
