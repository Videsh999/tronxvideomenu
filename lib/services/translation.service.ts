import { createHash } from "node:crypto";
import { connectToDatabase } from "@/lib/db/mongodb";
import { TranslationCacheModel } from "@/lib/db/translation-model";

const MAX_SOURCE_LENGTH = 480;
const CONCURRENCY = 6;
const REQUEST_TIMEOUT_MS = 10_000;

type Provider = {
  name: string;
  translate: (texts: string[], target: string) => Promise<(string | null)[]>;
};

const inFlight = new Map<string, Promise<string | null>>();

function cacheKey(target: string, text: string) {
  return createHash("sha256").update(`v2\u0000${target}\u0000${text}`).digest("hex");
}

function decodeEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: "no-store" });
  if (!response.ok) throw new Error(`Translation provider responded ${response.status}`);
  return response.json() as Promise<unknown>;
}

const googleProvider = (apiKey: string): Provider => ({
  name: "google",
  async translate(texts, target) {
    const results: (string | null)[] = [];
    for (let index = 0; index < texts.length; index += 100) {
      const batch = texts.slice(index, index + 100);
      try {
        const json = await fetchJson(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: batch, source: "en", target, format: "text" }),
        }) as { data?: { translations?: { translatedText?: string }[] } };
        const translations = json.data?.translations ?? [];
        results.push(...batch.map((_, i) => translations[i]?.translatedText?.trim() || null));
      } catch {
        results.push(...batch.map(() => null));
      }
    }
    return results;
  },
});

const MYMEMORY_BATCH_CHARS = 450;

async function myMemoryRequest(text: string, target: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({ q: text, langpair: `en|${target}`, mt: "1" });
    const contact = process.env.TRANSLATION_CONTACT_EMAIL;
    if (contact) params.set("de", contact);
    const json = await fetchJson(`https://api.mymemory.translated.net/get?${params}`) as {
      responseStatus?: number | string;
      responseData?: { translatedText?: string };
      matches?: { "created-by"?: string; translation?: string }[];
    };
    // Prefer the machine translation: crowd-sourced memory matches are often unrelated or just re-cased.
    const machine = json.matches?.find((match) => match["created-by"] === "MT!")?.translation;
    const translated = (machine ?? json.responseData?.translatedText)?.trim();
    if (Number(json.responseStatus) !== 200 || !translated || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID LANGUAGE PAIR/i.test(translated)) return null;
    return decodeEntities(translated);
  } catch {
    return null;
  }
}

const myMemoryProvider: Provider = {
  name: "mymemory",
  async translate(texts, target) {
    // Pack short strings into newline-separated requests to cut round-trips; MyMemory keeps line breaks.
    const chunks: number[][] = [];
    let current: number[] = [];
    let length = 0;
    texts.forEach((text, index) => {
      if (text.includes("\n")) { chunks.push([index]); return; }
      if (current.length && length + text.length + 1 > MYMEMORY_BATCH_CHARS) { chunks.push(current); current = []; length = 0; }
      current.push(index);
      length += text.length + 1;
    });
    if (current.length) chunks.push(current);

    const results: (string | null)[] = texts.map(() => null);
    await runWithConcurrency(chunks, CONCURRENCY, async (chunk) => {
      if (chunk.length === 1) {
        results[chunk[0]] = await myMemoryRequest(texts[chunk[0]], target);
        return;
      }
      const joined = await myMemoryRequest(chunk.map((index) => texts[index]).join("\n"), target);
      const lines = joined?.split("\n").map((line) => line.trim());
      if (lines && lines.length === chunk.length && lines.every(Boolean)) {
        chunk.forEach((index, position) => { results[index] = lines[position]; });
        return;
      }
      await Promise.all(chunk.map(async (index) => { results[index] = await myMemoryRequest(texts[index], target); }));
    });
    return results;
  },
};

function getProvider(): Provider {
  const googleKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  return googleKey ? googleProvider(googleKey) : myMemoryProvider;
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await worker(queue.shift() as T);
  }));
}

/**
 * Translates English source strings into `target` (a provider language code).
 * Results are cached permanently in MongoDB; failed translations are omitted so
 * callers can fall back to the original text and retry later.
 */
export async function translateTexts(sources: string[], target: string): Promise<Record<string, string>> {
  const unique = [...new Set(sources.map((text) => text.trim()).filter((text) => text && text.length <= MAX_SOURCE_LENGTH))];
  if (!unique.length) return {};

  await connectToDatabase();
  const keyed = unique.map((source) => ({ source, key: cacheKey(target, source) }));
  const cached = await TranslationCacheModel.find({ key: { $in: keyed.map((entry) => entry.key) } }, { key: 1, text: 1, _id: 0 }).lean<{ key: string; text: string }[]>();
  const cachedByKey = new Map(cached.map((entry) => [entry.key, entry.text]));

  const result: Record<string, string> = {};
  const missing: { source: string; key: string }[] = [];
  for (const entry of keyed) {
    const hit = cachedByKey.get(entry.key);
    if (hit) result[entry.source] = hit;
    else missing.push(entry);
  }
  if (!missing.length) return result;

  const provider = getProvider();
  const fresh: { key: string; source: string; text: string }[] = [];
  const pending = missing.filter((entry) => !inFlight.has(entry.key));
  const waiting = missing.filter((entry) => inFlight.has(entry.key));

  // Google takes up to 100 strings per call; MyMemory packs its own requests, so it gets everything at once.
  const batchSize = provider.name === "google" ? 100 : Math.max(1, pending.length);
  const batches: { source: string; key: string }[][] = [];
  for (let index = 0; index < pending.length; index += batchSize) batches.push(pending.slice(index, index + batchSize));

  await runWithConcurrency(batches, 2, async (batch) => {
    const promise = provider.translate(batch.map((entry) => entry.source), target);
    batch.forEach((entry, index) => inFlight.set(entry.key, promise.then((texts) => texts[index] ?? null)));
    try {
      const texts = await promise;
      batch.forEach((entry, index) => {
        const text = texts[index];
        if (text) {
          result[entry.source] = text;
          fresh.push({ key: entry.key, source: entry.source, text });
        }
      });
    } finally {
      batch.forEach((entry) => inFlight.delete(entry.key));
    }
  });

  for (const entry of waiting) {
    const text = await inFlight.get(entry.key);
    if (text) result[entry.source] = text;
  }

  if (fresh.length) {
    await TranslationCacheModel.bulkWrite(fresh.map((entry) => ({
      updateOne: {
        filter: { key: entry.key },
        update: { $setOnInsert: { key: entry.key, targetLanguage: target, source: entry.source, text: entry.text, provider: provider.name, createdAt: new Date() } },
        upsert: true,
      },
    })), { ordered: false }).catch(() => undefined);
  }

  return result;
}
