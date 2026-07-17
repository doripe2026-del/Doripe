import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  SERVER_MEDIA_COUNT,
  isStaticPreview,
  localMediaUrl,
  resolvePreviewMediaSource,
  serverMediaUrl
} from "../../public/app-preview/data/server-media.js";

test("server media exposes the complete 60-photo prototype library", () => {
  assert.equal(SERVER_MEDIA_COUNT, 60);
  assert.match(serverMediaUrl(0), /media-001\.jpg$/);
  assert.match(serverMediaUrl(59), /media-060\.jpg$/);
});

test("static review screens stay deterministic while live preview uses server media", () => {
  assert.equal(isStaticPreview({ pathname: "/app-preview/", search: "?screen=b1&static=1" }), true);
  assert.equal(isStaticPreview({ pathname: "/app", search: "?screen=b1&static=1" }), false);
  assert.equal(resolvePreviewMediaSource(7, { pathname: "/app-preview/", search: "?static=1" }), localMediaUrl(7));
  assert.equal(resolvePreviewMediaSource(7, { pathname: "/app", search: "?static=1" }), serverMediaUrl(7));
  assert.equal(resolvePreviewMediaSource(7, { pathname: "/app-preview/", search: "?screen=b1" }), serverMediaUrl(7));
});

test("media indices wrap safely for long feeds", () => {
  assert.equal(serverMediaUrl(60), serverMediaUrl(0));
  assert.equal(localMediaUrl(6), localMediaUrl(0));
});

test("the live app does not eagerly preload prototype media from the experiment project", async () => {
  const mainSource = await readFile(new URL("../../public/app-preview/main.js", import.meta.url), "utf8");
  assert.equal(mainSource.includes("preloadServerMedia"), false);
});
