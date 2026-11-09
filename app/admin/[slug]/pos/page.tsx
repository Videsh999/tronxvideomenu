import { notFound } from "next/navigation";
import PosTerminal from "@/components/admin/PosTerminal";
import { restaurantService } from "@/lib/services/restaurant.service";
import { tableRepository } from "@/lib/repositories/table.repository";
import { posShiftService } from "@/lib/services/pos-shift.service";
import { requireRestaurantFeature } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function PosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const menu = await restaurantService.getFullMenu(slug);
  if (!menu || !requireRestaurantFeature(menu.restaurant, "POS").allowed) notFound();

  const tables = await tableRepository.findByRestaurantId(menu.restaurant.id);
  const shift = await posShiftService.getOpen(menu.restaurant.id);

  return (
    <PosTerminal
      restaurantName={menu.restaurant.name}
      currency={menu.restaurant.currency ?? "INR"}
      taxRatePercent={menu.restaurant.billing?.taxRatePercent ?? 0}
      taxLabel={menu.restaurant.billing?.taxLabel ?? "Tax"}
      categories={menu.categories.filter((category) => category.isActive)}
      dishes={menu.dishes}
      tables={tables.filter((table) => table.isActive && table.status !== "CLOSED")}
      initialShift={shift}
      upiSettings={{
        enabled: menu.restaurant.billing?.upiEnabled === true,
        upiId: menu.restaurant.billing?.upiId ?? "",
        payeeName: menu.restaurant.billing?.upiPayeeName || menu.restaurant.name,
        staticQrUrl: menu.restaurant.billing?.upiStaticQrUrl,
      }}
    />
  );
}
