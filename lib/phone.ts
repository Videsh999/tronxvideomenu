/**
 * Shared phone normalization for loyalty signup, CRM upsert, and POS capture.
 * Keeps profiles from splitting across "+91 98765 43210" vs "9876543210".
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "").trim();
}
