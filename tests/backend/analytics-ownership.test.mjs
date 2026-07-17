import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

async function importTypescript(entry) {
  const output = await mkdtemp(path.join(os.tmpdir(), "doripe-analytics-test-"));
  const outfile = path.join(output, "module.mjs");
  await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile });
  return {
    module: await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`),
    cleanup: () => rm(output, { recursive: true, force: true }),
  };
}

test("analytics session ownership allows only the original actor or one anonymous-to-user claim", async () => {
  const loaded = await importTypescript("src/backend/domains/analytics.ts");
  try {
    const decide = loaded.module.analyticsSessionOwnership;
    assert.equal(typeof decide, "function");
    assert.equal(decide(null, { userId: null, anonymousId: "anonymous-1" }), "new");
    assert.equal(decide(
      { user_id: null, anonymous_id: "anonymous-1" },
      { userId: null, anonymousId: "anonymous-1" },
    ), "same");
    assert.equal(decide(
      { user_id: null, anonymous_id: "anonymous-1" },
      { userId: "user-a", anonymousId: "anonymous-1" },
    ), "claim");
    assert.equal(decide(
      { user_id: "user-a", anonymous_id: "anonymous-1" },
      { userId: "user-a", anonymousId: "anonymous-2" },
    ), "same");

    for (const incoming of [
      { userId: "user-b", anonymousId: "anonymous-1" },
      { userId: null, anonymousId: "anonymous-1" },
      { userId: "user-a", anonymousId: "anonymous-2" },
    ]) {
      const existing = incoming.userId === "user-a"
        ? { user_id: null, anonymous_id: "anonymous-1" }
        : { user_id: "user-a", anonymous_id: "anonymous-1" };
      assert.throws(
        () => decide(existing, incoming),
        (error) => error?.status === 409 && error?.code === "analytics_session_conflict",
      );
    }
  } finally {
    await loaded.cleanup();
  }
});

