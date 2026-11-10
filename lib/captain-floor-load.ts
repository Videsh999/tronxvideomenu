import "server-only";

import { orderService } from "@/lib/services/order.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { tableService } from "@/lib/services/table.service";

export async function loadCaptainFloor(restaurantId: string, slug: string) {
  const [tables, orders, menu] = await Promise.all([
    tableService.list(restaurantId),
    orderService.listForRestaurant(restaurantId).catch(() => []),
    restaurantService.getFullMenu(slug),
  ]);
  const categories = (menu?.categories ?? [])
    .filter((category) => category.isActive !== false)
    .map((category) => ({ id: category.id, name: category.name }));
  const dishes = (menu?.dishes ?? [])
    .filter((dish) => dish.isAvailable && dish.restaurantId === restaurantId)
    .map((dish) => ({
      id: dish.id,
      name: dish.name,
      price: dish.price,
      categoryId: dish.categoryId,
      variants: (dish.variants ?? [])
        .filter((variant) => variant.isAvailable !== false)
        .map((variant) => ({ id: variant.id, name: variant.name, price: variant.price })),
    }));
  return {
    tables: tables.filter((table) => table.restaurantId === restaurantId),
    orders,
    categories,
    dishes,
  };
}
