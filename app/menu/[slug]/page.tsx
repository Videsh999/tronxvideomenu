import { notFound } from "next/navigation";
import CustomerMenu from "@/components/customer/CustomerMenu";
import ThemeProvider from "@/components/customer/ThemeProvider";
import { I18nProvider } from "@/components/customer/I18nProvider";
import { restaurantService } from "@/lib/services/restaurant.service";
import { tableService } from "@/lib/services/table.service";
import { hasRestaurantFeature } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function RestaurantMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string | string[]; view?: string | string[] }>;
}) {
  const { slug } = await params;
  const { table: rawTable, view: rawView } = await searchParams;
  const menu = await restaurantService.getFullMenu(slug);

  if (!menu) notFound();

  const tableValue = Array.isArray(rawTable) ? rawTable[0] : rawTable;
  const tableNumber =
    tableValue && /^\d{1,4}$/.test(tableValue) ? Number(tableValue) : null;
  const table = tableNumber
    ? await tableService.getActiveByNumber(menu.restaurant.id, tableNumber)
    : null;
  const invalidTable = Boolean(tableValue) && (!tableNumber || !table);
  const reservationsEnabled = hasRestaurantFeature(menu.restaurant, "RESERVATIONS");
  const wifiEnabled = hasRestaurantFeature(menu.restaurant, "WIFI");
  const videoMenuEnabled = hasRestaurantFeature(menu.restaurant, "VIDEO_MENU");
  const tableOrderingEnabled = hasRestaurantFeature(menu.restaurant, "TABLE_ORDERING");
  const view = Array.isArray(rawView) ? rawView[0] : rawView;

  return (
    <ThemeProvider restaurant={menu.restaurant}>
      <I18nProvider slug={menu.restaurant.slug}>
      <CustomerMenu
        initialMenu={menu}
        restaurantIdOrSlug={slug}
        tableNumber={table?.tableNumber ?? null}
        tableId={table?.id ?? null}
        tableStatus={table?.status ?? null}
        invalidTable={invalidTable}
        reservationsEnabled={reservationsEnabled}
        initialReservationView={reservationsEnabled && view === "reservation"}
        wifiEnabled={wifiEnabled}
        videoMenuEnabled={videoMenuEnabled}
        tableOrderingEnabled={tableOrderingEnabled}
      />
      </I18nProvider>
    </ThemeProvider>
  );
}
