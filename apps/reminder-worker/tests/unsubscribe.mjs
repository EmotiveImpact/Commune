import assert from "node:assert/strict";
import test from "node:test";
import { unsubscribeConfig, unsubscribeRecipient, unsubscribeUrl } from "../src/unsubscribe.ts";

const config = { secret: "test-only-unsubscribe-secret-0123456789", baseUrl: "https://worker.example.test" };

test("a link made for one person names only that person", () => {
  const link = unsubscribeUrl(config, "user-1");
  assert.equal(new URL(link).pathname, "/unsubscribe");
  assert.equal(unsubscribeRecipient(config, link), "user-1");
  const other = new URL(link);
  other.searchParams.set("u", "user-2");
  assert.equal(unsubscribeRecipient(config, other.href), null);
  const truncated = new URL(link);
  truncated.searchParams.set("s", truncated.searchParams.get("s").slice(0, -1));
  assert.equal(unsubscribeRecipient(config, truncated.href), null);
  assert.equal(unsubscribeRecipient(config, "https://worker.example.test/unsubscribe"), null);
  assert.equal(unsubscribeRecipient({ ...config, secret: "another-secret-entirely-0123456789" }, link), null);
});

test("is off unless both settings are present, and refuses weak ones", () => {
  assert.equal(unsubscribeConfig({}), null);
  assert.equal(unsubscribeConfig({ UNSUBSCRIBE_SECRET: config.secret }), null);
  assert.deepEqual(unsubscribeConfig({ UNSUBSCRIBE_SECRET: config.secret, WORKER_PUBLIC_URL: "https://worker.example.test/path" }), config);
  assert.throws(() => unsubscribeConfig({ UNSUBSCRIBE_SECRET: "short", WORKER_PUBLIC_URL: config.baseUrl }), /32 characters/);
  assert.throws(() => unsubscribeConfig({ UNSUBSCRIBE_SECRET: config.secret, WORKER_PUBLIC_URL: "http://worker.example.test" }), /HTTPS/);
});
