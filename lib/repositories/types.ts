import type {
  Restaurant,
  Category,
  Dish,
  AddonGroup,
  Addon,
  Media,
  RestaurantTable,
  RestaurantOrder,
  Reservation,
  ReservationStatus,
} from "@/types";

export interface IRestaurantRepository {
  findAll(): Promise<Restaurant[]>;
  findById(id: string): Promise<Restaurant | null>;
  findBySlug(slug: string): Promise<Restaurant | null>;
  create(
    data: Omit<Restaurant, "id" | "createdAt" | "updatedAt">,
  ): Promise<Restaurant>;
  update(id: string, data: Partial<Restaurant>): Promise<Restaurant | null>;
  delete(id: string): Promise<RestaurantDeleteResult>;
}

export type RestaurantDeleteResult =
  | { deleted: true }
  | { deleted: false; reason: "NOT_FOUND" };

export interface ICategoryRepository {
  findByRestaurantId(restaurantId: string): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  create(
    data: Omit<Category, "id" | "createdAt" | "updatedAt">,
  ): Promise<Category>;
  update(id: string, data: Partial<Category>): Promise<Category | null>;
  delete(id: string): Promise<boolean>;
}

export interface IDishRepository {
  findByRestaurantId(restaurantId: string): Promise<Dish[]>;
  findByCategoryId(categoryId: string): Promise<Dish[]>;
  hasMediaReference(restaurantId: string, mediaUrl: string): Promise<boolean>;
  findById(id: string): Promise<Dish | null>;
  create(data: Omit<Dish, "id" | "createdAt" | "updatedAt">): Promise<Dish>;
  update(id: string, data: Partial<Dish>): Promise<Dish | null>;
  delete(id: string): Promise<boolean>;
}

export interface IAddonRepository {
  findGroupsByRestaurantId(restaurantId: string): Promise<AddonGroup[]>;
  findGroupById(id: string): Promise<AddonGroup | null>;
  createGroup(
    data: Omit<AddonGroup, "id" | "addons" | "createdAt" | "updatedAt">,
  ): Promise<AddonGroup>;
  updateGroup(
    id: string,
    data: Partial<AddonGroup>,
  ): Promise<AddonGroup | null>;
  deleteGroup(id: string): Promise<boolean>;

  findAddonsByGroupId(groupId: string): Promise<Addon[]>;
  findAddonById(id: string): Promise<Addon | null>;
  createAddon(
    data: Omit<Addon, "id" | "createdAt" | "updatedAt">,
  ): Promise<Addon>;
  updateAddon(id: string, data: Partial<Addon>): Promise<Addon | null>;
  deleteAddon(id: string): Promise<boolean>;
}

export interface IMediaRepository {
  findByRestaurantId(restaurantId: string): Promise<Media[]>;
  findById(id: string): Promise<Media | null>;
  create(data: Omit<Media, "id" | "createdAt" | "updatedAt">): Promise<Media>;
  delete(id: string): Promise<boolean>;
}

export interface ITableRepository {
  findByRestaurantId(restaurantId: string): Promise<RestaurantTable[]>;
  findBookableByRestaurant(restaurantId: string, guestCount: number): Promise<RestaurantTable[]>;
  findByRestaurantAndNumber(restaurantId: string, tableNumber: number): Promise<RestaurantTable | null>;
  findByRestaurantAndId(restaurantId: string, id: string): Promise<RestaurantTable | null>;
  create(data: Omit<RestaurantTable, "id" | "createdAt" | "updatedAt">): Promise<RestaurantTable>;
  update(restaurantId: string, id: string, data: Partial<RestaurantTable>): Promise<RestaurantTable | null>;
  deleteIfUnused(restaurantId: string, id: string): Promise<boolean>;
}

export interface IOrderRepository {
  create(data: Omit<RestaurantOrder, "orderNumber" | "createdAt" | "updatedAt">): Promise<RestaurantOrder>;
  findByRestaurantId(restaurantId: string): Promise<RestaurantOrder[]>;
  findByRestaurantAndId(restaurantId: string, id: string): Promise<RestaurantOrder | null>;
  findForCustomer(id: string): Promise<RestaurantOrder | null>;
  updateStatus(restaurantId: string, id: string, expectedStatus: RestaurantOrder["status"], status: RestaurantOrder["status"]): Promise<RestaurantOrder | null>;
  recordPayment(
    restaurantId: string,
    id: string,
    method: import("@/types").PaymentMethod,
    amount: number,
    actor: import("@/types").PaymentAuditActor,
    event: import("@/types").PaymentAuditEvent,
  ): Promise<RestaurantOrder | null>;
  correctPayment(
    restaurantId: string,
    id: string,
    newStatus: import("@/types").PaymentStatus,
    newMethod: import("@/types").PaymentMethod | undefined,
    event: import("@/types").PaymentAuditEvent,
  ): Promise<RestaurantOrder | null>;
  hasIdempotencyKey(restaurantId: string, key: string): Promise<boolean>;
}

export interface IReservationRepository {
  findAvailableOverlapping(restaurantId: string, tableIds: string[], startAt: Date, endAt: Date): Promise<Reservation[]>;
  findByRestaurant(restaurantId: string, reservationDate?: string): Promise<Reservation[]>;
  findByRestaurantAndId(restaurantId: string, id: string): Promise<Reservation | null>;
  createForAvailableTable(input: Omit<Reservation, "id" | "createdAt" | "updatedAt">): Promise<Reservation>;
  updateStatus(restaurantId: string, id: string, currentStatus: ReservationStatus, status: ReservationStatus): Promise<Reservation | null>;
}
