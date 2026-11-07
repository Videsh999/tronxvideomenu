"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
  AlertTriangle,
  History,
  Download,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { CanonicalColumn, ColumnMapping, ImportStrategy, MenuImportJob } from "@/lib/menu-import/types";
import { normalizeImportItemDraft } from "@/lib/menu-import/item-schema";

const CANONICAL_OPTIONS: { value: CanonicalColumn; label: string }[] = [
  { value: "itemName", label: "Item name" },
  { value: "category", label: "Category" },
  { value: "description", label: "Description" },
  { value: "price", label: "Price" },
  { value: "compareAtPrice", label: "Original price" },
  { value: "dietary", label: "Veg / Non-veg" },
  { value: "prepTime", label: "Prep time" },
  { value: "sku", label: "SKU / code" },
  { value: "tags", label: "Tags" },
  { value: "availability", label: "Availability" },
  { value: "addonGroup", label: "Add-on group" },
  { value: "addonName", label: "Add-on name" },
  { value: "addonPrice", label: "Add-on price" },
  { value: "ignore", label: "Ignore" },
];

type Step = "upload" | "sheet" | "mapping" | "preview" | "done";

function isMappingStep(status: string) {
  return status === "AWAITING_MAPPING";
}

function isSuccessStatus(status: string) {
  return status === "COMPLETED" || status === "COMPLETED_WITH_WARNINGS" || status === "PARTIALLY_COMPLETED";
}

function humanStatus(status: string) {
  switch (status) {
    case "COMPLETED_WITH_WARNINGS":
      return "Completed with warnings";
    case "PARTIALLY_COMPLETED":
      return "Partially completed";
    case "READY_TO_IMPORT":
    case "AWAITING_REVIEW":
      return "Ready to import";
    case "AWAITING_MAPPING":
      return "Awaiting mapping";
    case "IMPORTING":
    case "COMMITTING":
      return "Importing";
    default:
      return status;
  }
}

