import { connectToDatabase } from "../lib/db/mongodb";
import { menuOfferService } from "../lib/services/menu-offer.service";
import { restaurantEnrichmentService } from "../lib/services/restaurant-enrichment.service";
import { hasRestaurantFeature } from "../lib/features";
import { RestaurantModel } from "../lib/db/models";

async function main() {
  await connectToDatabase();
  const restaurant = await RestaurantModel.findOne({ slug: "cheese" }).lean();
  if (!restaurant) throw new Error("Cheese restaurant missing — run seed-cheese first");

  const probe = {
    subscriptionPlan: restaurant.subscriptionPlan,
    subscriptionEnabled: restaurant.subscriptionEnabled,
    featureOverrides: restaurant.featureOverrides as Record<string, boolean> | undefined,
  };
  const offersOn = hasRestaurantFeature(probe, "MENU_OFFERS");
  console.log(JSON.stringify({ slug: restaurant.slug, plan: restaurant.subscriptionPlan, MENU_OFFERS: offersOn }, null, 2));

  const before = await menuOfferService.list("cheese");
  console.log("offers_before", before.length);

  const created = await menuOfferService.create("cheese", {
    name: "Verify Festive 25",
    percentOff: 25,
    scope: "ALL_MENU",
    isActive: true,
    presentation: {
      themePreset: "CHRISTMAS",
      bannerHeadline: "Festive 25% off",
      bannerSubtext: "All menu",
      badgeText: "25% OFF",
      applyTheme: true,
    },
  });
  console.log("created", created.id, created.isActive);

  const stopped = await menuOfferService.update("cheese", created.id, { isActive: false });
  console.log("stopped", stopped.isActive);

  const running = await menuOfferService.update("cheese", created.id, { isActive: true });
  console.log("running", running.isActive);

  const enrich = await restaurantEnrichmentService.enrich({
    name: "Paradise Restaurant",
    location: "Secunderabad Hyderabad",
  });
  console.log(
    JSON.stringify(
      {
        enrichName: enrich.proposal.name,
        address: enrich.proposal.address?.slice(0, 120),
        phone: enrich.proposal.phone,
        website: enrich.proposal.socialLinks?.website,
        sources: enrich.sources.map((s) => s.label),
        photoFeasible: enrich.photoAutomation.feasible,
        notes: enrich.notes,
      },
      null,
      2,
    ),
  );

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
