import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const notifyPath = `${root}/public/home/notify.html`;
const notify = readFileSync(notifyPath, "utf8");

function readNotifyRounds(source) {
  const match = source.match(/const notifyRounds = (\[[\s\S]*?\n  \]);/);
  assert.ok(match, "notifyRounds must remain available in the notify page");
  return JSON.parse(match[1]);
}

test("notify taste test uses ten pairs from twenty unique local places", () => {
  const rounds = readNotifyRounds(notify);
  assert.equal(rounds.length, 10);

  const choices = rounds.flatMap((round) => [round.A, round.B]);
  assert.equal(choices.length, 20);

  const placeIds = choices.map((choice) => {
    assert.match(choice.image, /^\/img\/notify-taste\/round-\d{2}-[ab]-place-(\d+)\.jpg$/);
    const id = choice.image.match(/place-(\d+)\.jpg$/)?.[1];
    assert.ok(id, `place id missing from ${choice.image}`);
    assert.ok(existsSync(`${root}/public${choice.image}`), `missing image ${choice.image}`);
    return id;
  });

  assert.equal(new Set(placeIds).size, 20, "every choice must use a different place");
});

test("notify intro collage is built from the selected local taste photos", () => {
  const collage = [...notify.matchAll(/<img class="a[1-4]" src="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(collage.length, 4);
  collage.forEach((src) => assert.match(src, /^\/img\/notify-taste\//));
});

test("landing headers keep only Doripe and the notify call to action", () => {
  const pages = [
    "public/home/index.html",
    "public/business/index.html",
    "public/company/index.html"
  ];

  for (const page of pages) {
    const html = readFileSync(`${root}/${page}`, "utf8");
    const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
    assert.match(header, />Doripe/);
    assert.match(header, />\s*알림신청\s*</);
    assert.doesNotMatch(header, /<nav class="nav-links"/);
    assert.doesNotMatch(header, />Home</);
    assert.doesNotMatch(header, />Business</);
    assert.doesNotMatch(header, />Company</);
  }
});