export default function MenuImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState<Omit<MenuImportJob, "grids"> | null>(null);
  const [history, setHistory] = useState<Omit<MenuImportJob, "grids">[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  /** Default: update matches + create new — never create a second copy of the same dish. */
  const [strategy, setStrategy] = useState<ImportStrategy>("UPDATE_MATCHING");
  const [showValidationDetails, setShowValidationDetails] = useState(false);

  const loadHistory = useCallback(async () => {
    const response = await fetch("/api/admin/menu-import", { cache: "no-store" });
    const result = (await response.json()) as { success: boolean; data?: Omit<MenuImportJob, "grids">[] };
    if (response.ok && result.success && result.data) setHistory(result.data);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadHistory(), 0);
    return () => window.clearTimeout(timer);
  }, [loadHistory]);

  const validationSummary = useMemo(() => {
    const items = job?.preview?.items ?? [];
    const errors = items.flatMap((item) =>
      item.errors.map((message) => ({
        rows: item.sourceRowNumbers,
        message: item.sourceRowNumbers.length
          ? `Row ${item.sourceRowNumbers.join(", ")}: ${message}`
          : message,
      })),
    );
    const warnings = items.flatMap((item) =>
      item.warnings.map((message) => ({
        rows: item.sourceRowNumbers,
        message: item.sourceRowNumbers.length
          ? `Row ${item.sourceRowNumbers.join(", ")}: ${message}`
          : message,
      })),
    );
    return {
      errorCount: errors.length,
      warningCount: warnings.length,
      validRowCount: items.filter((item) => item.errors.length === 0).length,
      invalidRowCount: items.filter((item) => item.errors.length > 0).length,
      errors,
      warnings,
    };
  }, [job?.preview?.items]);

  async function uploadFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/menu-import", { method: "POST", body });
      const result = (await response.json()) as {
        success: boolean;
        data?: Omit<MenuImportJob, "grids">;
        error?: string;
      };
      if (!response.ok || !result.success || !result.data) throw new Error(result.error ?? "Upload failed.");
      setJob(result.data);
      setMappings(result.data.columnMappings);
      setStrategy(result.data.strategy);
      setStep(
        result.data.sheets.length > 1
          ? "sheet"
          : isMappingStep(result.data.status)
            ? "mapping"
            : "preview",
      );
      await loadHistory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function selectSheet(sheetName: string) {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/menu-import/${job.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetName }),
      });
      const result = (await response.json()) as {
        success: boolean;
        data?: Omit<MenuImportJob, "grids">;
        error?: string;
      };
      if (!response.ok || !result.success || !result.data) throw new Error(result.error ?? "Analyze failed.");
      setJob(result.data);
      setMappings(result.data.columnMappings);
      setStep(isMappingStep(result.data.status) ? "mapping" : "preview");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Analyze failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveMapping() {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/menu-import/${job.id}/mapping`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnMappings: mappings, strategy }),
      });
      const result = (await response.json()) as {
        success: boolean;
        data?: Omit<MenuImportJob, "grids">;
        error?: string;
      };
      if (!response.ok || !result.success || !result.data) throw new Error(result.error ?? "Mapping failed.");
      setJob(result.data);
      setStep("preview");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mapping failed.");
    } finally {
      setBusy(false);
    }
  }

  async function savePreview() {
    if (!job?.preview) return;
    const response = await fetch(`/api/admin/menu-import/${job.id}/preview`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: job.preview.items.map((item) => normalizeImportItemDraft(item)),
      }),
    });
    const result = (await response.json()) as {
      success: boolean;
      data?: Omit<MenuImportJob, "grids">;
      error?: string;
    };
    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.error ?? "Preview save failed.");
    }
    setJob(result.data);
  }

  async function commit() {
    if (!job) return;
    if (validationSummary.errorCount > 0) {
      const includedBlocking = (job.preview?.items ?? []).filter(
        (item) => item.included && item.errors.length > 0,
      );
      if (includedBlocking.length > 0) {
        setError(
          `Cannot import: ${includedBlocking.length} included row(s) still have blocking errors. Fix or uncheck them first.`,
        );
        setShowValidationDetails(true);
        return;
      }
    }
    const confirmed = window.confirm(
      "Import the selected items into your live menu? This will create or update dishes based on your choices.",
    );
    if (!confirmed) return;
    setBusy(true);
    setError("");
    try {
      await savePreview();
      const response = await fetch(`/api/admin/menu-import/${job.id}/commit`, { method: "POST" });
      const result = (await response.json()) as {
        success: boolean;
        data?: Omit<MenuImportJob, "grids">;
        error?: string;
      };
      if (!response.ok || !result.success || !result.data) throw new Error(result.error ?? "Import failed.");
      setJob(result.data);
      setStep("done");
      await loadHistory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  function updateItem(rowKey: string, patch: Partial<NonNullable<MenuImportJob["preview"]>["items"][number]>) {
    setJob((current) => {
      if (!current?.preview) return current;
      return {
        ...current,
        preview: {
          ...current.preview,
          items: current.preview.items.map((item) =>
            item.rowKey === rowKey ? normalizeImportItemDraft({ ...item, ...patch }) : item,
          ),
        },
      };
    });
  }

  const doneIsPartial = job?.status === "PARTIALLY_COMPLETED";
  const doneHasWarnings =
    job?.status === "COMPLETED_WITH_WARNINGS" || (job?.result?.warningCount ?? 0) > 0 || (job?.result?.errors?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p className="font-semibold">Something needs attention</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{error}</p>
        </div>
      ) : null}

      {step === "upload" ? (
        <section className="rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Upload your menu spreadsheet</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Drag in an Excel or CSV file. We detect categories, prices, Half/Full sizes, and add-ons automatically.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/api/admin/menu-export?format=xlsx"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-300 px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                <Download className="h-4 w-4" /> Export current menu
              </a>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not an app page */}
              <a
                href="/api/admin/menu-import/template"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-300 px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                <Download className="h-4 w-4" /> Sample template
              </a>
            </div>
          </div>

          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void uploadFile(file);
            }}
            className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 transition ${
              dragOver ? "border-neutral-900 bg-neutral-50" : "border-neutral-300 bg-neutral-50/50 hover:border-neutral-400"
            }`}
          >
            <Upload className="h-8 w-8 text-neutral-500" />
            <span className="mt-3 text-sm font-semibold text-neutral-900">Drop file here or browse</span>
            <span className="mt-1 text-xs text-neutral-500">.xlsx or .csv · max 8 MB</span>
            <input
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadFile(file);
              }}
            />
          </label>
          {busy ? (
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-neutral-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading spreadsheet…
            </p>
          ) : null}
        </section>
      ) : null}

      {step === "sheet" && job ? (
        <section className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-neutral-900">Choose a worksheet</h2>
          <p className="mt-1 text-sm text-neutral-500">This file has multiple sheets. Pick the one that contains your menu.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {job.sheets.map((sheet) => (
              <button
                key={sheet.name}
                type="button"
                disabled={busy}
                onClick={() => void selectSheet(sheet.name)}
                className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-left transition hover:border-neutral-400 hover:bg-white"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                  <FileSpreadsheet className="h-4 w-4" /> {sheet.name}
                </span>
                <span className="mt-1 block text-xs text-neutral-500">
                  {sheet.rowCount} data rows · {sheet.headers.length} columns
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === "mapping" && job ? (
        <section className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-neutral-900">Confirm column mapping</h2>
          <p className="mt-1 text-sm text-neutral-500">We guessed these fields. Adjust anything that looks wrong before continuing.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-2 py-2">Spreadsheet column</th>
                  <th className="px-2 py-2">Maps to</th>
                  <th className="px-2 py-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping, index) => (
                  <tr key={`${mapping.sourceHeader}-${index}`} className="border-t border-neutral-100">
                    <td className="px-2 py-2 font-medium text-neutral-900">
                      {mapping.sourceHeader || `Column ${mapping.columnIndex + 1}`}
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={mapping.canonical}
                        onChange={(event) => {
                          const canonical = event.target.value as CanonicalColumn;
                          setMappings((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, canonical, confidence: 1 } : entry,
                            ),
                          );
                        }}
                        className="h-10 rounded-lg border border-neutral-200 bg-white px-2"
                      >
                        {CANONICAL_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {mapping.variantName ? (
                        <span className="ml-2 text-xs text-emerald-700">Variant: {mapping.variantName}</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-neutral-600">{Math.round(mapping.confidence * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-3">
            <p className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              Re-uploading Excel? We scan names and SKUs against your live menu. Matching dishes are
              <strong> updated once</strong> (not duplicated). New rows are created. Duplicates inside
              the same file are kept once.
            </p>
            <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-neutral-600">
              Import strategy
              <select
                value={strategy}
                onChange={(event) => setStrategy(event.target.value as ImportStrategy)}
                className="ml-2 h-10 rounded-lg border border-neutral-200 bg-white px-2"
              >
                <option value="UPDATE_MATCHING">Update matching · create new (recommended)</option>
                <option value="SMART_MERGE">Smart merge (review each update)</option>
                <option value="CREATE_ONLY">Create new only (skip matches)</option>
              </select>
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveMapping()}
              className="ml-auto rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? "Working…" : "Continue to preview"}
            </button>
            </div>
          </div>
        </section>
      ) : null}

      {step === "preview" && job?.preview ? (
        <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Review before import</h2>
              <p className="mt-1 text-sm text-neutral-500">
                {validationSummary.validRowCount} valid · {validationSummary.invalidRowCount} need attention ·{" "}
                {validationSummary.warningCount} warnings · avg confidence{" "}
                {Math.round(job.preview.summary.averageConfidence * 100)}%
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setStep("mapping")}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void commit()}
                className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? "Importing…" : "Approve & import"}
              </button>
            </div>
          </div>

          {(validationSummary.errorCount > 0 || validationSummary.warningCount > 0) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left font-semibold"
                onClick={() => setShowValidationDetails((value) => !value)}
              >
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Validation summary · {validationSummary.errorCount} error
                  {validationSummary.errorCount === 1 ? "" : "s"} · {validationSummary.warningCount} warning
                  {validationSummary.warningCount === 1 ? "" : "s"}
                </span>
                {showValidationDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <p className="mt-2 text-xs text-amber-900">
                Blank Description or SKU cells are allowed and do not block import. Missing dish names or invalid
                prices must be fixed or unchecked.
              </p>
              {showValidationDetails ? (
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-lg bg-white/70 p-3 text-xs">
                  {validationSummary.errors.map((entry) => (
                    <p key={`e-${entry.message}`} className="text-rose-700">
                      {entry.message}
                    </p>
                  ))}
                  {validationSummary.warnings.map((entry) => (
                    <p key={`w-${entry.message}`} className="text-amber-800">
                      {entry.message}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {job.preview.categoriesToCreate.length > 0 || job.preview.categoriesExisting.length > 0 ? (
            <div className="rounded-xl bg-neutral-50 p-4 text-sm text-neutral-700">
              <p>
                <span className="font-semibold">New categories:</span>{" "}
                {job.preview.categoriesToCreate.join(", ") || "None"}
              </p>
              <p className="mt-1">
                <span className="font-semibold">Existing categories:</span>{" "}
                {job.preview.categoriesExisting.join(", ") || "None"}
              </p>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-2 py-2">Include</th>
                  <th className="px-2 py-2">Item</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Price</th>
                  <th className="px-2 py-2">Action</th>
                  <th className="px-2 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {job.preview.items.map((item) => (
                  <tr key={item.rowKey} className="border-t border-neutral-100 align-top">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={item.included}
                        onChange={(event) => updateItem(item.rowKey, { included: event.target.checked })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={item.name}
                        onChange={(event) => updateItem(item.rowKey, { name: event.target.value })}
                        className="w-40 rounded-lg border border-neutral-200 px-2 py-1 font-medium"
                      />
                      {item.variants.length ? (
                        <p className="mt-1 text-xs text-neutral-500">
                          {item.variants.map((variant) => `${variant.name}: ₹${variant.price}`).join(" · ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={item.categoryName}
                        onChange={(event) => updateItem(item.rowKey, { categoryName: event.target.value })}
                        className="w-32 rounded-lg border border-neutral-200 px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={item.price ?? ""}
                        onChange={(event) =>
                          updateItem(item.rowKey, {
                            price: event.target.value === "" ? null : Number(event.target.value),
                            errors: event.target.value === "" ? ["Price is missing or invalid. Please correct this row."] : [],
                          })
                        }
                        className="w-24 rounded-lg border border-neutral-200 px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={item.action}
                        onChange={(event) =>
                          updateItem(item.rowKey, { action: event.target.value as typeof item.action })
                        }
                        className="rounded-lg border border-neutral-200 px-2 py-1"
                      >
                        <option value="CREATE">Create</option>
                        <option value="UPDATE">Update</option>
                        <option value="SKIP">Skip</option>
                        <option value="NEEDS_REVIEW">Needs review</option>
                      </select>
                    </td>
                    <td className="px-2 py-2 text-xs text-neutral-600">
                      {item.errors.map((message) => (
                        <p key={message} className="text-rose-600">
                          {message}
                        </p>
                      ))}
                      {item.warnings.map((message) => (
                        <p key={message} className="text-amber-700">
                          {message}
                        </p>
                      ))}
                      {item.matchReason ? <p>{item.matchReason}</p> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {step === "done" && job && isSuccessStatus(job.status) ? (
        <section
          className={`rounded-2xl border p-6 ${
            doneIsPartial
              ? "border-amber-200 bg-amber-50"
              : doneHasWarnings
                ? "border-amber-200 bg-amber-50"
                : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <div className="flex items-start gap-3">
            {doneIsPartial || doneHasWarnings ? (
              <AlertTriangle className="mt-0.5 h-6 w-6 text-amber-700" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-700" />
            )}
            <div>
              <h2 className="text-lg font-semibold text-neutral-950">
                {doneIsPartial
                  ? "Import partially completed"
                  : doneHasWarnings
                    ? "Import completed with warnings"
                    : "Import complete"}
              </h2>
              <p className="mt-1 text-sm text-neutral-800">
                Created {job.result?.createdDishes ?? 0} dishes · updated {job.result?.updatedDishes ?? 0} · new
                categories {job.result?.createdCategories ?? 0} · size/add-on groups{" "}
                {job.result?.createdAddonGroups ?? 0}
              </p>
              <p className="mt-1 text-xs text-neutral-600">
                Rows: {job.result?.totalRows ?? "—"} total · {job.result?.validRows ?? "—"} valid ·{" "}
                {job.result?.invalidRows ?? 0} invalid · {job.result?.skipped ?? 0} skipped ·{" "}
                {job.result?.failedRows ?? 0} failed during commit
              </p>
              {job.result?.errors?.length ? (
                <div className="mt-3 rounded-xl bg-white/70 p-3 text-sm text-amber-900">
                  <p className="inline-flex items-center gap-1 font-semibold">
                    <AlertTriangle className="h-4 w-4" /> Issues during commit
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {job.result.errors.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setJob(null);
                    setStep("upload");
                    setError("");
                  }}
                  className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white"
                >
                  Import another file
                </button>
                {job.rollback ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void (async () => {
                        if (
                          !window.confirm(
                            "Roll back this import? Created dishes/categories from this job will be removed and updated dishes restored.",
                          )
                        )
                          return;
                        setBusy(true);
                        try {
                          const response = await fetch(`/api/admin/menu-import/${job.id}/cancel`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ rollback: true }),
                          });
                          const result = (await response.json()) as { success: boolean; error?: string };
                          if (!response.ok || !result.success) throw new Error(result.error ?? "Rollback failed.");
                          setJob(null);
                          setStep("upload");
                          setError("");
                          await loadHistory();
                        } catch (cause) {
                          setError(cause instanceof Error ? cause.message : "Rollback failed.");
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                    className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700"
                  >
                    Roll back import
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {step === "done" && job && !isSuccessStatus(job.status) ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <h2 className="text-lg font-semibold text-rose-950">Import did not complete</h2>
          <p className="mt-1 text-sm text-rose-900">{job.errorMessage || humanStatus(job.status)}</p>
          <button
            type="button"
            className="mt-4 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white"
            onClick={() => {
              setJob(null);
              setStep("upload");
              setError("");
            }}
          >
            Start over
          </button>
        </section>
      ) : null}

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-600">
          <History className="h-4 w-4" /> Import history
        </h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No imports yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100">
            {history.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium text-neutral-900">{entry.fileName}</p>
                  <p className="text-xs text-neutral-500">
                    {entry.uploadedByEmail} · {new Date(entry.createdAt).toLocaleString()} ·{" "}
                    {humanStatus(entry.status)}
                  </p>
                </div>
                {entry.result ? (
                  <p className="text-xs text-neutral-600">
                    +{entry.result.createdDishes} created · {entry.result.updatedDishes} updated
                    {typeof entry.result.invalidRows === "number" ? ` · ${entry.result.invalidRows} invalid` : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
