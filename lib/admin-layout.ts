/** POS / Kitchen need the full content column — max-w-6xl + padding was clipping the bill panel. */
export function isImmersiveOpsPath(pathname: string): boolean {
  return /\/admin\/[^/]+\/(pos|kitchen)(\/|$)/.test(pathname);
}
