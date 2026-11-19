import assert from "node:assert/strict";
import test from "node:test";
import { isLoopbackMongoUri } from "../lib/security/mongo-target";

test("loopback detection uses the hostname, not a substring", () => {
  assert.equal(isLoopbackMongoUri("mongodb://127.0.0.1:27017/tronx"), true);
  assert.equal(isLoopbackMongoUri("mongodb://user:secret@localhost:27017/tronx"), true);
  assert.equal(isLoopbackMongoUri("mongodb://localhost.evil.example:27017/tronx"), false);
  assert.equal(isLoopbackMongoUri("mongodb://example.com/db?replicaSet=localhost"), false);
  assert.equal(isLoopbackMongoUri("mongodb+srv://user:secret@cluster.example.net/db"), false);
});
