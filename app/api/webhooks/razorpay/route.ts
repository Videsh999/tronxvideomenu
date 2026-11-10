import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { DynamicPaymentRequestModel } from "@/lib/db/models";
import { toDomain } from "@/lib/db/mongo-mappers";
import { settleDynamicUpiRequest } from "@/lib/payments/dynamic-payment.service";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/razorpay-qr";
import type { DynamicPaymentRequest } from "@/types";

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyRazorpayWebhookSignature(raw, request.headers.get("x-razorpay-signature"))) {
    return NextResponse.json({ success: false, error: "Invalid webhook signature." }, { status: 401 });
  }
  const eventId = request.headers.get("x-razorpay-event-id") ?? crypto.createHash("sha256").update(raw).digest("hex");
  const payload = JSON.parse(raw) as Record<string, unknown>;
  const json = JSON.stringify(payload);
  const requestDoc = await DynamicPaymentRequestModel.findOne({
    $or: [
      { providerQrId: json.match(/qr_[A-Za-z0-9]+/)?.[0] },
      { paymentReferenceId: json.match(/TRX-[A-Za-z0-9-]+/)?.[0] },
    ],
  }).lean();
  if (!requestDoc) return NextResponse.json({ success: true, ignored: true });
  const paymentRequest = toDomain<DynamicPaymentRequest>(requestDoc);
  if (paymentRequest.providerEventIds?.includes(eventId) || paymentRequest.status === "PAID") return NextResponse.json({ success: true, duplicate: true });
  const payment = (payload.payload as Record<string, unknown> | undefined)?.payment as Record<string, unknown> | undefined;
  const entity = payment?.entity as Record<string, unknown> | undefined;
  try {
    await settleDynamicUpiRequest(paymentRequest, {
      id: String(entity?.id ?? "webhook-payment"),
      amount: Number(entity?.amount ?? 0),
      currency: String(entity?.currency ?? ""),
      status: String(entity?.status ?? ""),
    }, { role: "RESTAURANT_ADMIN", id: "razorpay-webhook", name: "Razorpay webhook" });
    await DynamicPaymentRequestModel.updateOne({ id: paymentRequest.id }, { $addToSet: { providerEventIds: eventId }, $set: { updatedAt: new Date().toISOString() } });
  } catch (error) {
    await DynamicPaymentRequestModel.updateOne({ id: paymentRequest.id }, { $addToSet: { providerEventIds: eventId }, $set: { failureReason: error instanceof Error ? error.message : "Webhook payment rejected", updatedAt: new Date().toISOString() } });
  }
  return NextResponse.json({ success: true });
}
