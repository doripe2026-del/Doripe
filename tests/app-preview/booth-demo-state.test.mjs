import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  browseNearby,
  completeCourse,
  createInitialState,
  openPlace,
  startDiscovery,
  toggleAdditionalPlace
} from "../../public/booth-demo/demo-state.js";
import { PLACES } from "../../public/booth-demo/places.js";

const root = new URL("../../", import.meta.url);

test("booth demo uses only local runtime assets", async () => {
  const html = await readFile(new URL("public/booth-demo/index.html", root), "utf8");
  assert.match(html, /id="demo-app"/);
  assert.match(html, /src="\/booth-demo\/assets\/doripe-logo\.png"/);
  assert.match(html, /src="\/booth-demo\/app\.js"/);
  assert.doesNotMatch(html, /https?:\/\//);
  const app = await readFile(new URL("public/booth-demo/app.js", root), "utf8");
  assert.match(app, /href="\/booth-demo\/credits\.html"/);
});

test("visitor completes a course after selecting one nearby place", () => {
  let state = startDiscovery(createInitialState());
  state = openPlace(state, "place-01");
  state = browseNearby(state);
  assert.equal(state.screen, "builder");
  assert.equal(state.startPlaceId, "place-01");
  assert.deepEqual(state.selectedPlaceIds, []);

  state = toggleAdditionalPlace(state, "place-02");
  assert.deepEqual(state.selectedPlaceIds, ["place-02"]);
  assert.equal(completeCourse(state).screen, "complete");
});

test("selection is unique and the starting place cannot be added twice", () => {
  const builder = browseNearby(openPlace(startDiscovery(createInitialState()), "place-01"));
  assert.deepEqual(toggleAdditionalPlace(builder, "place-01").selectedPlaceIds, []);
  const selected = toggleAdditionalPlace(builder, "place-02");
  assert.deepEqual(toggleAdditionalPlace(selected, "place-02").selectedPlaceIds, []);
});

test("course cannot complete without an additional place", () => {
  const builder = browseNearby(openPlace(startDiscovery(createInitialState()), "place-01"));
  assert.throws(() => completeCourse(builder), /additional place/i);
});

test("demo places are immutable local records", () => {
  assert.deepEqual(PLACES.map((place) => place.name), [
    "청운문학도서관", "산촌", "윤동주문학관", "낙산공원", "아라리오뮤지엄 인 스페이스", "진아춘",
    "무계원", "세운상가", "박노수미술관", "창경궁 대온실", "환기미술관", "이문설농탕",
    "서울공예박물관", "창의문", "아트선재센터", "삼청동수제비", "국립현대미술관 서울", "원서동 공방길",
    "홍난파 가옥", "진옥화할매원조닭한마리", "이상범 가옥과 화실", "윤동주 시인의 언덕", "백인제가옥", "숙정문",
    "경교장", "서울우리소리박물관", "혜화문", "서울교육박물관", "락고재", "한양도성박물관", "정독도서관",
    "대한민국역사박물관", "서울역사박물관", "국립민속박물관", "국립어린이과학관", "일민미술관"
  ]);
  assert.equal(PLACES.every((place) => place.copy.length > 0), true);
  assert.equal(Object.isFrozen(PLACES), true);
  assert.equal(PLACES.every(Object.isFrozen), true);
});

test("all demo places use available local booth assets", async () => {
  assert.equal(PLACES.length, 36);
  for (const place of PLACES) {
    assert.match(place.image, /^\/booth-demo\/assets\/place-\d{2}\.jpg$/);
    await access(new URL(`../../public${place.image}`, import.meta.url));
  }
});

test("real place photos have visible source and license credits", async () => {
  const credits = await readFile(new URL("public/booth-demo/credits.html", root), "utf8");
  for (const place of PLACES) assert.match(credits, new RegExp(place.name));
  assert.equal((credits.match(/class="photo-source"/g) ?? []).length, 36);
  assert.equal((credits.match(/commons\.wikimedia\.org\/wiki\/File:/g) ?? []).length, 36);
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
    /toggleAdditionalPlace\(state, target\.dataset\.placeId\),\s*\{ preserveScroll: true \}/
  );
});
