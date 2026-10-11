import assert from "node:assert/strict";
import test from "node:test";
import type { AddonGroup, Dish } from "../types/index";
import { toCustomerDish } from "../lib/customer-dish-data";

test("customer dish mapping normalizes legacy media fields and supplies an image poster", () => {
  const mapped = toCustomerDish({
    id: "dish-legacy",
    categoryId: "starters",
    name: "Legacy Dish",
    price: 120,
    image: "https://media.example.test/dish.webp",
    video: "https://media.example.test/dish.webm",
    sortOrder: 1,
    isVeg: false,
    isAvailable: true,
  }, []);

  assert.equal(mapped.imageUrl, "https://media.example.test/dish.webp");
  assert.equal(mapped.videoUrl, "https://media.example.test/dish.webm");
  assert.equal(mapped.videoPosterUrl, "https://media.example.test/dish.webp");
  assert.deepEqual(mapped.addonGroups, []);
});

test("customer dish mapping redirects stale demo video aliases to existing public assets", () => {
  const first = toCustomerDish({
    id: "legacy-video-1",
    categoryId: "starters",
    name: "Legacy Video 1",
    price: 120,
    video: "/videos/food-video-1.mp4",
    sortOrder: 1,
    isVeg: false,
    isAvailable: true,
  }, []);
  const second = toCustomerDish({
    id: "legacy-video-2",
    categoryId: "starters",
    name: "Legacy Video 2",
    price: 120,
    videoUrl: "/videos/food-video-2.mp4",
    sortOrder: 2,
    isVeg: false,
    isAvailable: true,
  }, []);

  assert.equal(first.videoUrl, "/videos/demo-video-1.mp4");
  assert.equal(second.videoUrl, "/videos/demo-video-2.mp4");
});

test("customer dish mapping uses canonical media fields and resolves only active configured add-ons", () => {
  const dish: Dish = {
    id: "dish-1",
    categoryId: "starters",
    name: "Test Dish",
    price: 200,
    image: "https://media.example.test/old-image.webp",
    imageUrl: "https://media.example.test/current-image.webp",
    video: "https://media.example.test/old-video.mp4",
    videoUrl: "https://media.example.test/current-video.mp4",
    sortOrder: 1,
    isVeg: false,
    isAvailable: true,
    addonGroupIds: ["active-group", "inactive-group", "missing-group"],
  };
  const groups: AddonGroup[] = [
    {
      id: "active-group",
      name: "Choose a sauce",
      restaurantId: "restaurant-1",
      isRequired: true,
      minSelect: 1,
      maxSelect: 1,
      isActive: true,
      addons: [
        { id: "available", name: "Mint chutney", price: 15, isActive: true, isAvailable: true },
        { id: "unavailable", name: "Unavailable sauce", price: 25, isActive: true, isAvailable: false },
      ],
    },
    {
      id: "inactive-group",
      name: "Archived group",
      restaurantId: "restaurant-1",
      isRequired: false,
      minSelect: 0,
      maxSelect: 1,
      isActive: false,
      addons: [{ id: "archived-addon", name: "Archived", price: 50 }],
    },
  ];

  const mapped = toCustomerDish(dish, groups);

  assert.equal(mapped.imageUrl, "https://media.example.test/current-image.webp");
  assert.equal(mapped.videoUrl, "https://media.example.test/current-video.mp4");
  assert.equal(mapped.videoPosterUrl, "https://media.example.test/current-image.webp");
  assert.deepEqual(mapped.addonGroups?.map((group) => group.id), ["active-group"]);
  assert.deepEqual(mapped.addonGroups?.[0]?.addons.map((addon) => addon.id), ["available"]);
  assert.equal(mapped.addonGroups?.[0]?.isRequired, true);
  assert.equal(mapped.addonGroups?.[0]?.minSelect, 1);
  assert.equal(mapped.addonGroups?.[0]?.maxSelect, 1);
});
