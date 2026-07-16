import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function importTypescript(entry) {
  const output = await mkdtemp(path.join(os.tmpdir(), "doripe-discovery-saves-test-"));
  const outfile = path.join(output, "module.mjs");
  await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile });
  return {
    module: await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`),
    cleanup: () => rm(output, { recursive: true, force: true }),
  };
}

const placeRow = {
  id: "place-1",
  name: "도리페 카페",
  short_copy: "조용한 오후를 보내기 좋은 곳",
  neighborhood_id: "seongsu",
  category_id: "cafe",
  mood_tags: ["quiet"],
  best_for: ["date"],
  time_tags: ["afternoon"],
  lat: 37.5,
  lng: 127.0,
  address: "서울 성동구",
  nearest_station: "성수역 3번 출구",
  hours_text: "10:00-22:00",
  price_hint: "₩₩",
  stay_time_minutes: 90,
  created_at: "2026-07-14T00:00:00.000Z",
  updated_at: "2026-07-14T01:00:00.000Z",
  phone_text: "02-000-0000",
  representative_menu_name: "필터 커피",
  representative_menu_price: "7,000원",
  naver_place_url: "https://map.naver.com/p/place-1",
};

test("place output exposes UI detail fields already selected from the database", async () => {
  const loaded = await importTypescript("src/backend/domains/discovery.ts");
  try {
    const output = loaded.module.publicPlaceOutput(
      placeRow,
      [],
      { id: "cafe", name: "카페", display_order: 2 },
      [],
    );
    assert.equal(output.nearestStation, "성수역 3번 출구");
    assert.equal(output.phoneText, "02-000-0000");
    assert.equal(output.priceLevel, "₩₩");
    assert.equal(output.representativeMenuName, "필터 커피");
    assert.equal(output.representativeMenuPrice, "7,000원");
    assert.deepEqual(output.representativeMenu, { name: "필터 커피", price: "7,000원" });
    assert.equal(output.stayTimeMinutes, 90);
    assert.equal(output.shortCopy, "조용한 오후를 보내기 좋은 곳");
    assert.deepEqual(output.bestFor, ["date"]);
    assert.deepEqual(output.timeTags, ["afternoon"]);
  } finally {
    await loaded.cleanup();
  }
});

test("save targetType accepts place or course and rejects unknown values", async () => {
  const loaded = await importTypescript("src/backend/domains/saves.ts");
  try {
    assert.deepEqual(loaded.module.selectedSaveTargetTypes(new URL("https://doripe.kr/api/v1/me/saves")), ["place", "course"]);
    assert.deepEqual(loaded.module.selectedSaveTargetTypes(new URL("https://doripe.kr/api/v1/me/saves?targetType=place")), ["place"]);
    assert.deepEqual(loaded.module.selectedSaveTargetTypes(new URL("https://doripe.kr/api/v1/me/saves?targetType=course")), ["course"]);
    assert.throws(
      () => loaded.module.selectedSaveTargetTypes(new URL("https://doripe.kr/api/v1/me/saves?targetType=content")),
      (error) => error.code === "invalid_target_type" && error.status === 400,
    );
  } finally {
    await loaded.cleanup();
  }
});

test("saved rows keep legacy fields and receive batched place and course targets", async () => {
  const loaded = await importTypescript("src/backend/domains/saves.ts");
  try {
    const savedRows = [
      {
        id: "save-place",
        targetId: "place-1",
        targetType: "place",
        savedAt: "2026-07-14T02:00:00.000Z",
        sourceContentId: null,
        sourceScreen: "discover",
      },
      {
        id: "save-course",
        targetId: "00000000-0000-4000-8000-000000000001",
        targetType: "course",
        savedAt: "2026-07-14T01:00:00.000Z",
        sourceContentId: null,
        sourceScreen: "course",
      },
    ];
    const result = loaded.module.hydrateSavedRows(savedRows, [{
      id: "place-1",
      name: "도리페 카페",
      address: "서울 성동구",
      nearest_station: "성수역",
      category_id: "cafe",
      lat: 37.5,
      lng: 127.0,
      price_hint: "₩₩",
      representative_menu_name: "필터 커피",
      representative_menu_price: "7,000원",
      stay_time_minutes: 90,
      updated_at: "2026-07-14T00:00:00.000Z",
    }], [{
      id: "00000000-0000-4000-8000-000000000001",
      user_id: "00000000-0000-4000-8000-000000000002",
      name: "성수 오후 코스",
      is_public: true,
      start_place_id: "place-1",
      version: 3,
      updated_at: "2026-07-14T00:00:00.000Z",
    }], [{
      id: "00000000-0000-4000-8000-000000000003",
      course_id: "00000000-0000-4000-8000-000000000001",
      place_id: "place-1",
      position: 0,
      stay_duration_minutes: 90,
      note: "첫 장소",
    }]);

    assert.equal(result[0].id, "save-place");
    assert.equal(result[0].targetType, "place");
    assert.equal(result[0].target.name, "도리페 카페");
    assert.equal(result[0].target.nearestStation, "성수역");
    assert.equal(result[0].target.representativeMenuName, "필터 커피");
    assert.equal(result[0].target.representativeMenuPrice, "7,000원");
    assert.equal(result[1].id, "save-course");
    assert.equal(result[1].targetType, "course");
    assert.equal(result[1].target.name, "성수 오후 코스");
    assert.equal(result[1].target.placeCount, 1);
    assert.deepEqual(result[1].target.places, [{
      id: "00000000-0000-4000-8000-000000000003",
      placeId: "place-1",
      position: 0,
      stayMinutes: 90,
      note: "첫 장소",
    }]);
  } finally {
    await loaded.cleanup();
  }
});
