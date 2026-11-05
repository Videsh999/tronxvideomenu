import { NextResponse } from "next/server";
import { requireRestaurantAdmin } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

const SAMPLE = `Category,Item Name,Description,Price,Half,Full,Dietary,SKU
Starters,Veg Spring Roll,Crispy rolls with vegetables,149,,,VEG,ST-001
Starters,Chicken Wings,Spicy glazed wings,,199,349,NON_VEG,ST-002
Biryani,Veg Biryani,Fragrant basmati with vegetables,,180,280,VEG,BR-001
Biryani,Chicken Biryani,Classic dum biryani,,220,350,NON_VEG,BR-002
Beverages,Fresh Lime Soda,Sweet or salted,99,,,VEG,BV-001
`;

export async function GET() {
  const { error } = await requireRestaurantAdmin();
  if (error) return error;
  return new NextResponse(SAMPLE, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="tronx-menu-import-template.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
