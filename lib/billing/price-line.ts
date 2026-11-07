/**
 * Server-side unit price for one ordered dish.
 * Variant price wins when the guest or cashier chose one.
 * A dish that has an available variant cannot be sold at the base price.
 */
export type PricedVariantDish = {
  name: string;
  price: number;
  variants?: Array<{ id: string; name: string; price: number; isAvailable?: boolean }>;
};

export class VariantPriceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VariantPriceError";
  }
}

export function resolveOrderedUnitPrice(
  dish: PricedVariantDish,
  variantId?: string,
): { unitPrice: number; variantId?: string; variantName?: string } {
  const available = (dish.variants ?? []).filter((variant) => variant.isAvailable !== false);
  if (variantId) {
    const variant = (dish.variants ?? []).find((entry) => entry.id === variantId);
    if (!variant || variant.isAvailable === false) {
      throw new VariantPriceError(`A variant for ${dish.name} is unavailable.`);
    }
    return { unitPrice: variant.price, variantId: variant.id, variantName: variant.name };
  }
  if (available.length > 0) {
    throw new VariantPriceError(`Select a variant for ${dish.name}.`);
  }
  return { unitPrice: dish.price };
}
