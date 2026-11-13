export type CaptainSnap =
  | { kind: "tables"; cards: { name: string; detail: string }[] }
  | { kind: "list"; title: string; rows: { title: string; detail: string }[] }
  | { kind: "title"; title: string; detail: string };

const PREFIX = "captain-screen:";
const OPENING = "captain-opening";

export function captainScreenTitle(path: string) {
  if (path.endsWith("/tables")) return "Tables";
  if (path.includes("/take-order")) return "New order";
  if (path.endsWith("/orders")) return "Orders";
  if (path.endsWith("/bills")) return "Bills";
  if (path.endsWith("/approvals")) return "Approvals";
  if (path.endsWith("/requests")) return "Requests";
  if (path.includes("/tables/")) return "Table";
  return "Captain";
}

export function rememberCaptainScreen(path: string, snap: CaptainSnap) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PREFIX + path, JSON.stringify(snap));
  } catch {
    // A full storage quota must not block the screen.
  }
}

export function markCaptainOpening(path: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(OPENING, path.split("?")[0]);
  } catch {
    // Ignore private-mode storage failures.
  }
}

export function readOpeningScreen(): CaptainSnap {
  if (typeof window === "undefined") return { kind: "title", title: "Opening", detail: "" };
  try {
    const path = sessionStorage.getItem(OPENING);
    if (!path) return { kind: "title", title: "Opening", detail: "" };
    const raw = sessionStorage.getItem(PREFIX + path);
    if (!raw) return { kind: "title", title: captainScreenTitle(path), detail: "" };
    return JSON.parse(raw) as CaptainSnap;
  } catch {
    return { kind: "title", title: "Opening", detail: "" };
  }
}
