#!/usr/bin/env node
/**
 * Live verify: login → upload reupload xlsx → map UPDATE_MATCHING → commit → assert no duplicates.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const jar = new Map();

function storeCookies(res) {
  const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function req(path, init = {}, timeoutMs = 120_000) {
  const headers = new Headers(init.headers || {});
  if (jar.size) headers.set("cookie", cookieHeader());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, headers, signal: controller.signal });
    storeCookies(res);
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

const demoPassword = process.env.TRONX_DEMO_ADMIN_PASSWORD;
if (!demoPassword) {
  console.error("TRONX_DEMO_ADMIN_PASSWORD is required. The value is not printed.");
  process.exit(1);
}
const login = await req("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "demo@tronx.local",
    password: demoPassword,
    role: "RESTAURANT_ADMIN",
    restaurantSlug: "tronx-demo-kitchen",
  }),
});
if (!login.json.success) {
  console.error("LOGIN_FAILED", login);
  process.exit(1);
}

const filePath = join(process.cwd(), "fixtures", "tronx-demo-kitchen-reupload.xlsx");
const blob = new Blob([readFileSync(filePath)], {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});
const form = new FormData();
form.append("file", blob, "tronx-demo-kitchen-reupload.xlsx");
const upload = await req("/api/admin/menu-import", { method: "POST", body: form });
if (!upload.json.success) {
  console.error("UPLOAD_FAILED", upload);
  process.exit(1);
}
const job = upload.json.data;
console.log("uploaded", { id: job.id, status: job.status, strategy: job.strategy });

let preview = job.preview;
if (!preview?.summary || job.status === "AWAITING_MAPPING") {
  const mapping = await req(`/api/admin/menu-import/${job.id}/mapping`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      columnMappings: job.columnMappings,
      strategy: "UPDATE_MATCHING",
    }),
  });
  if (!mapping.json.success) {
    console.error("MAPPING_FAILED", mapping);
    process.exit(1);
  }
  preview = mapping.json.data?.preview;
}
console.log("preview", preview?.summary);
console.log(
  "actions",
  (preview?.items || []).map((i) => ({ name: i.name, sku: i.sku, action: i.action })),
);

const commit = await req(`/api/admin/menu-import/${job.id}/commit`, { method: "POST" });
if (!commit.json.success) {
  console.error("COMMIT_FAILED", commit);
  process.exit(1);
}
console.log("commit", commit.json.data?.result || commit.json.data);

const menu = await req("/api/restaurants/tronx-demo-kitchen?fullMenu=true");
const dishes = menu.json.data?.dishes || [];
const bySku = new Map();
for (const dish of dishes) {
  const key = dish.sku || `name:${dish.name}`;
  bySku.set(key, (bySku.get(key) || 0) + 1);
}
const dups = [...bySku.entries()].filter(([, n]) => n > 1);
console.log(
  JSON.stringify(
    {
      dishes: dishes.length,
      duplicates: dups,
      springDesc: dishes.find((d) => d.sku === "ST-001")?.description,
      chaiPrice: dishes.find((d) => d.sku === "BV-001")?.price,
      platter: dishes.find((d) => d.sku === "SP-NEW-01")?.name,
      brownie: dishes.find((d) => d.sku === "DS-NEW-01")?.name,
    },
    null,
    2,
  ),
);
if (dups.length) process.exit(2);
if (dishes.length < 82) {
  console.error("Expected at least 82 dishes after adding 2 specials");
  process.exit(3);
}
console.log("OK — reupload merged without duplicates");
