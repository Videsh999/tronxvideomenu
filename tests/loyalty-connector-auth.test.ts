import assert from "node:assert/strict";
import { describe, mock, test } from "node:test";
import { hashCustomerPassword } from "../lib/customer-auth";
import { crmRepository } from "../lib/repositories/crm.repository";
import { connectorRepository } from "../lib/repositories/connector.repository";
import { deviceRepository } from "../lib/repositories/device.repository";
import { restaurantService } from "../lib/services/restaurant.service";
import { customerLoyaltyService, CustomerLoyaltyServiceError } from "../lib/services/customer-loyalty.service";
import { connectorService, ConnectorServiceError } from "../lib/services/connector.service";
import { POST as login } from "../app/api/public/loyalty/login/route";
import { POST as register } from "../app/api/public/loyalty/register/route";
import { POST as resetPassword } from "../app/api/public/loyalty/reset-password/route";
import { POST as forgotPassword } from "../app/api/public/loyalty/forgot-password/route";
import { POST as logout } from "../app/api/public/loyalty/logout/route";
import { POST as pair } from "../app/api/connector/pair/route";
import { POST as heartbeat } from "../app/api/connector/heartbeat/route";
import { GET as jobs } from "../app/api/connector/jobs/route";
import { POST as ack } from "../app/api/connector/jobs/[jobId]/ack/route";

const secret = "test-auth-secret";

