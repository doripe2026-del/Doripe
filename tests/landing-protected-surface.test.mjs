import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assertProtectedLandingSurface,
  extractProtectedLandingSurface,
} from "../scripts/landing-protected-surface.mjs";

const home = await readFile(new URL("../public/home/index.html", import.meta.url), "utf8");

test("landing copy blocks and every notify CTA match the approved surface", () => {
  assert.doesNotThrow(() => assertProtectedLandingSurface(home));
  const surface = extractProtectedLandingSurface(home);
  assert.equal(surface.notifyCtas.length, 4);
  assert.ok(surface.copyBlocks.length >= 25);
});

test("changing or removing one protected copy block fails the contract", () => {
  const changed = home.replace("감도 높은 사진에서,", "마음에 드는 사진에서,");
  assert.throws(
    () => assertProtectedLandingSurface(changed),
    /protected landing copy/i,
  );

  const removed = home.replace(/<p[^>]*data-protected-copy="hero-sub"[\s\S]*?<\/p>/, "");
  assert.throws(
    () => assertProtectedLandingSurface(removed),
    /protected landing copy/i,
  );
});

test("changing one notify CTA text or href fails the contract", () => {
  const changedText = home.replace(
    /(<a href="\/notify"[^>]*class="primary-cta group[\s\S]*?)알림신청/,
    "$1베타 신청",
  );
  assert.throws(
    () => assertProtectedLandingSurface(changedText),
    /notify CTA/i,
  );

  const changedHref = home.replace(
    'href="/notify" data-cta-location="hero"',
    'href="/waitlist" data-cta-location="hero"',
  );
  assert.throws(
    () => assertProtectedLandingSurface(changedHref),
    /notify CTA/i,
  );

  const extra = home.replace("</header>", '<a href="/notify">알림신청</a></header>');
  assert.throws(
    () => assertProtectedLandingSurface(extra),
    /notify CTA count/i,
  );
});
