import mongoose from "mongoose";
import { demoMenu } from "../lib/constants";
import { connectToDatabase } from "../lib/db/mongodb";
import {
  AddonGroupModel,
  AddonModel,
  CategoryModel,
  DishModel,
  MediaModel,
  RestaurantModel,
  TableModel,
} from "../lib/db/models";

type SeedRecord = Record<string, unknown> & { id: string };

const nativeSouthMenu = {
  restaurant: {
    id: "native-south",
    name: "Native South",
    slug: "native-south",
    logoUrl:
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=200&q=80",
    coverUrl:
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1600&q=80",
    isOpen: true,
    isActive: true,
  },
  categories: [
    { id: "cat-1", name: "Small Plates", sortOrder: 1, isActive: true },
    { id: "cat-2", name: "Mains", sortOrder: 2, isActive: true },
  ],
  dishes: [
    {
      id: "dish-1",
      categoryId: "cat-1",
      name: "Coconut Curry Bowl",
      description:
        "A creamy, aromatic curry built with seasonal vegetables, herbs, and a warming spice finish.",
      price: 289,
      imageUrl:
        "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80",
      videoUrl: "/videos/demo-video-1.mp4",
      videoPosterUrl: "",
      isVeg: true,
      isAvailable: true,
      sortOrder: 1,
      addonGroups: [
        {
          id: "addon-group-1",
          name: "Choose Base",
          isRequired: true,
          minSelect: 1,
          maxSelect: 1,
          addons: [
            { id: "ad-1", name: "Steamed Rice", price: 0, isAvailable: true },
            { id: "ad-2", name: "Appam", price: 40, isAvailable: true },
          ],
        },
      ],
    },
    {
      id: "dish-2",
      categoryId: "cat-2",
      name: "Mysore Pepper Roast",
      description:
        "Fire-roasted peppers, spices, and slow-cooked vegetables with a deep pepper finish.",
      price: 349,
      imageUrl:
        "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=800&q=80",
      videoUrl: "/videos/demo-video-2.mp4",
      videoPosterUrl: "",
      isVeg: false,
      isAvailable: true,
      sortOrder: 1,
    },
  ],
};

const seededMenus = new Map([
  [demoMenu.restaurant.id, demoMenu],
  [nativeSouthMenu.restaurant.id, nativeSouthMenu],
]);

