"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Eye, EyeOff } from "lucide-react";
import type { CaptainView, RestaurantTable } from "@/types";
import { PasswordInput } from "@/components/shared/AuthLayout";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const result = (await response.json()) as { success: boolean; data?: T; error?: string };
  if (!response.ok || !result.success) throw new Error(result.error ?? "Request failed");
  return result.data as T;
}

export default function CaptainManagement({
  restaurantSlug,
  tables = [],
}: {
  restaurantSlug: string;
  tables?: RestaurantTable[];
}) {
  const [captains, setCaptains] = useState<CaptainView[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [savedPasswords, setSavedPasswords] = useState<Record<string, string>>({});
  const [resetTarget, setResetTarget] = useState<CaptainView | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetVisible, setResetVisible] = useState(false);
  const [assignDraft, setAssignDraft] = useState<Record<string, string[]>>({});
  const activeTables = tables.filter((table) => table.isActive);

  const refresh = async () => {
    const data = await request<CaptainView[]>("/api/admin/captains");
    setCaptains(data);
    setAssignDraft(
      Object.fromEntries(data.map((captain) => [captain.id, [...(captain.assignedTableIds ?? [])]])),
    );
  };

  useEffect(() => {
    let mounted = true;
    request<CaptainView[]>("/api/admin/captains")
      .then((data) => {
        if (!mounted) return;
        setCaptains(data);
        setAssignDraft(
          Object.fromEntries(data.map((captain) => [captain.id, [...(captain.assignedTableIds ?? [])]])),
        );
      })
      .catch((error: unknown) => {
        if (mounted) setMessage(error instanceof Error ? error.message : "Unable to load Captains");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const saveTableAssignment = async (captain: CaptainView) => {
    setPendingId(captain.id);
    setMessage("");
    try {
      await request(`/api/admin/captains/${encodeURIComponent(captain.id)}/tables`, {
        method: "PUT",
        body: JSON.stringify({ tableIds: assignDraft[captain.id] ?? [] }),
      });
      await refresh();
      setMessage(`Tables updated for ${captain.name}. Conflicts moved off other captains.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to assign tables");
    } finally {
      setPendingId(null);
    }
  };

  const toggleTableDraft = (captainId: string, tableId: string) => {
    setAssignDraft((current) => {
      const selected = new Set(current[captainId] ?? []);
      if (selected.has(tableId)) selected.delete(tableId);
      else selected.add(tableId);
      return { ...current, [captainId]: [...selected] };
    });
  };

  const assignedElsewhere = (tableId: string, exceptCaptainId: string) =>
    captains.find(
      (captain) =>
        captain.id !== exceptCaptainId && (captain.assignedTableIds ?? []).includes(tableId),
    );

  const copy = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(successMessage);
    } catch {
      setMessage("Clipboard access failed. Copy the value manually.");
    }
  };

  const getLoginPath = () => `/menu/${encodeURIComponent(restaurantSlug)}/captain`;

  const getPassword = async (captainId: string) => {
    const result = await request<{ password: string }>(
      `/api/admin/captains/${encodeURIComponent(captainId)}/credentials`,
      { method: "POST" },
    );
    return result.password;
  };

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await request<CaptainView>("/api/admin/captains", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      setName("");
      setEmail("");
      setPassword("");
      await refresh();
      setMessage("Captain created. Share the Captain login portal link below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create Captain");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (captain: CaptainView) => {
    setPendingId(captain.id);
    setMessage("");
    try {
      await request(`/api/admin/captains/${encodeURIComponent(captain.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !captain.isActive }),
      });
      await refresh();
      setMessage(`Captain ${captain.isActive ? "disabled" : "enabled"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update Captain");
    } finally {
      setPendingId(null);
    }
  };

  const saveResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetTarget) return;
    if (resetPassword.length < 8) {
      setMessage("Password must contain at least 8 characters.");
      return;
    }
    setPendingId(resetTarget.id);
    setMessage("");
    try {
      await request(`/api/admin/captains/${encodeURIComponent(resetTarget.id)}/password`, {
        method: "POST",
        body: JSON.stringify({ password: resetPassword }),
      });
      await refresh();
      setSavedPasswords((current) => ({ ...current, [resetTarget.id]: resetPassword }));
      setVisibleIds((current) =>
        current.includes(resetTarget.id) ? current : [...current, resetTarget.id],
      );
      setMessage("Captain password updated and saved for authorized retrieval.");
      setResetTarget(null);
      setResetPassword("");
      setResetVisible(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update Captain password");
    } finally {
      setPendingId(null);
    }
  };

  const togglePassword = async (captain: CaptainView) => {
    if (visibleIds.includes(captain.id)) {
      setVisibleIds((current) => current.filter((id) => id !== captain.id));
      setSavedPasswords((current) => {
        const next = { ...current };
        delete next[captain.id];
        return next;
      });
      return;
    }
    setPendingId(captain.id);
    setMessage("");
    try {
      const saved = await getPassword(captain.id);
      setSavedPasswords((current) => ({ ...current, [captain.id]: saved }));
      setVisibleIds((current) => [...current, captain.id]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to retrieve Captain password");
    } finally {
      setPendingId(null);
    }
  };

  const copyPassword = async (captain: CaptainView) => {
    setPendingId(captain.id);
    setMessage("");
    try {
      const saved = savedPasswords[captain.id] ?? (await getPassword(captain.id));
      await copy(saved, "Captain password copied.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to retrieve Captain password");
    } finally {
      setPendingId(null);
    }
  };

  const loginUrl = getLoginPath();
  const absoluteLogin =
    typeof window !== "undefined" ? new URL(loginUrl, window.location.origin).toString() : loginUrl;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Captain Access</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Create floor staff accounts and share the Captain sign-in portal. Passwords are recoverable for
            authorized restaurant admins.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={loginUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white"
          >
            <ExternalLink className="h-4 w-4" /> Open Captain portal
          </a>
          <button
            type="button"
            onClick={() => void copy(absoluteLogin, "Captain login URL copied.")}
            className="inline-flex h-11 items-center rounded-xl border border-neutral-300 px-4 text-sm font-semibold text-neutral-800"
          >
            Copy portal link
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
        <p className="font-semibold text-neutral-900">Captain sign-in portal</p>
        <p className="mt-1 font-mono text-xs break-all text-neutral-700">{absoluteLogin}</p>
        <p className="mt-2 text-xs text-neutral-500">
          Assign any number of tables per captain (e.g. 50 tables → 10 captains × 5 tables). Captains place
          walk-in orders like POS, and must tick-approve QR orders for their tables before kitchen/KOT. Separate from the
          restaurant admin console.
        </p>
      </section>

      {activeTables.length ? (
        <section className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-950">
          <p className="font-semibold">Table assignment</p>
          <p className="mt-1 text-sky-900/80">
            Select tables under each captain and save. A table can only be actively assigned to one captain
            (reassignment removes it from others). No hard table limit.
          </p>
          <p className="mt-2 text-xs text-sky-800/80">
            Unassigned tables:{" "}
            {activeTables
              .filter((table) => !captains.some((captain) => (captain.assignedTableIds ?? []).includes(table.id)))
              .map((table) => table.tableNumber)
              .join(", ") || "none"}
          </p>
        </section>
      ) : null}

      {message ? (
        <p role="status" className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
          {message}
        </p>
      ) : null}

      <form onSubmit={create} className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-2">
        <input
          aria-label="Name"
          placeholder="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
          maxLength={100}
          className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm"
        />
        <input
          aria-label="Email"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm"
        />
        <div className="sm:col-span-2">
          <PasswordInput
            aria-label="Password"
            placeholder="Password (8+ characters)"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={setPassword}
            className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 pr-12 text-sm"
          />
        </div>
        <button
          disabled={busy}
          className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2"
        >
          {busy ? "Creating…" : "Create Captain"}
        </button>
      </form>

      <section className="space-y-3">
        {captains.map((captain) => {
          const isPasswordVisible = visibleIds.includes(captain.id);
          return (
            <article key={captain.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-neutral-900">{captain.name}</h2>
                  <p className="text-sm text-neutral-500">
                    {captain.email} · {captain.isActive ? "Enabled" : "Disabled"}
                    {captain.employeeCode ? ` · #${captain.employeeCode}` : ""}
                    {" · "}
                    {(captain.assignedTableIds ?? []).length} tables
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pendingId === captain.id}
                  onClick={() => void toggle(captain)}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-700 disabled:opacity-50"
                >
                  {pendingId === captain.id ? "Working…" : captain.isActive ? "Disable" : "Enable"}
                </button>
              </div>
              {activeTables.length ? (
                <div className="mt-3 rounded-xl border border-neutral-100 bg-neutral-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    Assigned tables
                  </p>
                  <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                    {activeTables.map((table) => {
                      const checked = (assignDraft[captain.id] ?? []).includes(table.id);
                      const conflict = assignedElsewhere(table.id, captain.id);
                      return (
                        <label
                          key={table.id}
                          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
                            checked
                              ? "border-neutral-900 bg-neutral-900 text-white"
                              : "border-neutral-200 bg-white text-neutral-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={() => toggleTableDraft(captain.id, table.id)}
                          />
                          T{table.tableNumber}
                          {conflict && !checked ? (
                            <span className="text-[10px] opacity-70">({conflict.name})</span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={pendingId === captain.id}
                    onClick={() => void saveTableAssignment(captain)}
                    className="mt-3 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Save table assignment
                  </button>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="min-w-44 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-neutral-700">
                  {isPasswordVisible
                    ? savedPasswords[captain.id]
                    : captain.passwordConfigured
                      ? "••••••••••••"
                      : "No recoverable password saved"}
                </span>
                {captain.passwordConfigured ? (
                  <>
                    <button
                      type="button"
                      disabled={pendingId === captain.id}
                      onClick={() => void togglePassword(captain)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-neutral-700 disabled:opacity-50"
                    >
                      {isPasswordVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {isPasswordVisible ? "Hide password" : "Show password"}
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === captain.id}
                      onClick={() => void copyPassword(captain)}
                      className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-700 disabled:opacity-50"
                    >
                      Copy password
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === captain.id}
                      onClick={() => {
                        setResetTarget(captain);
                        setResetPassword("");
                        setResetVisible(false);
                      }}
                      className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-700 disabled:opacity-50"
                    >
                      Reset password
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={pendingId === captain.id}
                    onClick={() => {
                      setResetTarget(captain);
                      setResetPassword("");
                      setResetVisible(false);
                    }}
                    className="rounded-lg border border-amber-200 px-3 py-2 text-amber-700 disabled:opacity-50"
                  >
                    Set retrievable password
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copy(captain.email, "Captain email copied.")}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-700"
                >
                  Copy email
                </button>
                <a
                  href={loginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-700"
                >
                  Open Captain Login
                </a>
                <button
                  type="button"
                  onClick={() => void copy(absoluteLogin, "Captain login URL copied.")}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-700"
                >
                  Copy login URL
                </button>
              </div>
            </article>
          );
        })}
        {captains.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            No Captains added yet.
          </p>
        ) : null}
      </section>

      {resetTarget ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={(event) => void saveResetPassword(event)}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-neutral-900">
              Set password for {resetTarget.name}
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              Minimum 8 characters. The password will be stored encrypted so you can show it later.
            </p>
            <div className="relative mt-4">
              <input
                type={resetVisible ? "text" : "password"}
                required
                minLength={8}
                maxLength={256}
                autoComplete="new-password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
                placeholder="New password"
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 pr-12 text-sm"
              />
              <button
                type="button"
                onClick={() => setResetVisible((current) => !current)}
                aria-label={resetVisible ? "Hide password" : "Show password"}
                className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-50"
              >
                {resetVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setResetTarget(null);
                  setResetPassword("");
                }}
                className="h-11 flex-1 rounded-xl border border-neutral-200 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pendingId === resetTarget.id}
                className="h-11 flex-1 rounded-xl bg-neutral-900 text-sm font-bold text-white disabled:opacity-50"
              >
                {pendingId === resetTarget.id ? "Saving…" : "Save password"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
