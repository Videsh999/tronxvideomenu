import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";
import { apiSessionAllowed, classifyApiRequest, type ApiAuthClass } from "../lib/api-authz";
import { proxy } from "../proxy";

const STAFF_PREFIXES = [
  "/api/addon-groups",
  "/api/addons",
  "/api/ai",
  "/api/categories",
  "/api/crm",
  "/api/devices",
  "/api/dishes",
  "/api/inventory",
  "/api/kitchen",
  "/api/media",
  "/api/orders",
  "/api/organization",
  "/api/pos",
  "/api/procurement",
  "/api/reports",
  "/api/reservations",
  "/api/restaurants",
  "/api/tables",
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(`${path.sep}route.ts`) ? [full] : [];
  });
}

function routePath(file: string) {
  const relative = path.relative(path.join(process.cwd(), "app", "api"), file).replace(/\\/g, "/");
  const withoutFile = relative.replace(/\/route\.ts$/, "").replace(/route\.ts$/, "");
  return `/api/${withoutFile}`.replace(/\/$/, "");
}

function methodsIn(file: string) {
  const source = readFileSync(file, "utf8");
  return ["GET", "POST", "PUT", "PATCH", "DELETE"].filter((method) =>
    new RegExp(`export async function ${method}\\b`).test(source),
  );
}

const nobody = { restaurantAdmin: false, superAdmin: false, captain: false };
const captainOnly = { restaurantAdmin: false, superAdmin: false, captain: true };
const admin = { restaurantAdmin: true, superAdmin: false, captain: false };

test("every route file is classified and staff routes stay denied to captains and guests", () => {
  const files = walk(path.join(process.cwd(), "app", "api"));
  const handlers: Array<{ method: string; pathname: string; authClass: ApiAuthClass }> = [];
  for (const file of files) {
    const pathname = routePath(file);
    for (const method of methodsIn(file)) {
      const authClass = classifyApiRequest(method, pathname);
      handlers.push({ method, pathname, authClass });
      if (pathname.startsWith("/api/public/loyalty/")) {
        assert.equal(authClass, "customer", pathname);
        assert.equal(apiSessionAllowed(authClass, nobody), true);
      } else if (pathname.startsWith("/api/connector/")) {
        assert.equal(authClass, "connector", pathname);
        assert.equal(apiSessionAllowed(authClass, nobody), true);
      } else if (pathname === "/api/dev/seed-demo-kitchen") {
        assert.equal(authClass, "local_dev");
        assert.equal(apiSessionAllowed(authClass, { restaurantAdmin: true, superAdmin: true, captain: true }), false);
      }
      if (authClass === "staff") {
        assert.equal(apiSessionAllowed(authClass, nobody), false, `${method} ${pathname}`);
        assert.equal(apiSessionAllowed(authClass, captainOnly), false, `${method} ${pathname}`);
        assert.equal(apiSessionAllowed(authClass, admin), true, `${method} ${pathname}`);
        assert.ok(
          STAFF_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)),
          `${method} ${pathname} fell through to staff`,
        );
      }
    }
  }
  assert.ok(handlers.length >= 170, `expected the handler matrix, found ${handlers.length}`);
  const unclassified = handlers.filter((handler) => handler.authClass === "staff" && !STAFF_PREFIXES.some((prefix) => handler.pathname === prefix || handler.pathname.startsWith(`${prefix}/`)));
  assert.deepEqual(unclassified, []);
});

test("proxy lets loyalty and connector reach their handlers and blocks public seed traffic", async () => {
  const loyalty = await proxy(new NextRequest("http://localhost/api/public/loyalty/login", { method: "POST" }));
  assert.notEqual(loyalty.status, 401);
  const connector = await proxy(new NextRequest("http://localhost/api/connector/jobs"));
  assert.notEqual(connector.status, 401);
  const pair = await proxy(new NextRequest("http://localhost/api/connector/pair", { method: "POST" }));
  assert.notEqual(pair.status, 401);
  const dishes = await proxy(new NextRequest("http://localhost/api/dishes", { method: "POST" }));
  assert.equal(dishes.status, 401);
  const seed = await proxy(new NextRequest("https://evil.example/api/dev/seed-demo-kitchen", { method: "POST" }));
  assert.equal(seed.status, 403);
  const localSeed = await proxy(new NextRequest("http://localhost/api/dev/seed-demo-kitchen", { method: "POST" }));
  assert.notEqual(localSeed.status, 401);
  assert.notEqual(localSeed.status, 403);
});