async function upsertMany<T extends { id: string }>(
  model: {
    updateOne: (
      filter: Record<string, unknown>,
      update: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => Promise<unknown>;
  },
  records: T[],
): Promise<number> {
  let upserted = 0;

  for (const record of records) {
    const result = await model.updateOne(
      { id: record.id },
      { $set: record },
      { upsert: true },
    );
    upserted += Number(
      (result as { upsertedCount?: number }).upsertedCount ?? 0,
    );
  }

  return upserted;
}

async function upsertDemoTables(
  tables: Array<{ id: string; restaurantId: string; tableNumber: number; capacity: number; isActive: boolean; status: "OPEN"; createdAt: string; updatedAt: string }>,
): Promise<number> {
  let upserted = 0;
  for (const table of tables) {
    const result = await TableModel.updateOne(
      { restaurantId: table.restaurantId, tableNumber: table.tableNumber },
      { $setOnInsert: table, $set: { capacity: table.capacity } },
      { upsert: true },
    );
    upserted += result.upsertedCount;
  }
  return upserted;
}

async function purgeLegacyRestaurantData(): Promise<void> {
  const legacyIds = ["tronx-restaurant", "restaurant-1"];
  const legacyGroups = await AddonGroupModel.find(
    { restaurantId: { $in: legacyIds } },
    { id: 1 },
  ).lean();
  const legacyGroupIds = legacyGroups.map((group) => String(group.id));

  await AddonModel.deleteMany({
    $or: [
      { id: { $in: legacyIds } },
      { addonGroupId: { $in: legacyGroupIds } },
    ],
  });
  await RestaurantModel.deleteMany({ id: { $in: legacyIds } });
  await CategoryModel.deleteMany({ restaurantId: { $in: legacyIds } });
  await DishModel.deleteMany({ restaurantId: { $in: legacyIds } });
  await AddonGroupModel.deleteMany({ restaurantId: { $in: legacyIds } });
  await MediaModel.deleteMany({ restaurantId: { $in: legacyIds } });
}

async function seed(): Promise<void> {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    (process.env.MONGODB_URI &&
      !process.env.MONGODB_URI.includes("localhost") &&
      !process.env.MONGODB_URI.includes("127.0.0.1") &&
      !process.env.MONGODB_URI.includes("test"));

  if (isProduction && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    console.error(
      "\n⛔ SAFEGUARD BLOCKED SEEDING:\n" +
        "Attempted to run seed script against a production or non-local database.\n" +
        "To explicitly proceed, you must set ALLOW_PRODUCTION_SEED=true in your environment.\n",
    );
    process.exit(1);
  }

  await connectToDatabase();
  const now = new Date().toISOString();

  await purgeLegacyRestaurantData();

  const restaurants = [...seededMenus.entries()].map(
    ([restaurantId, menu]) => ({
      id: restaurantId,
      name: menu.restaurant.name,
      slug: menu.restaurant.slug,
      logo: menu.restaurant.logoUrl,
      coverImage: menu.restaurant.coverUrl,
      logoUrl: menu.restaurant.logoUrl,
      coverUrl: menu.restaurant.coverUrl,
      description:
        restaurantId === "moai-kitchen"
          ? "Asian-inspired small plates, rice bowls, and house-made sauces."
          : "South Indian classics, coastal flavors, and freshly ground spices.",
      phone:
        restaurantId === "moai-kitchen" ? "+91 98765 43210" : "+91 98765 43211",
      address:
        restaurantId === "moai-kitchen"
          ? "100ft Road, Indiranagar, Bengaluru, Karnataka"
          : "12th Main Road, Jayanagar, Bengaluru, Karnataka",
      openingHours:
        restaurantId === "moai-kitchen"
          ? "11:00 AM - 11:30 PM"
          : "8:00 AM - 10:30 PM",
      isOpen: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }),
  );

  let insertedRestaurants = 0;
  for (const restaurant of restaurants) {
    const result = await RestaurantModel.updateOne(
      { id: restaurant.id },
      { $set: restaurant },
      { upsert: true },
    );
    insertedRestaurants += result.upsertedCount ?? 0;
  }

  const inserted: Record<string, number> = { restaurants: insertedRestaurants, tables: 0 };

  for (const [restaurantId, menu] of seededMenus.entries()) {
    const demoTables = Array.from({ length: restaurantId === "moai-kitchen" ? 6 : 5 }, (_, index) => ({
      id: `${restaurantId}-table-${index + 1}`,
      restaurantId,
      tableNumber: index + 1,
      capacity: index === 0 ? 2 : 4,
      isActive: true,
      status: "OPEN" as const,
      createdAt: now,
      updatedAt: now,
    }));
    inserted.tables += await upsertDemoTables(demoTables);

    const categoryMap = new Map(
      menu.categories.map((category, index) => [
        category.id,
        `${restaurantId}-cat-${index + 1}`,
      ]),
    );

    const categories = menu.categories.map((category, index) => ({
      id: `${restaurantId}-cat-${index + 1}`,
      restaurantId,
      name: category.name,
      slug: `${restaurantId}-${category.name.toLowerCase().replace(/\s+/g, "-")}`,
      description: `${category.name} freshly prepared to order.`,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      createdAt: now,
      updatedAt: now,
    }));

    const groups = new Map<string, SeedRecord>();
    const addons: SeedRecord[] = [];
    const dishAddonGroupIds = new Map<number, string[]>();
    let groupCounter = 0;

    for (const [dishIndex, dish] of menu.dishes.entries()) {
      const groupIds: string[] = [];
      for (const group of dish.addonGroups ?? []) {
        const groupId = `${restaurantId}-group-${groupCounter + 1}`;
        groupCounter += 1;
        groupIds.push(groupId);
        if (!groups.has(groupId)) {
          groups.set(groupId, {
            id: groupId,
            restaurantId,
            name: group.name,
            isRequired: group.isRequired,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            sortOrder: 0,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          });
        }

        for (const addon of group.addons) {
          const addonId = `${restaurantId}-${addon.id}`;
          if (!addons.some((item) => item.id === addonId)) {
            addons.push({
              id: addonId,
              addonGroupId: groupId,
              name: addon.name,
              price: addon.price,
              isActive: addon.isAvailable ?? true,
              isAvailable: addon.isAvailable ?? true,
              sortOrder: 0,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }
      dishAddonGroupIds.set(dishIndex, groupIds);
    }

    const dishes = menu.dishes.map((dish, index) => ({
      id: `${restaurantId}-dish-${index + 1}`,
      restaurantId,
      categoryId: categoryMap.get(dish.categoryId) ?? `${restaurantId}-cat-1`,
      name: dish.name,
      slug: `${restaurantId}-${dish.name.toLowerCase().replace(/\s+/g, "-")}`,
      description: dish.description,
      price: dish.price,
      type: dish.isVeg ? "VEG" : "NON_VEG",
      isVeg: dish.isVeg,
      isAvailable: dish.isAvailable,
      isCustomizable: Boolean(dish.addonGroups?.length),
      image: dish.imageUrl,
      imageUrl: dish.imageUrl,
      video: dish.videoUrl,
      videoUrl: dish.videoUrl,
      videoPosterUrl: dish.videoPosterUrl,
      sortOrder: dish.sortOrder,
      addonGroupIds: dishAddonGroupIds.get(index) ?? [],
      createdAt: now,
      updatedAt: now,
    }));

    const mediaUrls = [
      ...new Set(
        menu.dishes.flatMap((dish) =>
          [dish.imageUrl, dish.videoUrl].filter((url): url is string =>
            Boolean(url),
          ),
        ),
      ),
    ];
    const media = mediaUrls.map((url, index) => {
      const isVideo = /\.(mp4|webm|mov|m3u8)(?:\?|$)/i.test(url);
      return {
        id: `${restaurantId}-demo-media-${index + 1}`,
        restaurantId,
        type: isVideo ? "VIDEO" : "IMAGE",
        url,
        publicId: `external-${restaurantId}-${index + 1}`,
        resourceType: isVideo ? "video" : "image",
        isExternal: true,
        createdAt: now,
        updatedAt: now,
      };
    });

    inserted.categories =
      (inserted.categories ?? 0) +
      (await upsertMany(CategoryModel, categories));
    inserted.addonGroups =
      (inserted.addonGroups ?? 0) +
      (await upsertMany(AddonGroupModel, [...groups.values()]));
    inserted.addons =
      (inserted.addons ?? 0) + (await upsertMany(AddonModel, addons));
    inserted.dishes =
      (inserted.dishes ?? 0) + (await upsertMany(DishModel, dishes));
    inserted.media =
      (inserted.media ?? 0) + (await upsertMany(MediaModel, media));
  }

  console.log(`MongoDB seed complete: ${JSON.stringify(inserted)}`);
}

seed()
  .catch((error) => {
    console.error(
      "MongoDB seed failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
