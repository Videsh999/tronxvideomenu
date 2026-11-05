"use client";

import { useCallback, useMemo, useState } from "react";

type Device = {
  id: string;
  name: string;
  deviceType: string;
  connectionStatus: string;
  healthStatus: string;
  simulated: boolean;
  enabled: boolean;
  kitchenStation?: string;
  printerRole?: string;
  manufacturer: string;
  model: string;
  outletId?: string;
  configuration?: Record<string, unknown>;
  lastSeenAt?: string;
  lastSuccessfulJobAt?: string;
  pendingJobs?: number;
  warnings?: string[];
};

type PrintJob = {
  id: string;
  deviceId?: string;
  jobType: string;
  status: string;
  attemptCount: number;
  errorMessage?: string;
  simulated: boolean;
  isReprint: boolean;
  createdAt: string;
};

type DeviceEvent = {
  id: string;
  type: string;
  simulated: boolean;
  createdAt: string;
  deviceId: string;
};

type Connector = {
  id: string;
  name: string;
  displayStatus?: string;
  status: string;
  version?: string;
  hostname?: string;
  lastHeartbeatAt?: string;
  outletId: string;
  assignedDeviceCount?: number;
  assignedDeviceIds?: string[];
};

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "ok" | "warn" | "bad" | "sim" | "phys";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-800"
      : tone === "warn"
        ? "bg-amber-50 text-amber-900"
        : tone === "sim"
          ? "bg-sky-50 text-sky-900"
          : tone === "phys"
            ? "bg-violet-50 text-violet-900"
            : "bg-rose-50 text-rose-800";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

