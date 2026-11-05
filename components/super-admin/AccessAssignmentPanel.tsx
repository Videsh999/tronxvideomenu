"use client";

import { useState } from "react";
import type { AccessAssignmentAudit, OrgRole } from "@/types";

type AssignmentAccount = {
  id: string;
  restaurantId: string;
  email: string;
  organizationId?: string;
  orgRole?: OrgRole;
  outletIds?: string[];
  isActive: boolean;
  updatedAt: string;
};

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

const ROLES: OrgRole[] = ["ORG_OWNER", "ORG_ADMIN", "OUTLET_MANAGER", "OUTLET_STAFF"];

export default function AccessAssignmentPanel({
  restaurantId,
  organizationId,
}: {
  restaurantId: string;
  organizationId?: string;
}) {
  const [account, setAccount] = useState<AssignmentAccount | null>(null);
  const [audits, setAudits] = useState<AccessAssignmentAudit[]>([]);
  const [orgRole, setOrgRole] = useState<OrgRole | "">("");
  const [orgId, setOrgId] = useState(organizationId ?? "");
  const [outletIds, setOutletIds] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setBusy(true);
    setMessage("");
    try {
      const data = await request<{ account: AssignmentAccount; audits: AccessAssignmentAudit[] }>(
        `/api/super-admin/access-assignments?restaurantId=${encodeURIComponent(restaurantId)}`,
      );
      setAccount(data.account);
      setAudits(data.audits);
      setOrgRole(data.account.orgRole ?? "");
      setOrgId(data.account.organizationId ?? organizationId ?? "");
      setOutletIds((data.account.outletIds ?? []).join(", "));
      setIsActive(data.account.isActive);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load access assignment.");
    } finally {
      setBusy(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!confirm) {
      setMessage("Confirm the sensitive change before saving.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const data = await request<{ account: AssignmentAccount; audit: AccessAssignmentAudit }>(
        "/api/super-admin/access-assignments",
        {
          method: "PUT",
          body: JSON.stringify({
            restaurantId,
            restaurantAdminAccountId: account?.id,
            organizationId: orgId.trim() ? orgId.trim() : null,
            orgRole: orgRole || null,
            outletIds: outletIds
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
            isActive,
            reason: reason.trim() || undefined,
            confirm: true,
          }),
        },
      );
      setAccount(data.account);
      setAudits((prev) => [data.audit, ...prev].slice(0, 50));
      setConfirm(false);
      setReason("");
      setMessage("Access assignment saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save assignment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-neutral-900">Organization & outlet access</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Super-admin only. Changes are audited. Removing the last organization owner is blocked.
      </p>

      {account ? (
        <p className="mt-3 text-sm text-neutral-700">
          Account: <span className="font-medium">{account.email}</span> ({account.id})
        </p>
      ) : null}

      <div className="mt-3">
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="h-10 rounded-xl border border-neutral-300 px-3 text-sm font-medium disabled:opacity-50"
        >
          {account ? "Refresh assignment" : "Load assignment"}
        </button>
      </div>

      <form onSubmit={(event) => void save(event)} className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-800">Organization ID</span>
          <input
            value={orgId}
            onChange={(event) => setOrgId(event.target.value)}
            className="h-11 rounded-xl border border-neutral-300 px-3"
            placeholder="org-…"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-800">Organization role</span>
          <select
            value={orgRole}
            onChange={(event) => setOrgRole(event.target.value as OrgRole | "")}
            className="h-11 rounded-xl border border-neutral-300 px-3"
          >
            <option value="">None (legacy single-outlet)</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-800">Outlet IDs (comma-separated)</span>
          <input
            value={outletIds}
            onChange={(event) => setOutletIds(event.target.value)}
            className="h-11 rounded-xl border border-neutral-300 px-3"
            placeholder="restaurant-a, restaurant-b"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          Account active
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-neutral-800">Reason</span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="h-11 rounded-xl border border-neutral-300 px-3"
            placeholder="Why is this change being made?"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-rose-700">
          <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
          I confirm this sensitive access change
        </label>
        <button
          type="submit"
          disabled={busy || !confirm}
          className="h-11 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save access assignment"}
        </button>
      </form>

      {message ? <p className="mt-3 text-sm text-neutral-700">{message}</p> : null}

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-neutral-900">Audit history</h3>
        <ul className="mt-2 space-y-2">
          {audits.length === 0 ? (
            <li className="text-sm text-neutral-500">No access changes recorded yet.</li>
          ) : (
            audits.map((audit) => (
              <li key={audit.id} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs text-neutral-700">
                <div className="font-medium">
                  {audit.changedBy.email} · {new Date(audit.createdAt).toLocaleString()}
                </div>
                <div>
                  {audit.previous.orgRole ?? "none"} → {audit.next.orgRole ?? "none"} · active{" "}
                  {String(audit.previous.isActive)} → {String(audit.next.isActive)}
                </div>
                {audit.reason ? <div className="text-neutral-500">{audit.reason}</div> : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
