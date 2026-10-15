import type {
  Restaurant,
  Category,
  Dish,
  AddonGroup,
  Addon,
  Media,
  RestaurantMenu,
  ApiResponse,
  RestaurantTable,
  RestaurantOrder,
  OrderSummary,
} from "@/types";
import type {
  CreateCategoryInput,
  CreateDishInput,
  CreateAddonGroupInput,
  CreateAddonInput,
} from "@/lib/validations";
async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  const json: ApiResponse<T> = await res.json();
  if (!json.success) {
    throw new Error(json.error || "An error occurred");
  }

  return json.data;
}

export const api = {
  // Tables and restaurant order management
  getTables: () => fetcher<RestaurantTable[]>("/api/tables"),
  createTable: (data: { tableNumber: number; label?: string; capacity: number }) =>
    fetcher<RestaurantTable>("/api/tables", { method: "POST", body: JSON.stringify(data) }),
  updateTable: (id: string, data: Partial<Pick<RestaurantTable, "tableNumber" | "label" | "capacity" | "isActive" | "status">>) =>
    fetcher<RestaurantTable>(`/api/tables/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTable: (id: string) => fetcher<{ deleted: boolean }>(`/api/tables/${id}`, { method: "DELETE" }),
  getOrders: () => fetcher<OrderSummary[]>("/api/orders"),
  updateOrderStatus: (id: string, status: RestaurantOrder["status"]) =>
    fetcher<OrderSummary>(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  recordPayment: (id: string, method: import("@/types").PaymentMethod) =>
    fetcher<OrderSummary>(`/api/orders/${id}/payment`, {
      method: "POST",
      body: JSON.stringify({ method }),
    }),
  correctPayment: (
    id: string,
    data: { action: "CORRECTION" | "REVERSAL"; method?: import("@/types").PaymentMethod; reason: string },
  ) =>
    fetcher<OrderSummary>(`/api/orders/${id}/payment`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  // Public Menu
  getPublicMenu: (restaurantIdOrSlug: string) =>
    fetcher<RestaurantMenu>(`/api/restaurants/${restaurantIdOrSlug}?fullMenu=true`),

  // Media
  getMedia: (restaurantId: string) =>
    fetcher<Media[]>(`/api/media?restaurantId=${restaurantId}`),
  uploadMedia: async (file: File, restaurantId: string) => {
    const body = new FormData();
    body.append("file", file);
    body.append("restaurantId", restaurantId);

    const res = await fetch("/api/media/upload", {
      method: "POST",
      body,
    });
    const json: ApiResponse<Media> = await res.json();
    if (!json.success) {
      throw new Error(json.error || "An error occurred");
    }
    return json.data;
  },
  deleteMedia: (id: string) =>
    fetcher<{ message: string }>(`/api/media/${id}`, {
      method: "DELETE",
    }),

  // Restaurants
  getRestaurant: (id: string) => fetcher<Restaurant>(`/api/restaurants/${id}`),
  updateRestaurant: (id: string, data: Partial<Restaurant>) =>
    fetcher<Restaurant>(`/api/restaurants/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Categories
  getCategories: (restaurantId: string) =>
    fetcher<Category[]>(`/api/categories?restaurantId=${restaurantId}`),
  createCategory: (data: CreateCategoryInput) =>
    fetcher<Category>("/api/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCategory: (id: string, data: Partial<Category>) =>
    fetcher<Category>(`/api/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteCategory: (id: string) =>
    fetcher<{ message: string }>(`/api/categories/${id}`, {
      method: "DELETE",
    }),

  // Dishes
  getDishes: (restaurantId: string, categoryId?: string) => {
    const params = new URLSearchParams({ restaurantId });
    if (categoryId) params.append("categoryId", categoryId);
    return fetcher<Dish[]>(`/api/dishes?${params.toString()}`);
  },
  createDish: (data: CreateDishInput) =>
    fetcher<Dish>("/api/dishes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateDish: (id: string, data: Partial<Dish>) =>
    fetcher<Dish>(`/api/dishes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteDish: (id: string) =>
    fetcher<{ message: string }>(`/api/dishes/${id}`, {
      method: "DELETE",
    }),

  // Add-ons
  getAddonGroups: (restaurantId: string) =>
    fetcher<AddonGroup[]>(`/api/addon-groups?restaurantId=${restaurantId}`),
  createAddonGroup: (data: CreateAddonGroupInput) =>
    fetcher<AddonGroup>("/api/addon-groups", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAddonGroup: (id: string, data: Partial<AddonGroup>) =>
    fetcher<AddonGroup>(`/api/addon-groups/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteAddonGroup: (id: string) =>
    fetcher<{ message: string }>(`/api/addon-groups/${id}`, {
      method: "DELETE",
    }),

  // Add-on Items
  createAddon: (data: CreateAddonInput) =>
    fetcher<Addon>("/api/addons", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAddon: (id: string, data: Partial<Addon>) =>
    fetcher<Addon>(`/api/addons/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteAddon: (id: string) =>
    fetcher<{ message: string }>(`/api/addons/${id}`, {
      method: "DELETE",
    }),
};
