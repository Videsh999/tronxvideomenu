import { randomUUID } from "node:crypto";
import { DynamicPaymentRequestModel } from "@/lib/db/models";
import { toDomain } from "@/lib/db/mongo-mappers";
import { orderService } from "@/lib/services/order.service";
import type { DynamicPaymentRequest, PaymentAuditActor, Restaurant, RestaurantOrder } from "@/types";
import { closeRazorpayQr, createRazorpayQr, isRazorpayConfigured, listRazorpayQrPayments } from "./razorpay-qr";

const money = (value: number) => Math.round(value * 100) / 100;

function activeRequest(request: DynamicPaymentRequest | null) {
  return request && ["CREATING", "PENDING"].includes(request.status) && new Date(request.expiresAt).getTime() > Date.now();
}

export async function createDynamicUpiRequest(input: {
  restaurant: Restaurant;
  order: Pick<RestaurantOrder, "id" | "orderNumber" | "tableSessionId" | "total" | "payment">;
  actor: PaymentAuditActor;
}) {
  if (!isRazorpayConfigured()) throw new Error("Dynamic UPI QR is not configured. Ask the restaurant owner to connect Razorpay merchant credentials.");
  const existing = await DynamicPaymentRequestModel.findOne({
    restaurantId: input.restaurant.id,
    orderId: input.order.id,
    status: { $in: ["CREATING", "PENDING"] },
  }).sort({ createdAt: -1 }).lean();
  if (existing) {
    const mapped = toDomain<DynamicPaymentRequest>(existing);
    if (activeRequest(mapped)) return mapped;
  }

  const paid = input.order.payment?.amountPaid ?? 0;
  const amount = money(input.order.total - paid);
  if (amount <= 0) throw new Error("This order has no outstanding balance.");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  const paymentReferenceId = `TRX-${input.restaurant.id.slice(-8)}-${input.order.orderNumber}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const created = await createRazorpayQr({
    amount,
    referenceId: paymentReferenceId,
    description: `${input.restaurant.name} Bill #${input.order.orderNumber}`,
    expiresAt,
    notes: {
      tronx_reference: paymentReferenceId,
      restaurant_id: input.restaurant.id,
      organization_id: input.restaurant.organizationId ?? input.restaurant.id,
      outlet_id: input.restaurant.id,
      order_id: input.order.id,
      bill_id: input.order.id,
    },
  });
  const request: DynamicPaymentRequest = {
    id: `payreq-${randomUUID()}`,
    restaurantId: input.restaurant.id,
    organizationId: input.restaurant.organizationId ?? input.restaurant.id,
    outletId: input.restaurant.id,
    orderId: input.order.id,
    tableSessionId: input.order.tableSessionId,
    billId: input.order.id,
    billVersion: 1,
    paymentReferenceId,
    merchantAccountId: process.env.RAZORPAY_KEY_ID ?? "",
    provider: "RAZORPAY",
    providerQrId: created.id,
    qrImageUrl: created.imageUrl,
    amount,
    currency: "INR",
    status: "PENDING",
    expiresAt: expiresAt.toISOString(),
    providerEventIds: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await DynamicPaymentRequestModel.create(request);
  return request;
}

export async function getDynamicUpiRequest(restaurantId: string, id: string) {
  const request = await DynamicPaymentRequestModel.findOne({ restaurantId, $or: [{ id }, { orderId: id }] }).sort({ createdAt: -1 }).lean();
  return request ? toDomain<DynamicPaymentRequest>(request) : null;
}

export async function settleDynamicUpiRequest(request: DynamicPaymentRequest, payment: { id: string; amount: number; currency: string; status: string }, actor: PaymentAuditActor) {
  if (request.status === "PAID") return request;
  if (payment.currency !== "INR" || payment.amount !== Math.round(request.amount * 100)) {
    await DynamicPaymentRequestModel.updateOne({ id: request.id, status: { $ne: "PAID" } }, { $set: { status: "WRONG_AMOUNT", failureReason: "Provider amount or currency did not match the bill.", updatedAt: new Date().toISOString() } });
    throw new Error("Payment amount or currency does not match this bill.");
  }
  if (payment.status !== "captured" && payment.status !== "paid") return request;
  const claimed = await DynamicPaymentRequestModel.findOneAndUpdate(
    { id: request.id, status: { $in: ["CREATING", "PENDING", "PARTIAL"] } },
    { $set: { status: "PROCESSING", updatedAt: new Date().toISOString() } },
    { new: true },
  ).lean();
  if (!claimed) return (await getDynamicUpiRequest(request.restaurantId, request.id)) ?? request;
  let updatedOrder;
  try {
    updatedOrder = await orderService.recordPayment(request.restaurantId, request.orderId, "UPI", actor, request.amount);
  } catch (error) {
    await DynamicPaymentRequestModel.updateOne({ id: request.id, status: "PROCESSING" }, { $set: { status: "PENDING", failureReason: error instanceof Error ? error.message : "Ledger write failed", updatedAt: new Date().toISOString() } });
    throw error;
  }
  if (!updatedOrder) throw new Error("The payment could not be written to the order ledger.");
  const updated = await DynamicPaymentRequestModel.findOneAndUpdate(
    { id: request.id, status: "PROCESSING" },
    { $set: { status: "PAID", providerPaymentId: payment.id, updatedAt: new Date().toISOString() } },
    { new: true },
  ).lean();
  return updated ? toDomain<DynamicPaymentRequest>(updated) : request;
}

export async function refreshDynamicUpiRequest(request: DynamicPaymentRequest, actor: PaymentAuditActor) {
  if (request.status === "PAID") return request;
  if (new Date(request.expiresAt).getTime() <= Date.now()) {
    await DynamicPaymentRequestModel.updateOne({ id: request.id, status: { $in: ["CREATING", "PENDING"] } }, { $set: { status: "EXPIRED", updatedAt: new Date().toISOString() } });
    return { ...request, status: "EXPIRED" as const };
  }
  const payments = await listRazorpayQrPayments(request.providerQrId);
  const match = payments.find((entry) => entry.currency === "INR" && entry.amount === Math.round(request.amount * 100));
  if (match) return settleDynamicUpiRequest(request, match, actor);
  if (payments.some((entry) => entry.status === "captured" || entry.status === "paid")) {
    await DynamicPaymentRequestModel.updateOne({ id: request.id }, { $set: { status: "WRONG_AMOUNT", failureReason: "A captured payment did not match the bill amount.", updatedAt: new Date().toISOString() } });
    return { ...request, status: "WRONG_AMOUNT" as const };
  }
  return request;
}

export async function cancelDynamicUpiRequest(request: DynamicPaymentRequest) {
  if (["PAID", "EXPIRED", "CANCELLED"].includes(request.status)) return request;
  await closeRazorpayQr(request.providerQrId);
  const updated = await DynamicPaymentRequestModel.findOneAndUpdate({ id: request.id, status: { $in: ["CREATING", "PENDING"] } }, { $set: { status: "CANCELLED", updatedAt: new Date().toISOString() } }, { new: true }).lean();
  return updated ? toDomain<DynamicPaymentRequest>(updated) : request;
}
