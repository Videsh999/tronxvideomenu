"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { BillBreakdown, RestaurantBillingSettings } from "@/types";

type AuditRow = {
  id: string;
  action: string;
  createdAt: string;
  actor?: { email?: string };
  meta?: Record<string, unknown>;
};

const tabs = [
  "General",
  "GST",
  "Packaging",
  "Service charge",
  "Bulk tax",
  "Preview",
  "Audit",
] as const;

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function BillingSettingsForm({
  initialBilling,
  restaurantId,
}: {
  initialBilling: RestaurantBillingSettings;
  restaurantId: string;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("General");
  const [draft, setDraft] = useState<RestaurantBillingSettings>({ ...initialBilling });
  const [saved, setSaved] = useState<RestaurantBillingSettings>({ ...initialBilling });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [previewPrice, setPreviewPrice] = useState("1000");
  const [previewQty, setPreviewQty] = useState("1");
  const [preview, setPreview] = useState<BillBreakdown | null>(null);
  const [bulkRate, setBulkRate] = useState(String(initialBilling.gstRatePercent ?? 5));
  const [bulkPreview, setBulkPreview] = useState<{
    affectedCount: number;
    preservedOverrideCount: number;
    sampleNames: string[];
  } | null>(null);
  const [replaceOverrides, setReplaceOverrides] = useState(false);
  const [audit, setAudit] = useState<AuditRow[]>([]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  useEffect(() => {
    void fetch("/api/admin/billing")
      .then((response) => response.json())
      .then((json) => {
        if (json.success) setAudit(json.data.audit ?? []);
      })
      .catch(() => null);
  }, []);

  function patch<K extends keyof RestaurantBillingSettings>(key: K, value: RestaurantBillingSettings[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch("/api/admin/billing", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Save failed");
        setSaved(json.data);
        setDraft(json.data);
        setMessage("Billing settings saved. New orders use this configuration.");
        const auditResponse = await fetch("/api/admin/billing");
        const auditJson = await auditResponse.json();
        if (auditJson.success) setAudit(auditJson.data.audit ?? []);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Save failed");
      }
    });
  }

  function runPreview() {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch("/api/admin/billing/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemPrice: Number(previewPrice) || 0,
            quantity: Number(previewQty) || 1,
            billing: draft,
          }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Preview failed");
        setPreview(json.data);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Preview failed");
      }
    });
  }

  function previewBulk() {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch("/api/admin/billing/bulk-tax", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gstRatePercent: Number(bulkRate) || 0,
            scope: "ALL",
            replaceOverrides,
            previewOnly: true,
          }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Preview failed");
        setBulkPreview(json.data);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Bulk preview failed");
      }
    });
  }

  function applyBulk() {
    if (!bulkPreview) {
      setMessage("Run preview before applying bulk tax.");
      return;
    }
    if (
      !window.confirm(
        `Apply ${bulkRate}% GST to ${bulkPreview.affectedCount} item(s)?${
          replaceOverrides ? " Existing overrides will be replaced." : ""
        }`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/billing/bulk-tax", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gstRatePercent: Number(bulkRate) || 0,
            scope: "ALL",
            replaceOverrides,
            previewOnly: false,
          }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Bulk apply failed");
        setMessage(`Updated ${json.data.updatedCount} dishes. Overrides preserved: ${json.data.preservedOverrideCount}.`);
        setBulkPreview(null);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Bulk apply failed");
      }
    });
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Settings</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Billing & tax</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            Outlet defaults for GST, packaging, and service charge. POS, Captain, and QR share one
            server calculator. Confirm rates with your tax professional before go-live.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
              Unsaved changes
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">
              Saved
            </span>
          )}
          <button
            type="button"
            disabled={pending || !dirty}
            onClick={() => setDraft(saved)}
            className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || !dirty}
            onClick={save}
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            Save configuration
          </button>
        </div>
      </header>

      {message ? (
        <p
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            /fail|invalid|error/i.test(message)
              ? "border border-rose-200 bg-rose-50 text-rose-800"
              : "border border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {message}
        </p>
      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => setTab(entry)}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${
              tab === entry ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200"
            }`}
          >
            {entry}
          </button>
        ))}
      </div>

      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        {tab === "General" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Currency
              <input
                value={draft.currency ?? "INR"}
                onChange={(event) => patch("currency", event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3"
              />
            </label>
            <label className="text-sm">
              Price mode
              <select
                value={draft.priceMode ?? "EXCLUSIVE"}
                onChange={(event) =>
                  patch("priceMode", event.target.value as RestaurantBillingSettings["priceMode"])
                }
                className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3"
              >
                <option value="EXCLUSIVE">Tax exclusive (add GST on top)</option>
                <option value="INCLUSIVE">Tax inclusive (extract GST)</option>
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              Effective from
              <input
                type="date"
                value={(draft.effectiveFrom ?? "").slice(0, 10)}
                onChange={(event) => patch("effectiveFrom", event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3"
              />
            </label>
            <p className="sm:col-span-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Restaurant ID {restaurantId}. Changing settings never rewrites historical order
              snapshots.
            </p>
          </div>
        ) : null}

        {tab === "GST" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={draft.gstEnabled !== false}
                onChange={(event) => patch("gstEnabled", event.target.checked)}
              />
              Enable GST
            </label>
            <label className="text-sm">
              GST rate (%)
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={draft.gstRatePercent ?? draft.taxRatePercent ?? 0}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  patch("gstRatePercent", value);
                  patch("taxRatePercent", value);
                }}
                className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3"
              />
            </label>
            <label className="text-sm">
              Supply type
              <select
                value={draft.supplyType ?? "INTRA_STATE"}
                onChange={(event) =>
                  patch("supplyType", event.target.value as RestaurantBillingSettings["supplyType"])
                }
                className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3"
              >
                <option value="INTRA_STATE">Intra-state (CGST + SGST)</option>
                <option value="INTER_STATE">Inter-state (IGST)</option>
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              Tax label on bills
              <input
                value={draft.taxLabel ?? "GST"}
                onChange={(event) => patch("taxLabel", event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3"
              />
            </label>
            <p className="sm:col-span-2 text-sm text-neutral-600">
              Intra-state splits GST evenly into CGST and SGST. Inter-state uses IGST only. Never
              all three together. Do not treat this as “service tax.”
            </p>
          </div>
        ) : null}

        {tab === "Packaging" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={Boolean(draft.packagingEnabled)}
                onChange={(event) => patch("packagingEnabled", event.target.checked)}
              />
              Enable packaging charges
            </label>
            <label className="text-sm">
              Method
              <select
                value={draft.packagingMethod ?? "PER_ORDER"}
                onChange={(event) =>
                  patch(
                    "packagingMethod",
                    event.target.value as RestaurantBillingSettings["packagingMethod"],
                  )
                }
                className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3"
              >
                <option value="PER_ORDER">Fixed per order</option>
                <option value="PER_ITEM">Fixed per line item</option>
                <option value="PER_QUANTITY">Fixed per quantity unit</option>
                <option value="PERCENT_OF_SUBTOTAL">Percent of subtotal</option>
              </select>
            </label>
            <label className="text-sm">
              Amount (₹)
              <input
                type="number"
                min={0}
                value={draft.packagingAmount ?? 0}
                onChange={(event) => patch("packagingAmount", Number(event.target.value))}
                className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3"
              />
            </label>
            <label className="text-sm">
              Percent (when percent method)
              <input
                type="number"
                min={0}
                max={100}
                value={draft.packagingPercent ?? 0}
                onChange={(event) => patch("packagingPercent", Number(event.target.value))}
                className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3"
              />
            </label>
          </div>
        ) : null}

        {tab === "Service charge" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={Boolean(draft.serviceChargeEnabled)}
                onChange={(event) => patch("serviceChargeEnabled", event.target.checked)}
              />
              Enable service charge (optional — off by default)
            </label>
            <label className="text-sm">
              Type
              <select
                value={draft.serviceChargeType ?? "PERCENT"}
                onChange={(event) =>
                  patch(
                    "serviceChargeType",
                    event.target.value as RestaurantBillingSettings["serviceChargeType"],
                  )
                }
                className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3"
              >
                <option value="PERCENT">Percentage</option>
                <option value="FIXED">Fixed amount</option>
              </select>
            </label>
            <label className="text-sm">
              Percent
              <input
                type="number"
                min={0}
                max={100}
                value={draft.serviceChargePercent ?? 0}
                onChange={(event) => patch("serviceChargePercent", Number(event.target.value))}
                className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3"
              />
            </label>
            <label className="text-sm">
              Fixed amount (₹)
              <input
                type="number"
                min={0}
                value={draft.serviceChargeAmount ?? 0}
                onChange={(event) => patch("serviceChargeAmount", Number(event.target.value))}
                className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3"
              />
            </label>
            <p className="sm:col-span-2 text-sm text-neutral-600">
              Service charge is separate from GST and only applies when enabled.
            </p>
          </div>
        ) : null}

        {tab === "Bulk tax" ? (
          <div className="space-y-4">
            <label className="block text-sm">
              Default GST % to apply to eligible dishes
              <input
                type="number"
                min={0}
                max={100}
                value={bulkRate}
                onChange={(event) => setBulkRate(event.target.value)}
                className="mt-1 min-h-11 w-full max-w-xs rounded-xl border border-neutral-200 px-3"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={replaceOverrides}
                onChange={(event) => setReplaceOverrides(event.target.checked)}
              />
              Replace existing dish-level overrides (requires confirmation)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={previewBulk}
                className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold"
              >
                Preview affected items
              </button>
              <button
                type="button"
                disabled={pending || !bulkPreview}
                onClick={applyBulk}
                className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                Apply to eligible items
              </button>
            </div>
            {bulkPreview ? (
              <div className="rounded-2xl bg-neutral-50 p-4 text-sm">
                <p className="font-semibold">
                  {bulkPreview.affectedCount} dishes will update · {bulkPreview.preservedOverrideCount}{" "}
                  overrides preserved
                </p>
                <p className="mt-2 text-neutral-600">
                  Sample: {bulkPreview.sampleNames.join(", ") || "—"}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "Preview" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                Item price (₹)
                <input
                  value={previewPrice}
                  onChange={(event) => setPreviewPrice(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3"
                />
              </label>
              <label className="text-sm">
                Quantity
                <input
                  value={previewQty}
                  onChange={(event) => setPreviewQty(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={pending}
                  onClick={runPreview}
                  className="min-h-11 w-full rounded-full bg-neutral-900 px-4 text-sm font-bold text-white"
                >
                  Calculate with server
                </button>
              </div>
            </div>
            {preview ? (
              <dl className="grid gap-2 rounded-2xl border border-neutral-100 bg-neutral-50 p-4 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-3"><dt>Items subtotal</dt><dd className="font-semibold">{money(preview.itemsSubtotal)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Packaging</dt><dd className="font-semibold">{money(preview.packagingCharge)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Service charge</dt><dd className="font-semibold">{money(preview.serviceCharge)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Taxable</dt><dd className="font-semibold">{money(preview.taxableAmount)}</dd></div>
                <div className="flex justify-between gap-3"><dt>CGST</dt><dd className="font-semibold">{money(preview.cgstAmount)}</dd></div>
                <div className="flex justify-between gap-3"><dt>SGST</dt><dd className="font-semibold">{money(preview.sgstAmount)}</dd></div>
                <div className="flex justify-between gap-3"><dt>IGST</dt><dd className="font-semibold">{money(preview.igstAmount)}</dd></div>
                <div className="flex justify-between gap-3 text-base"><dt className="font-bold">Total</dt><dd className="font-bold">{money(preview.total)}</dd></div>
              </dl>
            ) : (
              <p className="text-sm text-neutral-500">Run preview to see the authoritative breakdown.</p>
            )}
          </div>
        ) : null}

        {tab === "Audit" ? (
          <ul className="space-y-2 text-sm">
            {audit.length === 0 ? (
              <li className="text-neutral-500">No billing configuration changes yet.</li>
            ) : (
              audit.map((row) => (
                <li key={row.id} className="rounded-2xl border border-neutral-100 px-3 py-2">
                  <span className="font-semibold">{row.action}</span> · {row.actor?.email ?? "admin"} ·{" "}
                  {new Date(row.createdAt).toLocaleString()}
                  {row.meta ? (
                    <span className="ml-2 text-neutral-500">{JSON.stringify(row.meta)}</span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
