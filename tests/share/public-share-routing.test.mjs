import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const shareHtml = await readFile(new URL("public/share.html", root), "utf8");
const vercelConfig = JSON.parse(await readFile(new URL("vercel.json", root), "utf8"));
const shareScript = shareHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";

function appHrefFor(pathname) {
  const attributes = new Map();
  const elements = new Map([
    ["open-app", { setAttribute: (name, value) => attributes.set(`open-app:${name}`, value) }],
    ["open-store", { setAttribute: (name, value) => attributes.set(`open-store:${name}`, value) }],
  ]);

  vm.runInNewContext(shareScript, {
    URLSearchParams,
    document: {
      addEventListener() {},
      getElementById(id) {
        return elements.get(id);
      },
    },
    location: {
      href: `https://doripe.kr${pathname}`,
      pathname,
      replace() {},
      search: "",
    },
    navigator: { userAgent: "desktop-test" },
    setTimeout() {},
    window: { addEventListener() {} },
  });

  return attributes.get("open-app:href");
}

test("Vercel routes v1 share URLs to the public share page while preserving legacy /s links", () => {
  assert.deepEqual(
    vercelConfig.rewrites.find((rewrite) => rewrite.source === "/shares/:shareId"),
    { source: "/shares/:shareId", destination: "/share.html" },
  );
  assert.deepEqual(
    vercelConfig.rewrites.find((rewrite) => rewrite.source === "/s/:shareId"),
    { source: "/s/:shareId", destination: "/share.html" },
  );
});

test("share page preserves the slug for both v1 and legacy public URLs", () => {
  assert.equal(appHrefFor("/shares/ds_v1-example"), "doripe://share?doripe_share_id=ds_v1-example");
  assert.equal(appHrefFor("/s/legacy_example"), "doripe://share?doripe_share_id=legacy_example");
});
