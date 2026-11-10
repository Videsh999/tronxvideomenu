/** Session restaurant id is the only outlet a staff cookie may read. */
export function sessionOwnsOutlet(
  sessionRestaurantId: string | undefined,
  resourceRestaurantId: string | null | undefined,
): boolean {
  return Boolean(sessionRestaurantId) && sessionRestaurantId === resourceRestaurantId;
}
