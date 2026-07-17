import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

let security = null;
try {
  security = await import("../../supabase/functions/tally-photo-ingest/security.ts");
} catch {
  // The first RED run intentionally exercises the missing hardened module.
}

test("webhook authentication fails closed when no secret is configured", () => {
  assert.equal(security?.webhookAuthenticationConfigured?.("", ""), false);
  assert.equal(security?.webhookAuthenticationConfigured?.("   ", ""), false);
  assert.equal(security?.webhookAuthenticationConfigured?.("header-secret", ""), true);
  assert.equal(security?.webhookAuthenticationConfigured?.("", "signing-secret"), true);
});

test("photo URL validation only accepts HTTPS allowlisted public hosts", () => {
  const hosts = security?.buildAllowedPhotoHosts?.(
    "cdn.example.com, https://images.example.com/path, localhost, 10.0.0.1",
  );

  assert.ok(security?.validatePhotoUrl?.("https://storage.tally.so/photo.jpg", hosts));
  assert.ok(security?.validatePhotoUrl?.("https://cdn.example.com/photo.jpg", hosts));
  assert.equal(security?.validatePhotoUrl?.("http://storage.tally.so/photo.jpg", hosts), null);
  assert.equal(security?.validatePhotoUrl?.("https://storage.tally.so:8443/photo.jpg", hosts), null);
  assert.equal(security?.validatePhotoUrl?.("https://example.com/photo.jpg", hosts), null);
  assert.equal(security?.validatePhotoUrl?.("https://localhost/photo.jpg", hosts), null);
  assert.equal(security?.validatePhotoUrl?.("https://127.0.0.1/photo.jpg", hosts), null);
  assert.equal(security?.validatePhotoUrl?.("https://user:pass@storage.tally.so/photo.jpg", hosts), null);
});

test("private and local hostname detection covers common IPv4 and IPv6 ranges", () => {
  for (const hostname of [
    "localhost",
    "service.internal",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.1.1",
    "::1",
    "fd00::1",
  ]) {
    assert.equal(security?.isPrivateOrLocalHostname?.(hostname), true, hostname);
  }
  assert.equal(security?.isPrivateOrLocalHostname?.("storage.tally.so"), false);
});

test("request reader rejects declared and streamed bodies over the limit", async () => {
  assert.equal(typeof security?.readBodyWithLimit, "function");
  await assert.rejects(
    security.readBodyWithLimit(
      new Request("https://example.com", {
        method: "POST",
        headers: { "content-length": "6" },
        body: "123456",
      }),
      5,
    ),
    /PAYLOAD_TOO_LARGE/,
  );
  await assert.rejects(
    security.readBodyWithLimit(
      new Request("https://example.com", { method: "POST", body: "123456" }),
      5,
    ),
    /PAYLOAD_TOO_LARGE/,
  );
  assert.equal(
    await security.readBodyWithLimit(
      new Request("https://example.com", { method: "POST", body: "12345" }),
      5,
    ),
    "12345",
  );
});

test("photo downloads preserve order and respect the concurrency limit", async () => {
  assert.equal(typeof security?.mapWithConcurrency, "function");
  let active = 0;
  let maximumActive = 0;
  const result = await security.mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return value * 2;
  });

  assert.deepEqual(result, [2, 4, 6, 8, 10]);
  assert.equal(maximumActive, 2);
});

test("ingest implementation never copies pending photos to public storage", async () => {
  const source = await readFile(
    new URL("../../supabase/functions/tally-photo-ingest/index.ts", import.meta.url),
    "utf8",
  );
  assert.equal(source.includes("place-photos-public"), false);
  assert.equal(source.includes('.from("place_photos")'), false);
  assert.equal(source.includes("getPublicUrl"), false);
});
