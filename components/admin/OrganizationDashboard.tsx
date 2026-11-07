"use client";

import { useEffect, useState, type FormEvent } from "react";

type OutletRow = {
  restaurantId: string;
  name: string;
  slug: string;
  grossSales: number;
  activeOrderCount: number;
};

type Props = { restaurantName: string };

export default function OrganizationDashboard({ restaurantName }: Props) {
  const [organization, setOrganization] = useState<{ id: string; name: string; slug: string } | null>(
    null,
  );
  const [outlets, setOutlets] = useState<OutletRow[]>([]);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [syncJobs, setSyncJobs] = useState<{ id: string; status: string; snapshotSummary?: string }[]>(
    [],
  );

  async function refresh() {
    const [orgRes, syncRes] = await Promise.all([
      fetch("/api/organization"),
      fetch("/api/organization/menu-sync"),
    ]);
    const orgJson = await orgRes.json();
    if (orgJson.success) {
      setOrganization(orgJson.data.organization);
      setOutlets(orgJson.data.comparison?.outlets ?? []);
    }
    if (syncRes.ok) {
      const syncJson = await syncRes.json();
      if (syncJson.success) setSyncJobs(syncJson.data);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createOrg(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/organization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: orgName, slug: orgSlug }),
    });
    const json = await response.json();
    if (!json.success) {
      setMessage(json.error || "Could not create organization");
      return;
    }
    setMessage(`Organization ${json.data.name} created and this outlet attached`);
    await refresh();
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Organization</p>
        <h1 className="font-serif text-3xl text-neutral-900">{restaurantName}</h1>
      </header>
      {message ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm">{message}</p>
      ) : null}

      {!organization ? (
        <form onSubmit={createOrg} className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 md:grid-cols-3">
          <input
            required
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Organization name"
            className="min-h-11 rounded-xl border border-neutral-200 px-3"
          />
          <input
            required
            value={orgSlug}
            onChange={(e) => setOrgSlug(e.target.value)}
            placeholder="org-slug"
            className="min-h-11 rounded-xl border border-neutral-200 px-3 font-mono"
          />
          <button type="submit" className="min-h-11 rounded-xl bg-neutral-900 text-white">
            Create & attach
          </button>
        </form>
      ) : (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="text-lg font-semibold">{organization.name}</h2>
          <p className="text-sm text-neutral-500">/{organization.slug}</p>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {outlets.map((outlet) => (
          <a
            key={outlet.restaurantId}
            href={`/admin/${outlet.slug}`}
            className="rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-400"
          >
            <p className="font-semibold">{outlet.name}</p>
            <p className="mt-2 text-sm text-neutral-600">Sales {outlet.grossSales.toFixed(2)}</p>
            <p className="text-sm text-neutral-600">Orders {outlet.activeOrderCount}</p>
          </a>
        ))}
        {organization && outlets.length === 0 ? (
          <p className="col-span-full text-sm text-neutral-500">No outlet comparison data yet.</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="font-semibold">Menu sync history</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {syncJobs.map((job) => (
            <li key={job.id} className="flex justify-between border-b border-neutral-100 pb-2">
              <span>{job.status}</span>
              <span className="text-neutral-500">{job.snapshotSummary ?? job.id}</span>
            </li>
          ))}
          {syncJobs.length === 0 ? (
            <li className="text-neutral-500">No sync jobs. Create via `/api/organization/menu-sync`.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