export default function DevicesManager() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [events, setEvents] = useState<DeviceEvent[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [fleetSummary, setFleetSummary] = useState<{
    deviceCount: number;
    connectorCount: number;
    onlineConnectors: number;
    unassignedPhysical: number;
  } | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingExpires, setPairingExpires] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState<unknown>(null);
  const [previewLines, setPreviewLines] = useState<string[]>([]);
  const [editDeviceId, setEditDeviceId] = useState<string | null>(null);
  const [editHost, setEditHost] = useState("");
  const [editPort, setEditPort] = useState("9100");
  const [editWidth, setEditWidth] = useState("80");
  const [editEncoding, setEditEncoding] = useState("ascii");
  const [editStation, setEditStation] = useState("MAIN");
  const [editRole, setEditRole] = useState("RECEIPT");
  const [editDefault, setEditDefault] = useState(false);
  const [editFallback, setEditFallback] = useState(false);
  const [editConnectorId, setEditConnectorId] = useState("");
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");
  const [filterConn, setFilterConn] = useState("ALL");
  const [showRegister, setShowRegister] = useState(false);
  const [regName, setRegName] = useState("");
  const [regType, setRegType] = useState<"RECEIPT_PRINTER" | "KITCHEN_PRINTER">("RECEIPT_PRINTER");
  const [regRole, setRegRole] = useState("RECEIPT");
  const [regStation, setRegStation] = useState("MAIN");
  const [regConnectorId, setRegConnectorId] = useState("");
  const [regHost, setRegHost] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [dRes, jRes, eRes, cRes, fRes] = await Promise.all([
        fetch("/api/devices", { cache: "no-store" }),
        fetch("/api/devices/jobs", { cache: "no-store" }),
        fetch("/api/devices/events", { cache: "no-store" }),
        fetch("/api/devices/connectors", { cache: "no-store" }),
        fetch("/api/devices/fleet", { cache: "no-store" }),
      ]);
      const dJson = (await dRes.json()) as { success: boolean; data?: Device[]; error?: string };
      const jJson = (await jRes.json()) as { success: boolean; data?: PrintJob[]; error?: string };
      const eJson = (await eRes.json()) as { success: boolean; data?: DeviceEvent[]; error?: string };
      const cJson = (await cRes.json()) as { success: boolean; data?: Connector[]; error?: string };
      const fJson = (await fRes.json()) as {
        success: boolean;
        data?: {
          devices?: Device[];
          connectors?: Connector[];
          summary?: {
            deviceCount: number;
            connectorCount: number;
            onlineConnectors: number;
            unassignedPhysical: number;
          };
        };
        error?: string;
      };
      if (!dRes.ok || !dJson.success) throw new Error(dJson.error ?? "Failed to load devices");
      if (fRes.ok && fJson.success && fJson.data) {
        setDevices(fJson.data.devices ?? dJson.data ?? []);
        setConnectors(fJson.data.connectors ?? cJson.data ?? []);
        setFleetSummary(fJson.data.summary ?? null);
      } else {
        setDevices(dJson.data ?? []);
        if (cRes.ok && cJson.success) setConnectors(cJson.data ?? []);
      }
      if (jRes.ok && jJson.success) setJobs(jJson.data ?? []);
      if (eRes.ok && eJson.success) setEvents(eJson.data ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Load failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return devices.filter((d) => {
      if (filterRole !== "ALL" && (d.printerRole ?? "") !== filterRole) return false;
      if (filterConn === "UNASSIGNED" && !d.warnings?.includes("unassigned_connector")) return false;
      if (filterConn === "OFFLINE" && d.connectionStatus === "CONNECTED") return false;
      if (filterConn === "REVOKED" && !d.warnings?.includes("connector_revoked")) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.deviceType.toLowerCase().includes(q) ||
        (d.kitchenStation ?? "").toLowerCase().includes(q) ||
        (d.printerRole ?? "").toLowerCase().includes(q) ||
        String(d.configuration?.host ?? "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [devices, search, filterRole, filterConn]);

  const createPairing = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/devices/connectors/pairing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { code: string; expiresAt: string };
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? "Pairing failed");
      setPairingCode(json.data.code);
      setPairingExpires(json.data.expiresAt);
      setMessage("Pairing code created — enter it on the Windows connector within 10 minutes.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pairing failed");
    } finally {
      setBusy(false);
    }
  };

  const revokeConnector = async (connectorId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/devices/connectors/${connectorId}/revoke`, { method: "POST" });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Revoke failed");
      setMessage("Connector revoked");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Revoke failed");
    } finally {
      setBusy(false);
    }
  };

  const downloadDiagnostics = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/devices/diagnostics", { cache: "no-store" });
      const json = (await res.json()) as { success: boolean; data?: unknown; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Diagnostics failed");
      const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tronx-device-diagnostics-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Diagnostics exported (secrets redacted)");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Diagnostics failed");
    } finally {
      setBusy(false);
    }
  };

  const runPilot = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/devices/pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json()) as { success: boolean; data?: unknown; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Pilot failed");
      setLastResult(json.data);
      setMessage(
        "Hardware pilot run recorded — physical steps remain PENDING_PHYSICAL until confirmed on paper.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pilot failed");
    } finally {
      setBusy(false);
    }
  };

  const openEditor = (device: Device) => {
    setEditDeviceId(device.id);
    setEditHost(String(device.configuration?.host ?? ""));
    setEditPort(String(device.configuration?.port ?? 9100));
    setEditWidth(String(device.configuration?.paperWidth ?? 80));
    setEditEncoding(String(device.configuration?.encoding ?? "ascii"));
    setEditStation(device.kitchenStation ?? "MAIN");
    setEditRole(device.printerRole ?? (device.deviceType === "KITCHEN_PRINTER" ? "KITCHEN" : "RECEIPT"));
    setEditDefault(Boolean(device.configuration?.isDefault));
    setEditFallback(Boolean(device.configuration?.isFallback));
    setEditConnectorId(String(device.configuration?.connectorId ?? ""));
  };

  const saveDeviceConfig = async () => {
    if (!editDeviceId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/devices/${editDeviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kitchenStation: editRole === "RECEIPT" || editRole === "SECONDARY_RECEIPT" ? undefined : editStation,
          printerRole: editRole,
          configuration: {
            host: editHost,
            port: Number(editPort),
            paperWidth: Number(editWidth),
            encoding: editEncoding,
            isDefault: editDefault,
            isFallback: editFallback,
          },
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Save failed");

      if (editConnectorId) {
        const assignRes = await fetch(`/api/devices/${editDeviceId}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectorId: editConnectorId }),
        });
        const assignJson = (await assignRes.json()) as { success: boolean; error?: string };
        if (!assignRes.ok || !assignJson.success) throw new Error(assignJson.error ?? "Assign failed");
      }

      setMessage("Printer configuration saved");
      setEditDeviceId(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const registerPrinter = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName,
          deviceType: regType,
          printerRole: regRole,
          kitchenStation: regType === "KITCHEN_PRINTER" ? regStation : undefined,
          connectorId: regConnectorId || undefined,
          configuration: {
            host: regHost,
            port: 9100,
            paperWidth: 80,
            encoding: "ascii",
          },
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Register failed");
      setMessage("Printer registered");
      setShowRegister(false);
      setRegName("");
      setRegHost("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Register failed");
    } finally {
      setBusy(false);
    }
  };

  const previewDevice = async (deviceId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/devices/${deviceId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "TEST_PAGE",
          payload: {
            orderNumber: "PREVIEW",
            items: [{ name: "Preview item", qty: 1, total: 10 }],
            total: 10,
          },
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { previewLines?: string[] };
        error?: string;
      };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Preview failed");
      setPreviewLines(json.data?.previewLines ?? []);
      setMessage("Print preview generated (not sent to printer)");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const rotateConnector = async (connectorId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/devices/connectors/${connectorId}/rotate`, { method: "POST" });
      const json = (await res.json()) as {
        success: boolean;
        data?: { connectorSecret?: string; note?: string };
        error?: string;
      };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Rotate failed");
      setLastResult(json.data);
      setMessage(json.data?.note ?? "Credentials rotated — reconfigure connector with new secret");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rotate failed");
    } finally {
      setBusy(false);
    }
  };

  const registerSamples = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/devices/sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { message?: string };
        error?: string;
      };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Register failed");
      setMessage(json.data?.message ?? "Sample devices registered");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Register failed");
    } finally {
      setBusy(false);
    }
  };

  const command = async (deviceId: string, name: string, payload?: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/devices/${deviceId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, payload }),
      });
      const json = (await res.json()) as { success: boolean; data?: unknown; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Command failed");
      setLastResult(json.data);
      setMessage(`Command ${name} executed`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Command failed");
    } finally {
      setBusy(false);
    }
  };

  const reconnect = async (deviceId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/devices/${deviceId}/reconnect`, { method: "POST" });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Reconnect failed");
      setMessage("Reconnected");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reconnect failed");
    } finally {
      setBusy(false);
    }
  };

  const retryJob = async (jobId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/devices/jobs/${jobId}/retry`, { method: "POST" });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Retry failed");
      setMessage("Print job retried");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  };

  const fallbackJob = async (jobId: string) => {
    const fallback = devices.find(
      (d) => d.configuration?.isFallback === true || d.printerRole === "SECONDARY_RECEIPT",
    );
    if (!fallback) {
      setError("No fallback/SECONDARY_RECEIPT printer configured.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/devices/jobs/${jobId}/fallback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fallbackDeviceId: fallback.id }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Fallback failed");
      setMessage(`Authorized fallback queued on ${fallback.name}`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Fallback failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
        <p className="font-semibold">Multi-device / multi-connector fleet</p>
        <p className="mt-1">
          Simulated devices stay labelled <strong>SIMULATED</strong>. Physical printers require a paired
          connector. Successful API responses are not proof of paper output — confirm on-site for{" "}
          <strong>PHYSICALLY_VERIFIED</strong>.
        </p>
        {fleetSummary ? (
          <p className="mt-2 text-xs">
            Fleet: {fleetSummary.deviceCount} devices · {fleetSummary.connectorCount} connectors (
            {fleetSummary.onlineConnectors} online)
            {fleetSummary.unassignedPhysical
              ? ` · ${fleetSummary.unassignedPhysical} physical printer(s) unassigned`
              : ""}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="h-10 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold disabled:opacity-50"
        >
          Refresh
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void registerSamples()}
          className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          Register sample simulator devices
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setShowRegister((v) => !v)}
          className="h-10 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold disabled:opacity-50"
        >
          Register printer
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void createPairing()}
          className="h-10 rounded-xl border border-violet-300 bg-violet-50 px-4 text-sm font-semibold text-violet-950 disabled:opacity-50"
        >
          Add Local Connector (pairing code)
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void downloadDiagnostics()}
          className="h-10 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold disabled:opacity-50"
        >
          Export diagnostics
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void runPilot()}
          className="h-10 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-950 disabled:opacity-50"
        >
          Run hardware pilot (guided)
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-xs grow min-w-[12rem]">
          Search
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, role, station, IP…"
          />
        </label>
        <label className="text-xs">
          Role
          <select
            className="mt-1 block rounded-lg border px-3 py-2 text-sm"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            {["ALL", "RECEIPT", "SECONDARY_RECEIPT", "KITCHEN", "BAR", "OTHER"].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Status
          <select
            className="mt-1 block rounded-lg border px-3 py-2 text-sm"
            value={filterConn}
            onChange={(e) => setFilterConn(e.target.value)}
          >
            <option value="ALL">ALL</option>
            <option value="UNASSIGNED">Unassigned connector</option>
            <option value="OFFLINE">Not connected</option>
            <option value="REVOKED">Revoked connector</option>
          </select>
        </label>
      </div>

      <p className="text-xs text-neutral-500">
        Jobs: pending {jobs.filter((j) => j.status === "QUEUED" || j.status === "PROCESSING").length} ·
        failed {jobs.filter((j) => j.status === "FAILED").length} · unknown/review{" "}
        {jobs.filter((j) => j.status === "UNKNOWN" || j.status === "MANUAL_REVIEW").length}
      </p>

      {showRegister ? (
        <section className="rounded-2xl border border-neutral-300 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold">Register printer</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs">
              Name
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
              />
            </label>
            <label className="text-xs">
              Type
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={regType}
                onChange={(e) => {
                  const t = e.target.value as "RECEIPT_PRINTER" | "KITCHEN_PRINTER";
                  setRegType(t);
                  setRegRole(t === "KITCHEN_PRINTER" ? "KITCHEN" : "RECEIPT");
                }}
              >
                <option value="RECEIPT_PRINTER">Receipt printer</option>
                <option value="KITCHEN_PRINTER">Kitchen printer</option>
              </select>
            </label>
            <label className="text-xs">
              Role
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={regRole}
                onChange={(e) => setRegRole(e.target.value)}
              >
                {(regType === "RECEIPT_PRINTER"
                  ? ["RECEIPT", "SECONDARY_RECEIPT", "OTHER"]
                  : ["KITCHEN", "BAR", "OTHER"]
                ).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            {regType === "KITCHEN_PRINTER" ? (
              <label className="text-xs">
                Station
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={regStation}
                  onChange={(e) => setRegStation(e.target.value.toUpperCase())}
                  placeholder="MAIN / BAR / DESSERT / custom"
                />
              </label>
            ) : null}
            <label className="text-xs">
              Connector
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={regConnectorId}
                onChange={(e) => setRegConnectorId(e.target.value)}
              >
                <option value="">Simulator (no connector)</option>
                {connectors
                  .filter((c) => c.displayStatus !== "REVOKED")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.displayStatus})
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-xs">
              IP / host
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={regHost}
                onChange={(e) => setRegHost(e.target.value)}
                placeholder="10.0.0.50"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
              disabled={busy || !regName.trim()}
              onClick={() => void registerPrinter()}
            >
              Create
            </button>
            <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => setShowRegister(false)}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {pairingCode ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm">
          <p className="font-semibold text-violet-950">Pairing code (single-use)</p>
          <p className="mt-2 font-mono text-2xl tracking-widest text-violet-900">{pairingCode}</p>
          <p className="mt-1 text-xs text-violet-800">
            Expires {pairingExpires ? new Date(pairingExpires).toLocaleString() : "soon"}. Enter on the
            Windows connector: <code>npm run pair</code>
          </p>
        </div>
      ) : null}

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900">Local connectors</h2>
        {connectors.length === 0 ? (
          <p className="text-sm text-neutral-500">No connectors paired yet.</p>
        ) : (
          <ul className="space-y-3">
            {connectors.map((conn) => (
              <li key={conn.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{conn.name}</p>
                    <p className="text-xs text-neutral-500">
                      {conn.hostname ?? "host unknown"} · v{conn.version ?? "?"} · outlet {conn.outletId}
                      {typeof conn.assignedDeviceCount === "number"
                        ? ` · ${conn.assignedDeviceCount} device(s)`
                        : ""}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Last heartbeat:{" "}
                      {conn.lastHeartbeatAt ? new Date(conn.lastHeartbeatAt).toLocaleString() : "never"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone="phys">PHYSICAL CONNECTOR</Badge>
                    <Badge
                      tone={
                        conn.displayStatus === "ONLINE"
                          ? "ok"
                          : conn.displayStatus === "REVOKED" || conn.displayStatus === "DEGRADED"
                            ? conn.displayStatus === "DEGRADED"
                              ? "warn"
                              : "bad"
                            : "warn"
                      }
                    >
                      {conn.displayStatus === "OFFLINE"
                        ? "CONNECTOR_OFFLINE"
                        : conn.displayStatus ?? conn.status}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                    disabled={busy}
                    onClick={() => void rotateConnector(conn.id)}
                  >
                    Rotate credentials
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium text-rose-700"
                    disabled={busy}
                    onClick={() => void revokeConnector(conn.id)}
                  >
                    Revoke
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900">
          Device inventory ({filteredDevices.length}/{devices.length})
        </h2>
        {filteredDevices.length === 0 ? (
          <p className="text-sm text-neutral-500">No devices match filters. Register printers or clear filters.</p>
        ) : (
          <ul className="space-y-3">
            {filteredDevices.map((device) => (
              <li key={device.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{device.name}</p>
                    <p className="text-xs text-neutral-500">
                      {device.deviceType} · role {device.printerRole ?? "—"} · {device.manufacturer}{" "}
                      {device.model}
                      {device.kitchenStation ? ` · station ${device.kitchenStation}` : ""}
                      {device.configuration?.host ? ` · ${String(device.configuration.host)}` : ""}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Last success:{" "}
                      {device.lastSuccessfulJobAt
                        ? new Date(device.lastSuccessfulJobAt).toLocaleString()
                        : "none"}
                      {typeof device.pendingJobs === "number" ? ` · pending ${device.pendingJobs}` : ""}
                      {device.configuration?.connectorId
                        ? ` · connector ${String(device.configuration.connectorId).slice(0, 12)}…`
                        : ""}
                    </p>
                    {device.warnings?.length ? (
                      <p className="mt-1 text-xs font-medium text-amber-800">
                        Warnings: {device.warnings.join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {device.simulated ? <Badge tone="sim">SIMULATED</Badge> : <Badge tone="phys">PHYSICAL</Badge>}
                    <Badge
                      tone={
                        device.connectionStatus === "CONNECTED"
                          ? "ok"
                          : device.connectionStatus === "DISABLED"
                            ? "warn"
                            : "bad"
                      }
                    >
                      {device.connectionStatus === "DISCONNECTED" && !device.simulated
                        ? "DEVICE_ERROR / DISCONNECTED"
                        : device.connectionStatus}
                    </Badge>
                    <Badge
                      tone={
                        device.healthStatus === "HEALTHY"
                          ? "ok"
                          : device.healthStatus === "DEGRADED"
                            ? "warn"
                            : "bad"
                      }
                    >
                      {device.healthStatus}
                    </Badge>
                    {!device.enabled ? <Badge tone="warn">Disabled</Badge> : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                    disabled={busy}
                    onClick={() => void reconnect(device.id)}
                  >
                    Reconnect
                  </button>
                  {(device.deviceType === "RECEIPT_PRINTER" || device.deviceType === "KITCHEN_PRINTER") && (
                    <>
                      <button
                        type="button"
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                        disabled={busy}
                        onClick={() => openEditor(device)}
                      >
                        Configure / assign
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                        disabled={busy}
                        onClick={() => void previewDevice(device.id)}
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                        disabled={busy}
                        onClick={() =>
                          void command(device.id, "PRINT", {
                            orderNumber: "TEST",
                            items: [{ name: "Test item", qty: 1, total: 10 }],
                            subtotal: 10,
                            discount: 0,
                            tax: 0,
                            total: 10,
                            jobType: "TEST_PAGE",
                          })
                        }
                      >
                        Test print
                      </button>
                      {device.simulated ? (
                        <>
                          <button
                            type="button"
                            className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                            disabled={busy}
                            onClick={() => void command(device.id, "SIMULATE_PRINT_FAIL")}
                          >
                            Simulate print failure
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                            disabled={busy}
                            onClick={() => void command(device.id, "SIMULATE_PAPER_OUT")}
                          >
                            Simulate paper out
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                            disabled={busy}
                            onClick={() => void command(device.id, "SIMULATE_RECOVER")}
                          >
                            Recover
                          </button>
                        </>
                      ) : null}
                    </>
                  )}
                  {device.deviceType === "CASH_DRAWER" && (
                    <button
                      type="button"
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                      disabled={busy}
                      onClick={() => void command(device.id, "OPEN_DRAWER", { authorized: true })}
                    >
                      Simulate drawer open
                    </button>
                  )}
                  {device.deviceType === "BARCODE_SCANNER" && (
                    <button
                      type="button"
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                      disabled={busy}
                      onClick={() =>
                        void command(device.id, "SCAN", {
                          barcode: "ING-TOMATO-001",
                          lookupResult: { kind: "ingredient", name: "Tomato" },
                        })
                      }
                    >
                      Simulate barcode scan
                    </button>
                  )}
                  {device.deviceType === "PAYMENT_TERMINAL" && (
                    <>
                      <button
                        type="button"
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                        disabled={busy}
                        onClick={() =>
                          void command(device.id, "PAYMENT_REQUEST", {
                            amount: 100,
                            outcome: "APPROVED",
                            callbackId: `cb-${Date.now()}`,
                          })
                        }
                      >
                        Simulate payment approve
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                        disabled={busy}
                        onClick={() =>
                          void command(device.id, "PAYMENT_REQUEST", {
                            amount: 100,
                            outcome: "DECLINED",
                            callbackId: `cb-${Date.now()}`,
                          })
                        }
                      >
                        Simulate payment decline
                      </button>
                    </>
                  )}
                  {device.deviceType === "CUSTOMER_DISPLAY" && (
                    <button
                      type="button"
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                      disabled={busy}
                      onClick={() =>
                        void command(device.id, "DISPLAY_UPDATE", {
                          items: [{ name: "Thali", qty: 1 }],
                          subtotal: 150,
                          discount: 0,
                          tax: 7.5,
                          total: 157.5,
                          paymentStatus: "UNPAID",
                        })
                      }
                    >
                      Update display
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Print job history</h2>
          <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-xs text-neutral-700">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-2">
                <span>
                  {job.jobType} · {job.status}
                  {job.isReprint ? " · REPRINT" : ""}
                  {job.simulated ? " · SIMULATED" : " · PHYSICAL"}
                  {job.errorMessage ? ` · ${job.errorMessage}` : ""}
                </span>
                <span className="flex shrink-0 gap-2">
                  {job.status === "FAILED" ? (
                    <>
                      <button
                        type="button"
                        className="font-semibold text-sky-700"
                        disabled={busy}
                        onClick={() => void retryJob(job.id)}
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        className="font-semibold text-violet-700"
                        disabled={busy}
                        onClick={() => void fallbackJob(job.id)}
                      >
                        Fallback
                      </button>
                    </>
                  ) : null}
                  {job.status === "UNKNOWN" || job.status === "MANUAL_REVIEW" ? (
                    <span className="font-semibold text-amber-800">Needs review</span>
                  ) : null}
                </span>
              </li>
            ))}
            {jobs.length === 0 ? <li className="text-neutral-500">No print jobs yet.</li> : null}
          </ul>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Device activity</h2>
          <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-xs text-neutral-700">
            {events.map((event) => (
              <li key={event.id}>
                {event.type} · {event.simulated ? "SIMULATED" : "PHYSICAL"} ·{" "}
                {new Date(event.createdAt).toLocaleString()}
              </li>
            ))}
            {events.length === 0 ? <li className="text-neutral-500">No activity yet.</li> : null}
          </ul>
        </div>
      </section>

      {editDeviceId ? (
        <section className="rounded-2xl border border-neutral-300 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold">Printer configuration & assignment</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs">
              IP / host
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={editHost}
                onChange={(e) => setEditHost(e.target.value)}
              />
            </label>
            <label className="text-xs">
              Port
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={editPort}
                onChange={(e) => setEditPort(e.target.value)}
              />
            </label>
            <label className="text-xs">
              Paper width
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={editWidth}
                onChange={(e) => setEditWidth(e.target.value)}
              >
                <option value="58">58mm</option>
                <option value="80">80mm</option>
              </select>
            </label>
            <label className="text-xs">
              Encoding
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={editEncoding}
                onChange={(e) => setEditEncoding(e.target.value)}
              >
                <option value="ascii">ascii</option>
                <option value="utf8">utf8</option>
                <option value="cp437">cp437</option>
              </select>
            </label>
            <label className="text-xs">
              Printer role
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
              >
                {["RECEIPT", "SECONDARY_RECEIPT", "KITCHEN", "BAR", "OTHER"].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Kitchen station
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={editStation}
                onChange={(e) => setEditStation(e.target.value.toUpperCase())}
                disabled={editRole === "RECEIPT" || editRole === "SECONDARY_RECEIPT"}
              />
            </label>
            <label className="text-xs md:col-span-2">
              Assigned connector
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={editConnectorId}
                onChange={(e) => setEditConnectorId(e.target.value)}
              >
                <option value="">— none —</option>
                {connectors
                  .filter((c) => c.displayStatus !== "REVOKED")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.displayStatus})
                    </option>
                  ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs mt-6">
              <input
                type="checkbox"
                checked={editDefault}
                onChange={(e) => setEditDefault(e.target.checked)}
              />
              Default printer
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={editFallback}
                onChange={(e) => setEditFallback(e.target.checked)}
              />
              Authorized fallback printer
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
              disabled={busy}
              onClick={() => void saveDeviceConfig()}
            >
              Save
            </button>
            <button
              type="button"
              className="rounded-xl border px-4 py-2 text-sm"
              onClick={() => setEditDeviceId(null)}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {previewLines.length ? (
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <h2 className="text-sm font-semibold">Print preview</h2>
          <pre className="mt-2 max-h-56 overflow-auto font-mono text-xs">{previewLines.join("\n")}</pre>
        </section>
      ) : null}

      {lastResult ? (
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <h2 className="text-sm font-semibold">Last command / pilot result</h2>
          <pre className="mt-2 max-h-48 overflow-auto text-xs">{JSON.stringify(lastResult, null, 2)}</pre>
        </section>
      ) : null}
    </div>
  );
}
