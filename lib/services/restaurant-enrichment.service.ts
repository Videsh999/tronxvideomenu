/**
 * Public web enrichment for Super Admin onboarding.
 * Sources: OpenStreetMap Nominatim + Wikipedia OpenSearch (public APIs only).
 * Never auto-writes — callers must confirm before PATCH.
 */

export type EnrichmentSource = {
  label: string;
  url: string;
};

export type RestaurantEnrichmentProposal = {
  query: { name: string; location?: string };
  proposal: {
    name?: string;
    tagline?: string;
    description?: string;
    address?: string;
    phone?: string;
    openingHours?: string;
    socialLinks?: { website?: string };
    /** Suggested public image URLs only — never auto-applied without confirm. */
    logoUrl?: string;
    coverImageUrl?: string;
  };
  sources: EnrichmentSource[];
  notes: string[];
  /** frank status for photo automation */
  photoAutomation: {
    feasible: boolean;
    summary: string;
  };
};

type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
  namedetails?: { name?: string };
  extratags?: Record<string, string>;
  address?: Record<string, string>;
};

const USER_AGENT = "TRONX-SuperAdmin-Enrichment/1.0 (ops@tronx; restaurant onboarding)";

function buildQuery(name: string, location?: string) {
  return [name.trim(), location?.trim()].filter(Boolean).join(", ");
}

async function nominatimSearch(query: string): Promise<NominatimResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("namedetails", "1");
  const response = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return null;
  const rows = (await response.json()) as NominatimResult[];
  return rows[0] ?? null;
}

async function wikipediaLookup(name: string): Promise<{
  title?: string;
  description?: string;
  pageUrl?: string;
  thumbnailUrl?: string;
} | null> {
  const searchUrl = new URL("https://en.wikipedia.org/w/api.php");
  searchUrl.searchParams.set("action", "opensearch");
  searchUrl.searchParams.set("search", name);
  searchUrl.searchParams.set("limit", "1");
  searchUrl.searchParams.set("namespace", "0");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("origin", "*");

  const searchRes = await fetch(searchUrl.toString(), {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (!searchRes.ok) return null;
  const searchJson = (await searchRes.json()) as [string, string[], string[], string[]];
  const title = searchJson[1]?.[0];
  const pageUrl = searchJson[3]?.[0];
  if (!title || !pageUrl) return null;

  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const summaryRes = await fetch(summaryUrl, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!summaryRes.ok) return { title, pageUrl };
  const summary = (await summaryRes.json()) as {
    extract?: string;
    description?: string;
    thumbnail?: { source?: string };
    originalimage?: { source?: string };
  };
  return {
    title,
    pageUrl,
    description: summary.extract?.slice(0, 600) || summary.description,
    thumbnailUrl: summary.originalimage?.source || summary.thumbnail?.source,
  };
}

function formatAddress(place: NominatimResult): string | undefined {
  if (place.display_name) return place.display_name;
  const a = place.address;
  if (!a) return undefined;
  return [a.road, a.suburb || a.neighbourhood, a.city || a.town || a.village, a.state, a.postcode]
    .filter(Boolean)
    .join(", ");
}

export class RestaurantEnrichmentService {
  async enrich(input: { name: string; location?: string }): Promise<RestaurantEnrichmentProposal> {
    const name = input.name.trim();
    if (name.length < 2) {
      throw new RestaurantEnrichmentError("Restaurant name is required.", 400);
    }
    const location = input.location?.trim() || undefined;
    const query = buildQuery(name, location);
    const sources: EnrichmentSource[] = [];
    const notes: string[] = [];
    const proposal: RestaurantEnrichmentProposal["proposal"] = { name };

    let place = await nominatimSearch(query).catch(() => null);
    if (!place && !/\brestaurant\b/i.test(query)) {
      place = await nominatimSearch(`${query} restaurant`).catch(() => null);
    }
    if (place) {
      sources.push({
        label: "OpenStreetMap Nominatim",
        url: `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`,
      });
      proposal.name = place.namedetails?.name || name;
      proposal.address = formatAddress(place);
      const phone = place.extratags?.phone || place.extratags?.["contact:phone"];
      if (phone) proposal.phone = phone;
      const website = place.extratags?.website || place.extratags?.["contact:website"];
      if (website) proposal.socialLinks = { website };
      const hours = place.extratags?.opening_hours;
      if (hours) {
        proposal.openingHours = hours;
        notes.push("Opening hours from OSM tags — verify before publishing.");
      }
      const cuisine = place.extratags?.cuisine;
      if (cuisine) {
        proposal.tagline = cuisine
          .split(";")
          .map((part) => part.trim())
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" · ");
      }
    } else {
      notes.push("No OpenStreetMap match — try a more specific location (city / area).");
    }

    const wiki = await wikipediaLookup(proposal.name || name).catch(() => null);
    if (wiki?.pageUrl) {
      sources.push({ label: "Wikipedia", url: wiki.pageUrl });
      if (wiki.description && !proposal.description) {
        proposal.description = wiki.description;
        notes.push("Description drafted from Wikipedia summary — edit for brand voice.");
      }
      if (wiki.thumbnailUrl) {
        proposal.coverImageUrl = wiki.thumbnailUrl;
        notes.push("Cover suggestion is a public Wikipedia/Wikimedia image — confirm rights/fit before apply.");
      }
    } else {
      notes.push("No Wikipedia article found for this name.");
    }

    if (!proposal.tagline && proposal.description) {
      proposal.tagline = proposal.description.split(/[.!?]/)[0]?.trim().slice(0, 80) || undefined;
    }

    return {
      query: { name, location },
      proposal,
      sources,
      notes,
      photoAutomation: {
        feasible: false,
        summary:
          "Full agentic photo auto-update is deferred: public OSM rarely has brand logos; Wikipedia thumbnails are optional suggestions only. Owners should upload logo/cover in admin Media, or Super Admin pastes confirmed public URLs after review.",
      },
    };
  }
}

export class RestaurantEnrichmentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "RestaurantEnrichmentError";
    this.status = status;
  }
}

export const restaurantEnrichmentService = new RestaurantEnrichmentService();
