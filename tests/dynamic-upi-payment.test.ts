import assert from "node:assert/strict";
import test from "node:test";
import { createRazorpayQr, verifyRazorpayWebhookSignature } from "../lib/payments/razorpay-qr";
import crypto from "node:crypto";

test("Razorpay dynamic QR requests the exact INR amount in paise", async () => {
  const previousFetch = globalThis.fetch;
  const previousId = process.env.RAZORPAY_KEY_ID;
  const previousSecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_ID = "rzp_test_merchant";
  process.env.RAZORPAY_KEY_SECRET = "secret";
  let body = "";
  globalThis.fetch = async (_input, init) => {
    body = String(init?.body ?? "");
    return new Response(JSON.stringify({ id: "qr_test_1029", image_url: "https://example.test/qr.png" }), { status: 200 });
  };
  await createRazorpayQr({ amount: 193.2, referenceId: "TRX-BILL-1029", description: "Triparna Kitchen Bill #1029", notes: {}, expiresAt: new Date(Date.now() + 60_000) });
  assert.equal(JSON.parse(body).payment_amount, 19320);
  assert.equal(JSON.parse(body).fixed_amount, true);
  globalThis.fetch = previousFetch;
  if (previousId === undefined) delete process.env.RAZORPAY_KEY_ID; else process.env.RAZORPAY_KEY_ID = previousId;
  if (previousSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET = previousSecret;
});

test("Razorpay webhook signatures are HMAC verified", () => {
  const previous = process.env.RAZORPAY_WEBHOOK_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret";
  const payload = JSON.stringify({ event: "qr_code.credited" });
  const signature = crypto.createHmac("sha256", "webhook-secret").update(payload).digest("hex");
  assert.equal(verifyRazorpayWebhookSignature(payload, signature), true);
  assert.equal(verifyRazorpayWebhookSignature(payload, "bad"), false);
  if (previous === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET; else process.env.RAZORPAY_WEBHOOK_SECRET = previous;
});
