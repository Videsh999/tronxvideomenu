/**
 * Idempotent seed for "TRONX Demo Kitchen" (local/staging only).
 *
 * Prerequisites: fixtures/tronx-demo-kitchen-menu.xlsx
 *   npm run demo:workbook
 *
 * Usage: npm run demo:seed
 * Or via Next (uses app Mongo connection): curl -X POST http://localhost:3000/api/dev/seed-demo-kitchen
 */
import { seedTronxDemoKitchen } from "../lib/demo/seed-demo-kitchen";

seedTronxDemoKitchen()
  .then((result) => {
    console.log(
      JSON.stringify(
        {
          ...result,
          note: "Password documented in DEMO_RESTAURANT_GUIDE.md (local only)",
        },
        null,
        2,
      ),
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
