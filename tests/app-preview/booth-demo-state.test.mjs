import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  browseNearby,
  chooseAdditionalPlacePhoto,
  completeCourse,
  createInitialState,
  openPlace,
  startDiscovery,
  toggleAdditionalPlace
} from "../../public/booth-demo/demo-state.js";
import { FEED_ITEMS, PLACES } from "../../public/booth-demo/places.js";

const root = new URL("../../", import.meta.url);

test("booth demo uses only local runtime assets", async () => {
  const html = await readFile(new URL("public/booth-demo/index.html", root), "utf8");
  assert.match(html, /id="demo-app"/);
  assert.match(html, /src="\/booth-demo\/assets\/doripe-logo\.png"/);
  assert.match(html, /src="\/booth-demo\/app\.js"/);
  assert.doesNotMatch(html, /https?:\/\//);
});

test("visitor completes a course after selecting one nearby place", () => {
  let state = startDiscovery(createInitialState());
  state = openPlace(state, "place-100");
  state = browseNearby(state);
  assert.equal(state.screen, "builder");
  assert.equal(state.startPlaceId, "place-100");
  assert.deepEqual(state.selectedPlaceIds, []);

  state = toggleAdditionalPlace(state, "place-101");
  assert.deepEqual(state.selectedPlaceIds, ["place-101"]);
  assert.equal(completeCourse(state).screen, "complete");
});

test("selection is unique and the starting place cannot be added twice", () => {
  const builder = browseNearby(openPlace(startDiscovery(createInitialState()), "place-100"));
  assert.deepEqual(toggleAdditionalPlace(builder, "place-100").selectedPlaceIds, []);
  const selected = toggleAdditionalPlace(builder, "place-101");
  assert.deepEqual(toggleAdditionalPlace(selected, "place-101").selectedPlaceIds, []);
});

test("another photo of the selected place switches the photo without deselecting the place", () => {
  const builder = browseNearby(openPlace(startDiscovery(createInitialState()), "place-100"));
  const first = chooseAdditionalPlacePhoto(builder, "place-111", "place-111-1.jpg", null);
  assert.deepEqual(first.state.selectedPlaceIds, ["place-111"]);
  assert.equal(first.image, "place-111-1.jpg");

  const switched = chooseAdditionalPlacePhoto(first.state, "place-111", "place-111-2.jpg", first.image);
  assert.deepEqual(switched.state.selectedPlaceIds, ["place-111"]);
  assert.equal(switched.image, "place-111-2.jpg");

  const deselected = chooseAdditionalPlacePhoto(switched.state, "place-111", "place-111-2.jpg", switched.image);
  assert.deepEqual(deselected.state.selectedPlaceIds, []);
  assert.equal(deselected.image, null);
});

test("course cannot complete without an additional place", () => {
  const builder = browseNearby(openPlace(startDiscovery(createInitialState()), "place-100"));
  assert.throws(() => completeCourse(builder), /additional place/i);
});

test("demo places are immutable local records", () => {
  assert.equal(PLACES.length, 101);
  assert.equal(FEED_ITEMS.length, 507);
  assert.deepEqual(PLACES.slice(0, 3).map(({ id, name }) => ({ id, name })), [
    { id: "place-100", name: "무계획" },
    { id: "place-101", name: "아오이토리" },
    { id: "place-102", name: "필리커피" }
  ]);
  assert.deepEqual(
    PLACES.slice(-3).map(({ id, name }) => ({ id, name })),
    [
      { id: "place-198", name: "연남 초야" },
      { id: "place-199", name: "한월 홍대" },
      { id: "place-200", name: "망원공명" }
    ]
  );
  assert.equal(Object.isFrozen(PLACES), true);
  assert.equal(PLACES.every(Object.isFrozen), true);
  assert.equal(PLACES.every((place) => Object.isFrozen(place.images)), true);
  assert.equal(Object.isFrozen(FEED_ITEMS), true);
  assert.equal(FEED_ITEMS.every(Object.isFrozen), true);
});

test("all supplied photos use unique local booth assets", async () => {
  assert.equal(new Set(FEED_ITEMS.map((item) => item.image)).size, 507);
  for (const item of FEED_ITEMS) {
    assert.match(item.image, /^\/booth-demo\/assets\/places\/place-\d{3}-\d+\.jpg$/);
    await access(new URL(`../../public${item.image}`, import.meta.url));
  }
});

test("feed renders every supplied photo with lazy loading", async () => {
  const app = await readFile(new URL("public/booth-demo/app.js", root), "utf8");
  assert.match(app, /FEED_ITEMS\.map\(\(item\) => placeTile\(item\)\)/);
  assert.match(app, /loading="lazy"/);
  assert.doesNotMatch(app, /place\.copy/);
});

test("booth CSS includes touch, safe area, and reduced motion rules", async () => {
  const css = await readFile(new URL("public/booth-demo/styles.css", root), "utf8");
  assert.match(css, /min-height:\s*52px/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /#10c76f/i);
  assert.match(css, /\/app\/assets\/fonts\/PretendardVariable\.woff2/);
  assert.doesNotMatch(css, /\/app-preview\//);
  await access(new URL("public/app/assets/fonts/PretendardVariable.woff2", root));
});

test("selecting a nearby place preserves the builder scroll position", async () => {
  const app = await readFile(new URL("public/booth-demo/app.js", root), "utf8");
  assert.match(app, /const previousScrollY = window\.scrollY/);
  assert.match(app, /top: preserveScroll \? previousScrollY : 0/);
  assert.match(
    app,
    /update\(selection\.state, \{ preserveScroll: true \}\)/
  );
});
