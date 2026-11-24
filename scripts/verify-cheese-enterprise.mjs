/**
 * Smoke-verify Cheese enterprise demo: login + hit gated admin APIs.
 * Prerequisites: npm run demo:workbook && npm run demo:seed:cheese && npm run dev
 *
 * Usage: node scripts/verify-cheese-enterprise.mjs
 */
const BASE = process.env.VERIFY_BASE_URL || "http://localhost:3000";

const ADMIN = {
  email: "cheese@tronx.local",
  password: "CheeseDemo!2026",
  restaurantSlug: "cheese",
};

const CAPTAIN = {
  email: "captain@cheese.local",
  password: "CheeseCap!2026",
  restaurantSlug: "cheese",
};

const jar = { cookie: "" };

function takeCookies(response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  if (raw.length) {
    const pairs = raw.map((line) => line.split(";")[0]);
    jar.cookie = [...(jar.cookie ? jar.cookie.split("; ") : []), ...pairs]
      .filter(Boolean)
      .join("; ");
    return;
  }
  const single = response.headers.get("set-cookie");
  if (single) {
    const pair = single.split(";")[0];
    jar.cookie = jar.cookie ? `${jar.cookie}; ${pair}` : pair;
  }
}

async function req(path, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(jar.cookie ? { Cookie: jar.cookie } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  takeCookies(response);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { ok: response.ok, status: response.status, json, path };
}

const results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log(`Verifying Cheese against ${BASE}\n`);

  const menu = await req("/api/restaurants/cheese?fullMenu=true");
  record(
    "Public menu",
    menu.ok && menu.json?.success && (menu.json?.data?.dishes?.length ?? 0) > 0,
    `dishes=${menu.json?.data?.dishes?.length ?? 0} offer=${Boolean(menu.json?.data?.activeOffer)}`,
  );

  const adminLogin = await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: ADMIN.email,
      password: ADMIN.password,
      role: "RESTAURANT_ADMIN",
      restaurantSlug: ADMIN.restaurantSlug,
    }),
  });
  record(
    "Admin login",
    adminLogin.ok && adminLogin.json?.success,
    adminLogin.json?.error || `status=${adminLogin.status}`,
  );

  const checks = [
    ["Offers list", "/api/offers"],
    ["CRM customers", "/api/crm/customers"],
    ["CRM coupons", "/api/crm/coupons"],
    ["Inventory ingredients", "/api/inventory/ingredients"],
    ["Procurement suppliers", "/api/procurement/suppliers"],
    ["Reports dashboard", "/api/reports/dashboard"],
    ["AI overview", "/api/ai/overview"],
    ["AI forecast", "/api/ai/forecast"],
    ["AI inventory intel", "/api/ai/inventory"],
    ["AI menu intel", "/api/ai/menu"],
    ["AI alerts", "/api/ai/alerts"],
    ["Dishes", `/api/dishes?restaurantId=cheese`],
    ["Tables", "/api/tables"],
    ["Captains", "/api/admin/captains"],
    ["Reservations", "/api/reservations"],
    ["Media", "/api/media"],
    ["Organization", "/api/organization"],
  ];

  for (const [name, path] of checks) {
    const result = await req(path);
    const pass = result.ok && result.json?.success !== false;
    record(
      name,
      pass,
      `HTTP ${result.status}${result.json?.error ? ` ${result.json.error}` : ""}`,
    );
  }

  // AI assistant (heuristic OK without AI_API_KEY)
  const assistant = await req("/api/ai/assistant", {
    method: "POST",
    body: JSON.stringify({ message: "Summarise today's sales risk in one sentence." }),
  });
  record(
    "AI assistant",
    assistant.ok && (assistant.json?.success === true || Boolean(assistant.json?.data)),
    `HTTP ${assistant.status}${assistant.json?.error ? ` ${assistant.json.error}` : ""}`,
  );

  jar.cookie = "";
  const captainLogin = await req("/api/captain/login", {
    method: "POST",
    body: JSON.stringify(CAPTAIN),
  });
  record(
    "Captain login",
    captainLogin.ok && captainLogin.json?.success,
    captainLogin.json?.error || `status=${captainLogin.status}`,
  );

  if (captainLogin.ok) {
    const tables = await req("/api/captain/tables");
    record(
      "Captain tables",
      tables.ok && tables.json?.success !== false,
      `HTTP ${tables.status}`,
    );
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("Failures:");
    for (const row of failed) console.log(` - ${row.name}: ${row.detail}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
