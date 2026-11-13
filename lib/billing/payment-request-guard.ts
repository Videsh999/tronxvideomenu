/**
 * TODO: An ACTIVE PaymentRequest must be superseded when its order moves, merges, or splits.
 * That payment document does not exist yet. Until it does, the floor refuses the transfer
 * instead of leaving a request pointed at the old check.
 */
export class PaymentRequestNotImplemented extends Error {
  readonly code = "NOT_IMPLEMENTED" as const;
  constructor() {
    super("Superseding an ACTIVE PaymentRequest is not implemented.");
  }
}

export function assertNoActivePaymentRequest(order: { paymentRequestStatus?: string | null }) {
  if (order.paymentRequestStatus === "ACTIVE") {
    throw new PaymentRequestNotImplemented();
  }
}
