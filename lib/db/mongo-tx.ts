import type { ClientSession } from "mongoose";
import mongoose from "mongoose";

export type ConsistencyMode = "TRANSACTION" | "IDEMPOTENT_COMPENSATING";

/**
 * Attempt a MongoDB multi-document transaction when the deployment supports it
 * (replica set / mongos). Falls back to the callback without a session so
 * callers must remain idempotent and compensating.
 */
export async function withOptionalTransaction<T>(
  work: (session: ClientSession | null, mode: ConsistencyMode) => Promise<T>,
): Promise<{ result: T; mode: ConsistencyMode }> {
  let session: ClientSession | null = null;
  try {
    session = await mongoose.startSession();
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session, "TRANSACTION");
    });
    return { result, mode: "TRANSACTION" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const unsupported =
      /Transaction numbers are only allowed|replica set|not supported|IllegalOperation/i.test(
        message,
      ) ||
      (error && typeof error === "object" && "code" in error && Number(error.code) === 20);
    if (!unsupported && session) {
      // Real application error inside a supported transaction — rethrow.
      throw error;
    }
    const result = await work(null, "IDEMPOTENT_COMPENSATING");
    return { result, mode: "IDEMPOTENT_COMPENSATING" };
  } finally {
    if (session) await session.endSession().catch(() => undefined);
  }
}

export function correlationId(prefix = "op"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
