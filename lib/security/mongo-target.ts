/**
 * Hostnames of a mongodb:// URI. mongodb+srv and unparseable strings return none.
 * Matching is the hostname only, never a substring of the URI.
 */
export function mongoHostnames(uri: string): string[] {
  if (!uri.startsWith("mongodb://")) return [];
  const rest = uri.slice("mongodb://".length);
  const afterAuth = rest.includes("@") ? rest.slice(rest.lastIndexOf("@") + 1) : rest;
  const hostList = (afterAuth.split("/")[0] ?? "").split("?")[0] ?? "";
  if (!hostList) return [];
  return hostList.split(",").map((entry) => {
    const trimmed = entry.trim();
    if (trimmed.startsWith("[")) {
      const end = trimmed.indexOf("]");
      return end > 1 ? trimmed.slice(1, end) : "";
    }
    return trimmed.split(":")[0] ?? "";
  }).filter((host) => host.length > 0);
}

export function isLoopbackMongoUri(uri: string): boolean {
  const hosts = mongoHostnames(uri);
  return hosts.length > 0 && hosts.every((host) => host === "localhost" || host === "127.0.0.1" || host === "::1");
}
