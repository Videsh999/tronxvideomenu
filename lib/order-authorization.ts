import type { CaptainAuthorization, CaptainAuthorizationStatus, OrderStatus, RestaurantOrder } from "@/types";

export function defaultAuthorizationForSource(
  entrySource: CaptainAuthorization["entrySource"],
): CaptainAuthorization {
  if (entrySource === "CUSTOMER_QR") {
    return { status: "PENDING_CAPTAIN_APPROVAL", entrySource };
  }
  if (entrySource === "CAPTAIN_DIRECT") {
    return { status: "CAPTAIN_APPROVED", entrySource };
  }
  return { status: "NOT_REQUIRED", entrySource: "POS" };
}

export function authorizationForCustomerQr(requiresCaptainApproval: boolean): CaptainAuthorization {
  return requiresCaptainApproval
    ? defaultAuthorizationForSource("CUSTOMER_QR")
    : { status: "NOT_REQUIRED", entrySource: "CUSTOMER_QR" };
}

export function resolveAuthorization(
  order: Pick<RestaurantOrder, "captainAuthorization" | "source" | "channel" | "status">,
): CaptainAuthorization {
  if (order.captainAuthorization?.status) return order.captainAuthorization;

  const kitchenStatuses: OrderStatus[] = ["ACCEPTED", "PREPARING", "READY", "SERVED", "COMPLETED"];
  if (order.source === "QR" || order.channel === "QR") {
    // Legacy QR already in kitchen stays eligible; pending legacy QR requires captain approval.
    if (kitchenStatuses.includes(order.status)) {
      return { status: "NOT_REQUIRED", entrySource: "CUSTOMER_QR" };
    }
    return { status: "PENDING_CAPTAIN_APPROVAL", entrySource: "CUSTOMER_QR" };
  }
  if (order.source === "CAPTAIN") {
    return { status: "CAPTAIN_APPROVED", entrySource: "CAPTAIN_DIRECT" };
  }
  return { status: "NOT_REQUIRED", entrySource: "POS" };
}

export function isCaptainKitchenEligible(
  order: Pick<RestaurantOrder, "captainAuthorization" | "source" | "channel" | "status">,
) {
  const status = resolveAuthorization(order).status;
  return status === "CAPTAIN_APPROVED" || status === "NOT_REQUIRED";
}

export function isPendingCaptainApproval(
  order: Pick<RestaurantOrder, "captainAuthorization" | "source" | "channel" | "status">,
) {
  if (!["PENDING", "ACCEPTED"].includes(order.status)) return false;
  return resolveAuthorization(order).status === "PENDING_CAPTAIN_APPROVAL";
}

export function authorizationBlocksKitchen(status: CaptainAuthorizationStatus) {
  return (
    status === "PENDING_CAPTAIN_APPROVAL" ||
    status === "REJECTED" ||
    status === "CORRECTION_REQUESTED"
  );
}
