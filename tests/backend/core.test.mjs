import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function importTypescript(entry) {
  const output = await mkdtemp(path.join(os.tmpdir(), "doripe-backend-test-"));
  const outfile = path.join(output, "module.mjs");
  await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile });
  return { module: await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`), cleanup: () => rm(output, { recursive: true, force: true }) };
}

test("v1 router returns safe error envelopes and method metadata", async () => {
  const loaded = await importTypescript("src/backend/handler.ts");
  try {
    const missing = await loaded.module.handleV1Request(new Request("https://doripe.kr/api/v1/missing"));
    assert.equal(missing.status, 404);
    const missingBody = await missing.json();
    assert.equal(missingBody.error.code, "route_not_found");
    assert.ok(missingBody.error.requestId);
    assert.equal(JSON.stringify(missingBody).includes("stack"), false);

    const method = await loaded.module.handleV1Request(new Request("https://doripe.kr/api/v1/health", { method: "POST" }));
    assert.equal(method.status, 405);
    assert.deepEqual((await method.json()).error.details.allowed, ["GET"]);
  } finally {
    await loaded.cleanup();
  }
});

test("health endpoint uses the stable success envelope", async () => {
  const loaded = await importTypescript("src/backend/handler.ts");
  try {
    const response = await loaded.module.handleV1Request(new Request("https://doripe.kr/api/v1/health"));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.status, "ok");
    assert.ok(body.meta.requestId);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  } finally {
    await loaded.cleanup();
  }
});

test("cursor is opaque and bound to the active filters", async () => {
  const loaded = await importTypescript("src/backend/core/cursor.ts");
  try {
    const filters = new URLSearchParams({ categoryId: "cafe", limit: "20" });
    const cursor = loaded.module.encodeCursor("2026-07-14T00:00:00.000Z", "place-1", filters);
    const decoded = loaded.module.decodeCursor(cursor, filters);
    assert.equal(decoded.id, "place-1");
    assert.throws(
      () => loaded.module.decodeCursor(cursor, new URLSearchParams({ categoryId: "food", limit: "20" })),
      (error) => error.code === "invalid_cursor" && error.status === 400,
    );
  } finally {
    await loaded.cleanup();
  }
});

test("bearer parser rejects missing and malformed sessions", async () => {
  const loaded = await importTypescript("src/backend/core/auth.ts");
  try {
    assert.throws(
      () => loaded.module.bearerToken(new Request("https://doripe.kr/api/v1/me/account")),
      (error) => error.code === "unauthenticated" && error.status === 401,
    );
    assert.throws(
      () => loaded.module.bearerToken(new Request("https://doripe.kr/api/v1/me/account", { headers: { authorization: "Basic abc" } })),
      (error) => error.code === "unauthenticated" && error.status === 401,
    );
    assert.equal(
      loaded.module.bearerToken(new Request("https://doripe.kr/api/v1/me/account", { headers: { authorization: "Bearer jwt-value" } })),
      "jwt-value",
    );
  } finally {
    await loaded.cleanup();
  }
});
