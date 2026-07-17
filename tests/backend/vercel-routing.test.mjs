import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const vercelConfig = JSON.parse(
  await readFile(new URL("../../vercel.json", import.meta.url), "utf8")
);

test("all nested v1 API paths reach the single Vercel function with their path preserved", () => {
  const apiRewrite = vercelConfig.rewrites.find(
    (rewrite) => rewrite.source === "/api/v1/:path*"
  );

  assert.deepEqual(apiRewrite, {
    source: "/api/v1/:path*",
    destination: "/api/v1?__path=:path*"
  });
});
