import crypto from "node:crypto";

export type RazorpayQrPayment = { id: string; amount: number; currency: string; status: string };

type RazorpayQr = { id: string; image_url?: string; close_by?: number; status?: string };

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) throw new Error("Dynamic UPI QR is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  return { keyId, keySecret };
}

function authHeader() {
  const { keyId, keySecret } = credentials();
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

async function razorpay<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: { Authorization: authHeader(), "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await response.json()) as T & { error?: { description?: string } };
  if (!response.ok) throw new Error(body.error?.description ?? "Razorpay request failed.");
  return body;
}

export function isRazorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export async function createRazorpayQr(input: {
  amount: number;
  referenceId: string;
  description: string;
  notes: Record<string, string>;
  expiresAt: Date;
}) {
  const body = await razorpay<RazorpayQr>("/payments/qr_codes", {
    method: "POST",
    body: JSON.stringify({
      type: "upi_qr",
      name: input.description.slice(0, 40),
      usage: "single_use",
      fixed_amount: true,
      payment_amount: Math.round(input.amount * 100),
      description: input.description.slice(0, 255),
      close_by: Math.floor(input.expiresAt.getTime() / 1000),
      notes: input.notes,
    }),
  });
  return { id: body.id, imageUrl: body.image_url, closeBy: body.close_by };
}

export async function listRazorpayQrPayments(qrId: string) {
  const body = await razorpay<{ items?: RazorpayQrPayment[] }>(`/payments/qr_codes/${encodeURIComponent(qrId)}/payments`);
  return body.items ?? [];
}

export async function closeRazorpayQr(qrId: string) {
  await razorpay(`/payments/qr_codes/${encodeURIComponent(qrId)}/close`, { method: "POST", body: "{}" });
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
