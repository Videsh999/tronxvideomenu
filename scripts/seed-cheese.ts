import { seedCheeseRestaurant, CHEESE_DEMO } from "../lib/demo/seed-cheese";

seedCheeseRestaurant()
  .then((result) => {
    console.log(JSON.stringify({ ok: true, ...result, credentials: CHEESE_DEMO }, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
