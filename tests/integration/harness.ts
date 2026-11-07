import mongoose from "mongoose";

export function integrationEnabled() {
  return process.env.RUN_INTEGRATION === "1";
}

export async function connectReplicaSet() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("RUN_INTEGRATION=1 but MONGODB_URI is missing. Integration tests must not skip.");
  }
  if (!uri.includes("localhost") && !uri.includes("127.0.0.1")) {
    throw new Error("Integration tests refuse a non-loopback MONGODB_URI.");
  }
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  }
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!hello.setName) {
    throw new Error("Integration MongoDB is not a replica set. Refusing to skip.");
  }
}

export async function disconnectTestDatabase() {
  const cache = (globalThis as { mongooseCache?: { conn: unknown; promise: unknown } }).mongooseCache;
  if (cache) {
    cache.conn = null;
    cache.promise = null;
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
