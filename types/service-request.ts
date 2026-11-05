export type ServiceRequestType =
  | "WATER"
  | "EXTRA_PLATES"
  | "CUTLERY"
  | "NAPKINS"
  | "ASSISTANCE"
  | "CLEANING"
  | "BILL"
  | "OTHER";

export type ServiceRequestStatus = "OPEN" | "ACKNOWLEDGED" | "IN_PROGRESS" | "DONE" | "CANCELLED";

export type ServiceRequest = {
  id: string;
  restaurantId: string;
  tableId: string;
  tableNumber: number;
  captainId?: string;
  type: ServiceRequestType;
  note?: string;
  status: ServiceRequestStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};
