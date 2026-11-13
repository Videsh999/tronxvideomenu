export type ServiceTaxMode = "PERCENT" | "AMOUNT";

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Captain-chosen service tax. Percent may be any value from 0 to 100, including 2.7 or 3.5. */
export function serviceTaxAmount(
  base: number,
  mode: ServiceTaxMode,
  percentText: string,
  amountText: string,
): number {
  if (mode === "PERCENT") {
    const percent = Number(percentText);
    if (!Number.isFinite(percent) || percent <= 0) return 0;
    return roundMoney((Math.max(0, base) * Math.min(100, percent)) / 100);
  }
  const amount = Number(amountText);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return roundMoney(Math.min(amount, 1_000_000));
}
