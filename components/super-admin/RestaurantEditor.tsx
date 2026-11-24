"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type {
  Restaurant,
  RestaurantTheme,
  FeatureKey,
  SubscriptionPlan,
} from "@/types";
import { DEFAULT_PLAN, PLAN_ENTITLEMENTS, hasRestaurantFeature } from "@/lib/features";
import { FEATURE_GROUPS, FEATURE_LABELS } from "@/lib/super-admin/feature-labels";
import type { RestaurantEnrichmentProposal } from "@/lib/services/restaurant-enrichment.service";

const featureKeys: FeatureKey[] = FEATURE_GROUPS.flatMap((group) => group.keys);

type RestaurantFields = {
  name: string;
  slug: string;
  description: string;
  tagline: string;
  logo: string;
  coverImage: string;
  phone: string;
  email: string;
  address: string;
  openingHours: string;
  currency: string;
  socialLinks: {
    instagram: string;
    facebook: string;
    twitter: string;
    website: string;
  };
  isOpen: boolean;
  isActive: boolean;
  subscriptionEnabled: boolean;
  subscriptionPlan: Restaurant["subscriptionPlan"];
  featureOverrides: Partial<Record<FeatureKey, boolean>>;
  theme: RestaurantTheme;
};

const emptyFields: RestaurantFields = {
  name: "",
  slug: "",
  description: "",
  tagline: "",
  logo: "",
  coverImage: "",
  phone: "",
  email: "",
  address: "",
  openingHours: "",
  currency: "INR",
  socialLinks: {
    instagram: "",
    facebook: "",
    twitter: "",
    website: "",
  },
  isOpen: true,
  isActive: true,
  subscriptionEnabled: true,
  subscriptionPlan: DEFAULT_PLAN,
  featureOverrides: {},
  theme: {
    primaryColor: "#602e31",
    secondaryColor: "#2d1719",
    accentColor: "#602e31",
    backgroundColor: "#ffffff",
    textColor: "#241416",
    buttonStyle: "filled",
    borderRadius: "rounded",
  },
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const inputClass = "w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-neutral-900 placeholder:text-neutral-400";

function SectionHeading({ step, title, body }: { step: number; title: string; body?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-neutral-900 text-xs font-bold text-white">{step}</span>
      <div>
        <h2 className="text-lg font-semibold leading-7">{title}</h2>
        {body ? <p className="text-xs text-neutral-500">{body}</p> : null}
      </div>
    </div>
  );
}

export default function RestaurantEditor({
  restaurant,
}: {
  restaurant?: Restaurant;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<RestaurantFields>(() =>
    restaurant
      ? {
          name: restaurant.name,
          slug: restaurant.slug,
          description: restaurant.description ?? "",
          tagline: restaurant.tagline ?? "",
          logo: restaurant.logo ?? restaurant.logoUrl ?? "",
          coverImage: restaurant.coverImage ?? restaurant.coverUrl ?? "",
          phone: restaurant.phone ?? "",
          email: restaurant.email ?? "",
          address: restaurant.address ?? "",
          openingHours: restaurant.openingHours ?? "",
          currency: restaurant.currency ?? "INR",
          socialLinks: {
            instagram: restaurant.socialLinks?.instagram ?? "",
            facebook: restaurant.socialLinks?.facebook ?? "",
            twitter: restaurant.socialLinks?.twitter ?? "",
            website: restaurant.socialLinks?.website ?? "",
          },
          isOpen: restaurant.isOpen,
          isActive: restaurant.isActive !== false,
          subscriptionEnabled: restaurant.subscriptionEnabled !== false,
          subscriptionPlan: restaurant.subscriptionPlan ?? DEFAULT_PLAN,
          featureOverrides: { ...restaurant.featureOverrides },
          theme: {
            primaryColor: restaurant.theme?.primaryColor ?? "#602e31",
            secondaryColor: restaurant.theme?.secondaryColor ?? "#2d1719",
            accentColor: restaurant.theme?.accentColor ?? "#602e31",
            backgroundColor: restaurant.theme?.backgroundColor ?? "#ffffff",
            textColor: restaurant.theme?.textColor ?? "#241416",
            buttonStyle: restaurant.theme?.buttonStyle ?? "filled",
            borderRadius: restaurant.theme?.borderRadius ?? "rounded",
          },
        }
      : emptyFields,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [slugEdited, setSlugEdited] = useState(Boolean(restaurant));
  const [enrichLocation, setEnrichLocation] = useState(restaurant?.address ?? "");
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [enrichment, setEnrichment] = useState<RestaurantEnrichmentProposal | null>(null);
  const [includeSuggestedCover, setIncludeSuggestedCover] = useState(false);

  const setField = <K extends keyof RestaurantFields>(
    key: K,
    value: RestaurantFields[K],
  ) => setFields((current) => ({ ...current, [key]: value }));

  const runEnrichment = async () => {
    setEnrichError(null);
    setEnrichment(null);
    setEnriching(true);
    try {
      const response = await fetch("/api/super-admin/restaurants/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fields.name || restaurant?.name || "",
          location: enrichLocation.trim() || undefined,
        }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        data?: RestaurantEnrichmentProposal;
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || "Enrichment failed");
      }
      setEnrichment(result.data);
      setIncludeSuggestedCover(false);
    } catch (cause) {
      setEnrichError(cause instanceof Error ? cause.message : "Enrichment failed");
    } finally {
      setEnriching(false);
    }
  };

  const applyEnrichment = () => {
    if (!enrichment) return;
    const p = enrichment.proposal;
    const nextName = p.name?.trim();
    const cover = includeSuggestedCover ? p.coverImageUrl?.trim() : undefined;
    const logo = includeSuggestedCover ? p.logoUrl?.trim() : undefined;
    setFields((current) => {
      const name = nextName || current.name;
      return {
        ...current,
        name,
        slug: !slugEdited && !restaurant && nextName ? slugify(nextName) : current.slug,
        tagline: p.tagline?.trim() || current.tagline,
        description: p.description?.trim() || current.description,
        address: p.address?.trim() || current.address,
        phone: p.phone?.trim() || current.phone,
        openingHours: p.openingHours?.trim() || current.openingHours,
        logo: logo || current.logo,
        coverImage: cover || current.coverImage,
        socialLinks: {
          ...current.socialLinks,
          website: p.socialLinks?.website?.trim() || current.socialLinks.website,
        },
      };
    });
    setEnrichment(null);
    setIncludeSuggestedCover(false);
  };

  const setName = (name: string) =>
    setFields((current) => ({ ...current, name, slug: slugEdited ? current.slug : slugify(name) }));

  const setSocialLink = (
    key: keyof RestaurantFields["socialLinks"],
    value: string,
  ) =>
    setFields((current) => ({
      ...current,
      socialLinks: { ...current.socialLinks, [key]: value },
    }));

  const setThemeField = (
    key: keyof RestaurantTheme,
    value: string,
  ) =>
    setFields((current) => ({
      ...current,
      theme: { ...current.theme, [key]: value },
    }));

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const response = await fetch(
        restaurant ? `/api/restaurants/${restaurant.id}` : "/api/restaurants",
        {
          method: restaurant ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        },
      );
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Restaurant could not be saved");
      }
      router.refresh();
      if (!restaurant) router.push(`/super-admin/restaurants#restaurant-${fields.slug}`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Restaurant could not be saved",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">
          {restaurant ? `Edit ${restaurant.name}` : "Add a restaurant"}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {restaurant
            ? "Changes go live on the guest menu as soon as you save."
            : "Only the name is required. After saving, you'll create the owner's login, and they can finish the menu from their own dashboard."}
        </p>
      </div>
      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p> : null}

      <section className="space-y-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Enrich from web</h2>
          <p className="mt-0.5 text-xs text-neutral-600">
            Looks up public OpenStreetMap + Wikipedia data. Review sources, then confirm before fields are filled — nothing is saved until you hit Save.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-1 text-xs text-neutral-600">
            Location hint (city / area / address)
            <input
              value={enrichLocation}
              onChange={(event) => setEnrichLocation(event.target.value)}
              placeholder="e.g. Hyderabad, Banjara Hills"
              className={inputClass}
            />
          </label>
          <button
            type="button"
            disabled={enriching || fields.name.trim().length < 2}
            onClick={() => void runEnrichment()}
            className="h-[42px] shrink-0 rounded-lg bg-sky-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {enriching ? "Searching…" : "Enrich from web"}
          </button>
        </div>
        {enrichError ? <p role="alert" className="text-xs text-rose-600">{enrichError}</p> : null}
        {enrichment ? (
          <div className="space-y-3 rounded-xl border border-sky-200 bg-white p-3 text-sm">
            <p className="text-xs font-medium text-neutral-700">Proposed fields (confirm to apply to this form)</p>
            <dl className="grid gap-1.5 text-xs text-neutral-600 sm:grid-cols-2">
              {enrichment.proposal.name ? <div><dt className="font-semibold text-neutral-800">Name</dt><dd>{enrichment.proposal.name}</dd></div> : null}
              {enrichment.proposal.tagline ? <div><dt className="font-semibold text-neutral-800">Tagline</dt><dd>{enrichment.proposal.tagline}</dd></div> : null}
              {enrichment.proposal.phone ? <div><dt className="font-semibold text-neutral-800">Phone</dt><dd>{enrichment.proposal.phone}</dd></div> : null}
              {enrichment.proposal.openingHours ? <div><dt className="font-semibold text-neutral-800">Hours</dt><dd>{enrichment.proposal.openingHours}</dd></div> : null}
              {enrichment.proposal.address ? <div className="sm:col-span-2"><dt className="font-semibold text-neutral-800">Address</dt><dd>{enrichment.proposal.address}</dd></div> : null}
              {enrichment.proposal.description ? <div className="sm:col-span-2"><dt className="font-semibold text-neutral-800">Description</dt><dd className="line-clamp-4">{enrichment.proposal.description}</dd></div> : null}
              {enrichment.proposal.coverImageUrl ? <div className="sm:col-span-2"><dt className="font-semibold text-neutral-800">Suggested cover</dt><dd className="truncate font-mono">{enrichment.proposal.coverImageUrl}</dd></div> : null}
              {enrichment.proposal.socialLinks?.website ? <div className="sm:col-span-2"><dt className="font-semibold text-neutral-800">Website</dt><dd className="truncate">{enrichment.proposal.socialLinks.website}</dd></div> : null}
            </dl>
            {enrichment.sources.length > 0 ? (
              <ul className="flex flex-wrap gap-2 text-[11px]">
                {enrichment.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noreferrer" className="font-medium text-sky-700 underline underline-offset-2">
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {enrichment.notes.length > 0 ? (
              <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-neutral-500">
                {enrichment.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
            <p className="text-[11px] text-neutral-500">{enrichment.photoAutomation.summary}</p>
            {enrichment.proposal.coverImageUrl || enrichment.proposal.logoUrl ? (
              <label className="flex items-start gap-2 text-[11px] text-neutral-700">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={includeSuggestedCover}
                  onChange={(event) => setIncludeSuggestedCover(event.target.checked)}
                />
                <span>
                  Also apply suggested public image URLs (Wikipedia/Wikimedia). Confirm rights and brand fit before Save — never auto-scraped into production.
                </span>
              </label>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={applyEnrichment} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white">
                Apply text fields (still needs Save)
              </button>
              <button
                type="button"
                onClick={() => {
                  setEnrichment(null);
                  setIncludeSuggestedCover(false);
                }}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700"
              >
                Discard
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <SectionHeading step={1} title="Basics" body="What guests see first." />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm text-neutral-600">
            Restaurant name
            <input
              required
              minLength={2}
              value={fields.name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Blue Door Café"
              className={inputClass}
            />
          </label>
          <label className="space-y-1.5 text-sm text-neutral-600">
            Menu address
            <input
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              title="Lowercase letters, numbers and dashes only"
              value={fields.slug}
              onChange={(event) => {
                setSlugEdited(true);
                setField("slug", event.target.value.toLowerCase());
              }}
              placeholder="blue-door-cafe"
              className={`${inputClass} font-mono text-xs`}
            />
            <span className="block truncate text-xs text-neutral-400">Guest menu: /menu/{fields.slug || "your-restaurant"}</span>
          </label>
          <label className="space-y-1.5 text-sm text-neutral-600 sm:col-span-2">
            Tagline
            <input
              value={fields.tagline}
              onChange={(event) => setField("tagline", event.target.value)}
              placeholder="Wood-fired pizza & craft coffee"
              className={inputClass}
            />
          </label>
          <label className="space-y-1.5 text-sm text-neutral-600 sm:col-span-2">
            Description
            <textarea
              rows={3}
              value={fields.description}
              onChange={(event) => setField("description", event.target.value)}
              placeholder="A short paragraph about the place, the food and the vibe."
              className={inputClass}
            />
          </label>
          <label className="space-y-1.5 text-sm text-neutral-600">
            Logo URL
            <input
              type="url"
              value={fields.logo}
              onChange={(event) => setField("logo", event.target.value)}
              placeholder="https://…/logo.png"
              className={inputClass}
            />
          </label>
          <label className="space-y-1.5 text-sm text-neutral-600">
            Cover photo URL
            <input
              type="url"
              value={fields.coverImage}
              onChange={(event) => setField("coverImage", event.target.value)}
              placeholder="https://…/cover.jpg"
              className={inputClass}
            />
          </label>
        </div>
        <p className="text-xs text-neutral-400">The owner can also upload the logo and cover later from their dashboard.</p>
      </section>

      <section className="space-y-4 border-t border-neutral-200 pt-6">
        <SectionHeading step={2} title="Contact & hours" body="Powers the Call, Directions and Open now buttons on the menu." />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm text-neutral-600">
            Phone
            <input
              type="tel"
              value={fields.phone}
              onChange={(event) => setField("phone", event.target.value)}
              placeholder="+91 98765 43210"
              className={inputClass}
            />
          </label>
          <label className="space-y-1.5 text-sm text-neutral-600">
            Email
            <input
              type="email"
              value={fields.email}
              onChange={(event) => setField("email", event.target.value)}
              placeholder="hello@restaurant.com"
              className={inputClass}
            />
          </label>
          <label className="space-y-1.5 text-sm text-neutral-600">
            Opening hours
            <input
              value={fields.openingHours}
              onChange={(event) => setField("openingHours", event.target.value)}
              placeholder="11:00 AM - 11:00 PM"
              className={inputClass}
            />
          </label>
          <label className="space-y-1.5 text-sm text-neutral-600">
            Currency
            <input
              maxLength={10}
              value={fields.currency}
              onChange={(event) => setField("currency", event.target.value.toUpperCase())}
              placeholder="INR"
              className={inputClass}
            />
          </label>
          <label className="space-y-1.5 text-sm text-neutral-600 sm:col-span-2">
            Address
            <textarea
              rows={2}
              value={fields.address}
              onChange={(event) => setField("address", event.target.value)}
              placeholder="Street, area, city"
              className={inputClass}
            />
          </label>
        </div>
      </section>

      <section className="space-y-4 border-t border-neutral-200 pt-6">
        <SectionHeading step={3} title="Social links" body="Optional. Shown in the menu footer." />
        <div className="grid gap-4 sm:grid-cols-2">
          {(["instagram", "facebook", "twitter", "website"] as const).map(
            (network) => (
              <label
                key={network}
                className="space-y-1.5 text-sm capitalize text-neutral-600"
              >
                {network}
                <input
                  type="url"
                  value={fields.socialLinks[network]}
                  onChange={(event) => setSocialLink(network, event.target.value)}
                  placeholder="https://"
                  className={inputClass}
                />
              </label>
            ),
          )}
        </div>
      </section>

      <section className="space-y-4 border-t border-neutral-200 pt-6">
        <SectionHeading step={4} title="Status" />
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={fields.isOpen}
              onChange={(event) => setField("isOpen", event.target.checked)}
            />
            Open for orders
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={fields.isActive}
              onChange={(event) => setField("isActive", event.target.checked)}
            />
            Live on the platform
          </label>
        </div>
      </section>
      <div className="space-y-4 border-t border-neutral-200 pt-6">
        <SectionHeading step={5} title="Plan & features" body="Pick a plan, then switch individual features on or off if needed." />
        <div role="radiogroup" aria-label="Subscription plan" className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(PLAN_ENTITLEMENTS) as SubscriptionPlan[]).map((plan) => {
            const selected = (fields.subscriptionPlan ?? DEFAULT_PLAN) === plan;
            return (
              <button
                key={plan}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setField("subscriptionPlan", plan)}
                className={`rounded-xl border p-3 text-left transition ${selected ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400"}`}
              >
                <span className="block text-sm font-bold capitalize">{plan.toLowerCase()}</span>
                <span className={`block text-xs ${selected ? "text-white/70" : "text-neutral-500"}`}>{PLAN_ENTITLEMENTS[plan].length} of {featureKeys.length} features</span>
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" checked={fields.subscriptionEnabled} onChange={(event) => setField("subscriptionEnabled", event.target.checked)} />
          Subscription {fields.subscriptionEnabled ? "ON" : "OFF"}
        </label>
        <div className="space-y-5">
          <p className="text-sm font-medium text-neutral-600">
            Features · <span className="font-semibold text-neutral-900">Offers & Discounts</span> is its own section (festival % off on menu) — separate from CRM loyalty coupons
          </p>
          {FEATURE_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{group.title}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.keys.map((feature) => {
                  const effective = hasRestaurantFeature(fields, feature);
                  const override = fields.featureOverrides[feature];
                  const planAccess = PLAN_ENTITLEMENTS[fields.subscriptionPlan ?? DEFAULT_PLAN].includes(feature);
                  const configuredAccess = override ?? planAccess;
                  const label = FEATURE_LABELS[feature];
                  return (
                    <div key={feature} className="rounded-lg border border-neutral-200 p-3 text-sm text-neutral-700">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{label}</p>
                          <p className="font-mono text-[10px] text-neutral-400">{feature}</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={configuredAccess}
                          aria-label={`${label} feature setting`}
                          onClick={() =>
                            setFields((current) => ({
                              ...current,
                              featureOverrides: { ...current.featureOverrides, [feature]: !configuredAccess },
                            }))
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${configuredAccess ? "bg-neutral-900" : "bg-neutral-300"}`}
                        >
                          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${configuredAccess ? "translate-x-6" : "translate-x-1"}`} />
                          <span className="sr-only">{configuredAccess ? "ON" : "OFF"}</span>
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500">
                        <span>
                          Effective:{" "}
                          <strong className={effective ? "text-emerald-700" : "text-neutral-600"}>
                            {effective ? "ON" : "OFF"}
                          </strong>
                        </span>
                        <span>
                          {override === true
                            ? "Override: ON"
                            : override === false
                              ? "Override: OFF"
                              : `Plan default (${planAccess ? "ON" : "OFF"})`}
                        </span>
                      </div>
                      {override !== undefined ? (
                        <button
                          type="button"
                          onClick={() =>
                            setFields((current) => {
                              const featureOverrides = { ...current.featureOverrides };
                              delete featureOverrides[feature];
                              return { ...current, featureOverrides };
                            })
                          }
                          className="mt-2 text-[11px] font-medium text-sky-700 underline underline-offset-2"
                        >
                          Use plan default
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4 border-t border-neutral-200 pt-6">
        <SectionHeading step={6} title="Brand colours" body="Applied when the subscription and the Custom theme feature are on. Otherwise the clean TRONX theme is used." />
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["primaryColor", "Primary Color", "#602e31"],
              ["secondaryColor", "Secondary Color", "#2d1719"],
              ["accentColor", "Accent Color", "#602e31"],
              ["backgroundColor", "Background Color", "#ffffff"],
              ["textColor", "Text Color", "#241416"],
            ] as const
          ).map(([key, label, placeholder]) => (
            <label key={key} className="space-y-1.5 text-sm text-neutral-600">
              {label}
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={fields.theme[key] && /^#[0-9A-Fa-f]{6}$/.test(fields.theme[key]!) ? fields.theme[key]! : placeholder}
                  onChange={(event) => setThemeField(key, event.target.value)}
                  className="h-9 w-9 rounded-lg border border-neutral-200 bg-transparent p-0.5 cursor-pointer"
                />
                <input
                  type="text"
                  maxLength={7}
                  pattern="#[0-9A-Fa-f]{6}"
                  title="Enter a 6-digit hex color such as #602e31"
                  value={fields.theme[key] || ""}
                  onChange={(event) => setThemeField(key, event.target.value)}
                  placeholder={placeholder}
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-neutral-900 font-mono text-xs"
                />
              </div>
            </label>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm text-neutral-600">
            Button Style
            <select
              value={fields.theme.buttonStyle || "filled"}
              onChange={(event) =>
                setThemeField("buttonStyle", event.target.value)
              }
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-neutral-900"
            >
              <option value="filled">Filled</option>
              <option value="outlined">Outlined</option>
              <option value="gradient">Gradient</option>
            </select>
          </label>
          <label className="space-y-1.5 text-sm text-neutral-600">
            Border Radius
            <select
              value={fields.theme.borderRadius || "rounded"}
              onChange={(event) =>
                setThemeField("borderRadius", event.target.value)
              }
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-neutral-900"
            >
              <option value="sharp">Sharp (0px)</option>
              <option value="rounded">Rounded (12px)</option>
              <option value="pill">Pill (Full)</option>
            </select>
          </label>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isSaving ? "Saving..." : restaurant ? "Save changes" : "Create restaurant"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/super-admin")}
          className="rounded-md border border-neutral-300 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
