/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Next's request storage uses globalThis.AsyncLocalStorage when the module loads.
 * Node exposes it from node:async_hooks, not on globalThis, so route-handler tests
 * would otherwise get a storage whose run() throws.
 */
const { AsyncLocalStorage } = require("node:async_hooks");

if (typeof globalThis.AsyncLocalStorage !== "function") {
  globalThis.AsyncLocalStorage = AsyncLocalStorage;
}
