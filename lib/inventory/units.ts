import type { InventoryUnit } from "@/types";

/** Default conversion factors into the named base unit. */
const DEFAULT_FACTORS: Record<InventoryUnit, Partial<Record<InventoryUnit, number>>> = {
  g: { g: 1, kg: 1000 },
  kg: { kg: 1, g: 0.001 },
  ml: { ml: 1, l: 1000 },
  l: { l: 1, ml: 0.001 },
  pcs: { pcs: 1, dozen: 12 },
  dozen: { dozen: 1, pcs: 1 / 12 },
};

export function convertToBase(
  quantity: number,
  fromUnit: InventoryUnit,
  baseUnit: InventoryUnit,
  customConversions?: Partial<Record<InventoryUnit, number>>,
): number {
  if (quantity < 0) throw new Error("Quantity cannot be negative.");
  if (fromUnit === baseUnit) return quantity;

  const custom = customConversions?.[fromUnit];
  if (typeof custom === "number") return quantity * custom;

  const factor = DEFAULT_FACTORS[baseUnit]?.[fromUnit];
  if (typeof factor !== "number") {
    throw new Error(`Cannot convert ${fromUnit} to ${baseUnit}. Configure a conversion.`);
  }
  return quantity * factor;
}

export function roundQty(value: number): number {
  return Math.round((value + Number.EPSILON) * 1e6) / 1e6;
}
