import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("booth demo uses only local runtime assets", async () => {
  const html = await readFile(new URL("public/booth-demo/index.html", root), "utf8");
  assert.match(html, /id="demo-app"/);
  assert.match(html, /src="\/instagram-pinned-feed\/assets\/doripe-logo-black\.png"/);
  assert.match(html, /src="\/booth-demo\/app\.js"/);
  assert.doesNotMatch(html, /https?:\/\//);
});
