import { cache } from "react";
import { restaurantRepository } from "@/lib/repositories/restaurant.repository";
import { tableRepository } from "@/lib/repositories/table.repository";
import type { RestaurantTable } from "@/types";

export class TableServiceError extends Error {}

const listTablesCached = cache((restaurantId: string) => tableRepository.findByRestaurantId(restaurantId));

export class TableService {
  async list(restaurantId: string) {
    return listTablesCached(restaurantId);
  }

  async listBookable(restaurantId: string, guestCount: number) {
    return tableRepository.findBookableByRestaurant(restaurantId, guestCount);
  }

  async getActiveByNumber(restaurantId: string, tableNumber: number) {
    const table = await tableRepository.findByRestaurantAndNumber(restaurantId, tableNumber);
    return table?.isActive ? table : null;
  }

  async create(restaurantId: string, input: { locationType?: RestaurantTable["locationType"]; tableNumber: number; label?: string; capacity: number; isActive?: boolean; status?: RestaurantTable["status"] }) {
    if (!(await restaurantRepository.findById(restaurantId))) throw new TableServiceError("Restaurant not found.");
    if (await tableRepository.findByRestaurantAndNumber(restaurantId, input.tableNumber)) {
      throw new TableServiceError("A table with this number already exists.");
    }
    return tableRepository.create({
      restaurantId,
      locationType: input.locationType ?? "TABLE",
      tableNumber: input.tableNumber,
      label: input.label?.trim() || undefined,
      capacity: input.capacity,
      isActive: input.isActive ?? true,
      status: input.status ?? "OPEN",
    });
  }

  async update(restaurantId: string, id: string, input: Partial<Pick<RestaurantTable, "locationType" | "tableNumber" | "label" | "capacity" | "isActive" | "status">>) {
    if (input.tableNumber !== undefined) {
      const duplicate = await tableRepository.findByRestaurantAndNumber(restaurantId, input.tableNumber);
      if (duplicate && duplicate.id !== id) throw new TableServiceError("A table with this number already exists.");
    }
    return tableRepository.update(restaurantId, id, {
      ...input,
      label: input.label === undefined ? undefined : input.label.trim(),
    });
  }

  async delete(restaurantId: string, id: string) {
    const table = await tableRepository.findByRestaurantAndId(restaurantId, id);
    if (!table) return { deleted: false as const, reason: "NOT_FOUND" as const };
    const deleted = await tableRepository.deleteIfUnused(restaurantId, id);
    return deleted
      ? { deleted: true as const }
      : { deleted: false as const, reason: "HAS_REFERENCES" as const };
  }
}

export const tableService = new TableService();
