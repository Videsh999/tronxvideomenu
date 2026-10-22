import assert from "node:assert/strict";
import test from "node:test";
import type { Dish } from "../types/index";
import { getDishMedia } from "../lib/dish-media";

const baseDish: Dish = {
  id: "dish-1",
  categoryId: "starters",
  name: "Paneer Tikka",
  price: 249,
  sortOrder: 1,
  isVeg: true,
  isAvailable: true,
  imageUrl: "https://media.example.test/main.jpg",
  videoUrl: "https://media.example.test/main.mp4",
};

test("dish media lists the main video, main photo, then gallery items in order", () => {
  const media = getDishMedia({
    ...baseDish,
    gallery: [
      { id: "g1", type: "IMAGE", url: "https://media.example.test/side.jpg" },
      { id: "g2", type: "VIDEO", url: "https://media.example.test/plating.mp4" },
    ],
  }, true);

  assert.deepEqual(media.map((item) => item.url), [
    "https://media.example.test/main.mp4",
    "https://media.example.test/main.jpg",
    "https://media.example.test/side.jpg",
    "https://media.example.test/plating.mp4",
  ]);
  assert.equal(media[0].posterUrl, "https://media.example.test/main.jpg");
  assert.equal(media[3].posterUrl, "https://media.example.test/main.jpg");
});

test("dish media hides videos when the video menu is disabled and removes duplicates", () => {
  const media = getDishMedia({
    ...baseDish,
    gallery: [
      { id: "g1", type: "IMAGE", url: "https://media.example.test/main.jpg" },
      { id: "g2", type: "VIDEO", url: "https://media.example.test/plating.mp4" },
      { id: "g3", type: "IMAGE", url: "https://media.example.test/side.jpg" },
    ],
  }, false);

  assert.deepEqual(media.map((item) => [item.type, item.url]), [
    ["IMAGE", "https://media.example.test/main.jpg"],
    ["IMAGE", "https://media.example.test/side.jpg"],
  ]);
});
