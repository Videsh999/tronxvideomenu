export type CredentialActorRole = "SUPER_ADMIN" | "RESTAURANT_ADMIN" | "CAPTAIN";

export function canManageRestaurantAdminCredentials(role: CredentialActorRole) {
  return role === "SUPER_ADMIN";
}

export function canManageCaptainCredentials(
  role: CredentialActorRole,
  authenticatedRestaurantId: string,
  credentialRestaurantId: string,
) {
  return role === "RESTAURANT_ADMIN" && Boolean(authenticatedRestaurantId) && authenticatedRestaurantId === credentialRestaurantId;
}
