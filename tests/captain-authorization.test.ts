import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authorizationBlocksKitchen,
  authorizationForCustomerQr,
  defaultAuthorizationForSource,
  isCaptainKitchenEligible,
  isPendingCaptainApproval,
  resolveAuthorization,
} from "@/lib/order-authorization";
import { captainAuthorizeSchema } from "@/lib/validations/captain-authorize";

describe("captain authorization gate", () => {
  it("QR default is pending captain approval", () => {
    const auth = defaultAuthorizationForSource("CUSTOMER_QR");
    assert.equal(auth.status, "PENDING_CAPTAIN_APPROVAL");
    assert.equal(authorizationBlocksKitchen(auth.status), true);
  });

  it("captain direct and POS are kitchen-eligible without QR gate", () => {
    assert.equal(defaultAuthorizationForSource("CAPTAIN_DIRECT").status, "CAPTAIN_APPROVED");
    assert.equal(defaultAuthorizationForSource("POS").status, "NOT_REQUIRED");
    assert.equal(
      isCaptainKitchenEligible({
        status: "PENDING",
        source: "POS",
        captainAuthorization: defaultAuthorizationForSource("POS"),
      }),
      true,
    );
  });

  it("restaurant policy can leave a QR order pending for staff without captain approval", () => {
    assert.equal(authorizationForCustomerQr(true).status, "PENDING_CAPTAIN_APPROVAL");
    const authorization = authorizationForCustomerQr(false);
    assert.deepEqual(authorization, {
      status: "NOT_REQUIRED",
      entrySource: "CUSTOMER_QR",
    });
    assert.equal(isCaptainKitchenEligible({
      status: "PENDING",
      source: "QR",
      captainAuthorization: authorization,
    }), true);
  });

  it("legacy pending QR without field requires approval", () => {
    const order = { status: "PENDING" as const, source: "QR" as const };
    assert.equal(resolveAuthorization(order).status, "PENDING_CAPTAIN_APPROVAL");
    assert.equal(isPendingCaptainApproval(order), true);
    assert.equal(isCaptainKitchenEligible(order), false);
  });

  it("legacy QR already in kitchen remains eligible", () => {
    const order = { status: "PREPARING" as const, source: "QR" as const };
    assert.equal(isCaptainKitchenEligible(order), true);
  });

  it("reject and correction require a reason", () => {
    const bad = captainAuthorizeSchema.safeParse({
      decision: "REJECT",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
    });
    assert.equal(bad.success, false);

    const ok = captainAuthorizeSchema.safeParse({
      decision: "REJECT",
      reason: "Wrong table",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
    });
    assert.equal(ok.success, true);
  });

  it("approve does not require a reason", () => {
    const ok = captainAuthorizeSchema.safeParse({
      decision: "APPROVE",
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
    });
    assert.equal(ok.success, true);
    if (ok.success) assert.equal(ok.data.sendToKitchen, false);
  });
});