describe("loyalty and connector handler contracts", { concurrency: 1 }, () => {

function jsonRequest(url: string, body: unknown, headers?: Record<string, string>) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test.afterEach(() => {
  for (let i = 0; i < 8; i += 1) mock.restoreAll();
  delete process.env.AUTH_SECRET;
});

test("loyalty login, register, and reset stay reachable without a customer session", async () => {
  process.env.AUTH_SECRET = secret;
  let loginResult: () => Promise<unknown> = async () => {
    throw new CustomerLoyaltyServiceError("Invalid phone/email or password.", 401);
  };
  mock.method(customerLoyaltyService, "login", async () => loginResult());
  const badLogin = await login(jsonRequest("http://localhost/api/public/loyalty/login", {
    restaurantSlug: "outlet-a",
    phoneOrEmail: "9999999999",
    password: "wrong-password",
  }));
  assert.equal(badLogin.status, 401);

  loginResult = async () => ({
    restaurant: { id: "rest-a", slug: "outlet-a", name: "A" },
    customer: { id: "cust-a", phone: "9999999999", loyaltyPoints: 0, totalOrders: 0, segment: "NEW" },
  });
  const goodLogin = await login(jsonRequest("http://localhost/api/public/loyalty/login", {
    restaurantSlug: "outlet-a",
    phoneOrEmail: "9999999999",
    password: "correct-horse",
  }));
  assert.equal(goodLogin.status, 200);
  assert.match(goodLogin.headers.get("set-cookie") ?? "", /tronx_customer_session=/);

  const invalidRegister = await register(jsonRequest("http://localhost/api/public/loyalty/register", { restaurantSlug: "outlet-a" }));
  assert.equal(invalidRegister.status, 400);

  mock.method(customerLoyaltyService, "register", async () => ({
    restaurant: { id: "rest-a", slug: "outlet-a", name: "A" },
    customer: { id: "cust-a", phone: "9999999999", loyaltyPoints: 0, totalOrders: 0, segment: "NEW" },
  }));
  const goodRegister = await register(jsonRequest("http://localhost/api/public/loyalty/register", {
    restaurantSlug: "outlet-a",
    name: "Guest",
    phone: "9999999999",
    email: "guest@example.test",
    password: "correct-horse",
  }));
  assert.equal(goodRegister.status, 200);

  const shortReset = await resetPassword(jsonRequest("http://localhost/api/public/loyalty/reset-password", {
    restaurantSlug: "outlet-a",
    token: "too-short",
    password: "correct-horse",
  }));
  assert.equal(shortReset.status, 400);

  let resetResult: () => Promise<unknown> = async () => {
    throw new CustomerLoyaltyServiceError("Reset link is invalid or expired.", 400);
  };
  mock.method(customerLoyaltyService, "resetPassword", async () => resetResult());
  const badReset = await resetPassword(jsonRequest("http://localhost/api/public/loyalty/reset-password", {
    restaurantSlug: "outlet-a",
    token: "a".repeat(32),
    password: "correct-horse",
  }));
  assert.equal(badReset.status, 400);

  resetResult = async () => ({ ok: true as const });
  const goodReset = await resetPassword(jsonRequest("http://localhost/api/public/loyalty/reset-password", {
    restaurantSlug: "outlet-a",
    token: "b".repeat(32),
    password: "correct-horse",
  }));
  assert.equal(goodReset.status, 200);

  const logoutResponse = await logout(new Request("http://localhost/api/public/loyalty/logout", { method: "POST" }));
  assert.equal(logoutResponse.status, 200);
  assert.match(logoutResponse.headers.get("set-cookie") ?? "", /tronx_customer_session=/);
});

test("loyalty login is scoped to the outlet and does not accept another outlet's customer", async () => {
  const passwordHash = await hashCustomerPassword("correct-horse");
  mock.method(restaurantService, "getBySlug", async (slug: string) => {
    if (slug === "outlet-a") return { id: "rest-a", slug, name: "A", isActive: true } as never;
    if (slug === "outlet-b") return { id: "rest-b", slug, name: "B", isActive: true } as never;
    return null;
  });
  mock.method(crmRepository, "findAuthByPhone", async (restaurantId: string, phone: string) => {
    if (restaurantId === "rest-a" && phone === "9999999999") {
      return {
        id: "cust-a",
        restaurantId,
        phone,
        passwordHash,
        name: "Guest",
        loyaltyPoints: 3,
        totalOrders: 1,
        segment: "REGULAR",
      } as never;
    }
    return null;
  });
  const own = await customerLoyaltyService.login({
    restaurantSlug: "outlet-a",
    phoneOrEmail: "9999999999",
    password: "correct-horse",
  });
  assert.equal(own.restaurant.id, "rest-a");
  await assert.rejects(
    () => customerLoyaltyService.login({
      restaurantSlug: "outlet-b",
      phoneOrEmail: "9999999999",
      password: "correct-horse",
    }),
    (error: unknown) => error instanceof CustomerLoyaltyServiceError && error.statusCode === 401,
  );
  mock.method(crmRepository, "getCustomer", async (restaurantId: string, customerId: string) => {
    if (restaurantId === "rest-a" && customerId === "cust-a") {
      return { id: "cust-a", restaurantId, phone: "9999999999", loyaltyPoints: 3, totalOrders: 1, segment: "REGULAR" } as never;
    }
    return null;
  });
  assert.equal((await customerLoyaltyService.getView("rest-b", "cust-a")), null);
  assert.equal((await customerLoyaltyService.getView("rest-a", "cust-a"))?.id, "cust-a");
});

test("forgot-password does not require a session and hides unknown accounts", async () => {
  const bad = await forgotPassword(jsonRequest("http://localhost/api/public/loyalty/forgot-password", { restaurantSlug: "outlet-a", email: "not-an-email" }));
  assert.equal(bad.status, 400);
  mock.method(customerLoyaltyService, "requestPasswordReset", async () => ({ accepted: true as const, resetPath: null }));
  const hidden = await forgotPassword(jsonRequest("http://localhost/api/public/loyalty/forgot-password", {
    restaurantSlug: "outlet-a",
    email: "missing@example.test",
  }));
  assert.equal(hidden.status, 200);
  const body = await hidden.json() as { success: boolean; data: { resetPath: string | null } };
  assert.equal(body.success, true);
  assert.equal(body.data.resetPath, null);
});

test("connector pair uses the pairing code and ignores a caller-supplied outlet", async () => {
  const injected = await pair(jsonRequest("http://localhost/api/connector/pair", {
    code: "ABC123",
    restaurantId: "rest-b",
  }));
  assert.equal(injected.status, 400);

  let claimResult: () => Promise<unknown> = async () => ({
    connectorId: "conn-1",
    connectorSecret: "shown-once",
    restaurantId: "rest-a",
    outletId: "out-a",
    credentialVersion: 1,
    devices: [],
  });
  mock.method(connectorService, "claimPairing", async () => claimResult());
  const paired = await pair(jsonRequest("http://localhost/api/connector/pair", { code: "ABC123" }));
  assert.equal(paired.status, 200);
  const body = await paired.json() as { data: { restaurantId: string } };
  assert.equal(body.data.restaurantId, "rest-a");

  claimResult = async () => {
    throw new ConnectorServiceError("Invalid or already used pairing code.", 400, "INVALID_CODE");
  };
  const invalid = await pair(jsonRequest("http://localhost/api/connector/pair", { code: "ZZZZZZ" }));
  assert.equal(invalid.status, 400);
});

test("pairing record chooses the outlet, not the connector body", async () => {
  mock.method(connectorRepository, "findOpenPairingByHash", async () => ({
    id: "pair-1",
    restaurantId: "rest-a",
    outletId: "out-a",
    organizationId: "org-a",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  }));
  mock.method(connectorRepository, "markPairingUsed", async () => true);
  mock.method(connectorRepository, "createConnector", async () => undefined);
  mock.method(deviceRepository, "insertDevices", async () => undefined);
  const claimed = await connectorService.claimPairing({ code: "ABC123" });
  assert.equal(claimed.restaurantId, "rest-a");
  assert.equal(claimed.outletId, "out-a");
});

test("heartbeat, jobs, and ack require the connector secret and stay inside the outlet", async () => {
  const missing = await heartbeat(jsonRequest("http://localhost/api/connector/heartbeat", {}));
  assert.equal(missing.status, 401);

  let connectorAuth: () => Promise<unknown> = async () => {
    throw new ConnectorServiceError("Connector unauthorized.", 401, "UNAUTHORIZED");
  };
  mock.method(connectorService, "authenticateConnector", async () => connectorAuth());
  const badSecret = await jobs(new Request("http://localhost/api/connector/jobs", {
    headers: { "x-connector-id": "conn-1", "x-connector-secret": "nope" },
  }));
  assert.equal(badSecret.status, 401);

  connectorAuth = async () => ({
    id: "conn-1",
    restaurantId: "rest-a",
    outletId: "out-a",
  });
  mock.method(connectorService, "pollJobs", async (connector: { restaurantId: string }) => {
    assert.equal(connector.restaurantId, "rest-a");
    return [];
  });
  mock.method(connectorService, "listDevicesForConnector", async () => []);
  const listed = await jobs(new Request("http://localhost/api/connector/jobs", {
    headers: { "x-connector-id": "conn-1", "x-connector-secret": "secret" },
  }));
  assert.equal(listed.status, 200);

  let foundJob: unknown = null;
  mock.method(deviceRepository, "findJob", async () => foundJob);
  await assert.rejects(
    () => connectorService.ackJob(
      { id: "conn-1", restaurantId: "rest-a", outletId: "out-a" } as never,
      "job-from-other-outlet",
      { status: "COMPLETED" },
    ),
    (error: unknown) => error instanceof ConnectorServiceError && error.statusCode === 404,
  );
  foundJob = {
    id: "job-1",
    restaurantId: "rest-a",
    outletId: "out-b",
    status: "QUEUED",
  };
  await assert.rejects(
    () => connectorService.ackJob(
      { id: "conn-1", restaurantId: "rest-a", outletId: "out-a" } as never,
      "job-1",
      { status: "COMPLETED" },
    ),
    (error: unknown) => error instanceof ConnectorServiceError && error.statusCode === 403,
  );

  const ackMissing = await ack(
    new Request("http://localhost/api/connector/jobs/job-1/ack", { method: "POST", body: JSON.stringify({ status: "COMPLETED" }) }),
    { params: Promise.resolve({ jobId: "job-1" }) },
  );
  assert.equal(ackMissing.status, 401);
});
});
