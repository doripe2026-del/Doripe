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
  assert.deepEqual(PLACES, [
    { id: "place-01", name: "레이어드 연남", copy: "빛과 디저트가 머무는 공간", image: "/booth-demo/assets/place-01.png" },
    { id: "place-02", name: "오브젝트 연남", copy: "천천히 둘러보는 작은 취향", image: "/booth-demo/assets/place-02.png" },
    { id: "place-03", name: "갤러리 무아", copy: "빛과 여백이 흐르는 전시 공간", image: "/booth-demo/assets/place-03.png" },
    { id: "place-04", name: "이후북스", copy: "오래 머물고 싶은 작은 책방", image: "/booth-demo/assets/place-04.png" },
    { id: "place-05", name: "사운드 캐비닛", copy: "좋은 음악으로 채운 늦은 오후", image: "/booth-demo/assets/place-05.png" },
    { id: "place-06", name: "정원 식탁", copy: "초록 사이에서 즐기는 한 끼", image: "/booth-demo/assets/place-06.png" },
    { id: "place-07", name: "크림 아틀리에", copy: "작은 디저트가 완성되는 순간", image: "/booth-demo/assets/place-07.png" },
    { id: "place-08", name: "스튜디오 콤마", copy: "일상에 쉼표를 더하는 디자인", image: "/booth-demo/assets/place-08.png" }
  ]);
  assert.equal(Object.isFrozen(PLACES), true);
  assert.equal(PLACES.every(Object.isFrozen), true);
});

test("all demo places use available local booth assets", async () => {
  assert.equal(PLACES.length, 8);
  for (const place of PLACES) {
    assert.match(place.image, /^\/booth-demo\/assets\/place-\d{2}\.png$/);
    await access(new URL(`../../public${place.image}`, import.meta.url));
  }
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
