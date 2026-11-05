import type { ServiceRequestStatus, ServiceRequestType } from "@/types/service-request";
import { serviceRequestRepository } from "@/lib/repositories/service-request.repository";

export class ServiceRequestService {
  listOpenForCaptain(restaurantId: string, assignedTableIds: string[]) {
    if (assignedTableIds.length === 0) return Promise.resolve([]);
    return serviceRequestRepository.listOpenForRestaurant(restaurantId, assignedTableIds);
  }

  listForTable(restaurantId: string, tableId: string) {
    return serviceRequestRepository.listForTable(restaurantId, tableId);
  }

  create(input: {
    restaurantId: string;
    tableId: string;
    tableNumber: number;
    captainId?: string;
    type: ServiceRequestType;
    note?: string;
  }) {
    return serviceRequestRepository.create(input);
  }

  updateStatus(restaurantId: string, id: string, status: ServiceRequestStatus) {
    return serviceRequestRepository.updateStatus(restaurantId, id, status);
  }
}

export const serviceRequestService = new ServiceRequestService();
