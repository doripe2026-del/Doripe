import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const markup = await readFile(
  new URL("../../public/app-preview/index.html", import.meta.url),
  "utf8"
);

test("the app shell paints a branded loading state before JavaScript and remote data finish", () => {
  assert.match(markup, /data-app-boot/u);
  assert.match(markup, /role="progressbar"/u);
  assert.match(markup, /Doripe 시작 중/u);
});

test("the mobile viewport enables full-screen safe-area layout", () => {
  assert.match(
    markup,
    /name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/u
  );
});
