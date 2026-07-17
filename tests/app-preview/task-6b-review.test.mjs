import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import actionContract from "../../public/app-preview/figma/action-contract.json" with { type: "json" };
import inventory from "../../public/app-preview/figma/screen-inventory.json" with { type: "json" };
import measurements from "../../public/app-preview/figma/screen-measurements.json" with { type: "json" };
import masks from "../../public/app-preview/figma/visual-masks.json" with { type: "json" };
import { getScreen } from "../../public/app-preview/screen-registry.js";
import { dispatchAction } from "../../public/app-preview/transitions.js";

const expectedScreens = [
  ["a1", "446:34", "A1 / 시작"],
  ["a1-splash", "579:698", "A1 / 스플래시"],
  ["a3", "579:929", "A3 / 로그인"],
  ["a4", "579:991", "A4 / 로그인 실패"],
  ["a5", "579:833", "A5 / 비밀번호 재설정 이메일 입력"],
  ["a6", "579:848", "A6 / 재설정 메일 발송"],
  ["a7", "579:702", "A7 / 새 비밀번호 설정"],
  ["a8", "579:1063", "A8 / 비밀번호 확인 불일치"],
  ["a9", "579:638", "A9 / 회원가입 이메일 입력"],
  ["a10", "579:1015", "A10 / 이메일 형식 오류"],
  ["a11", "579:1039", "A11 / 이미 가입된 이메일"],
  ["a12", "579:621", "A12 / 비밀번호 생성"],
  ["a13", "579:660", "A13 / 비밀번호 입력"],
  ["a14", "579:763", "A14 / 출생연도 선택"],
  ["a15", "579:951", "A15 / 성별 선택"],
  ["a16", "579:739", "A16 / 닉네임 입력"],
  ["a17", "579:1102", "A17 / 닉네임 중복 오류"],
  ["a18", "579:781", "A18 / 유입경로 선택"],
  ["a19", "579:863", "A19 / 인지경로 선택"],
  ["a20", "579:1127", "A20 / 동네 선택됨"],
  ["a21", "579:1173", "A21 / 동네 이동 전환"],
  ["a22", "579:1162", "A22 / 동네 선택 완료 로딩"],
  ["b1", "446:507", "B1 / 팔로잉 피드"],
  ["b2", "446:596", "B2 / 발견 피드"],
  ["b3", "446:646", "B3 / 발견 피드 확장"],
  ["b4", "446:682", "B4 / 장소 상세"],
  ["b5", "446:818", "B5 / 장소 상세 CTA"],
  ["b6", "446:876", "B6 / 장소 상세 CTA Hover"],
  ["b7", "446:1000", "B7 / 사진 확대"],
  ["b8", "446:1017", "B8 / 댓글"],
  ["b9", "446:1070", "B9 / 영업시간"],
  ["b10", "446:1106", "B10 / 장소 상세 전체"],
  ["b11", "446:2667", "B11 / 관련 장소"],
  ["b12", "446:2792", "B12 / 사용자 프로필"],
  ["b13", "446:3042", "B13 / 팔로잉 목록"],
  ["c1", "446:1787", "C1 / 장소 메인"],
  ["c2", "446:1631", "C2 / 코스 메인"],
  ["c3", "446:1223", "C3 / 필터"],
  ["c7", "446:1474", "C7 / 코스 장소 바꾸기"],
  ["c4", "446:1715", "C4 / 장소 상세"],
  ["c6", "446:2394", "C6 / 코스 상세"],
  ["d1", "446:2641", "D1 / 코스 첫 화면"],
  ["d2", "446:1929", "D2 / 지도에서 시작 위치 지정"],
  ["d3", "446:2608", "D3 / 저장 목록에서 시작 장소 선택"],
  ["d4", "446:2574", "D4 / 시작 장소 선택 완료"],
  ["d5", "446:1956", "D5 / 다음 장소 · 저장된 장소"],
  ["d6", "446:2048", "D6 / 다음 장소 · 새로 발견"],
  ["d7", "446:2166", "D7 / 선택 장소 확인"],
  ["d8", "446:2218", "D8 / 코스 이름 정하기"],
  ["d9", "446:2256", "D9 / 코스 완성"],
  ["e1", "446:2912", "E1 / MY 메인"],
  ["e2", "446:2850", "E2 / 프로필 수정"],
  ["e3", "446:2952", "E3 / 계정 설정"],
  ["e4", "446:2984", "E4 / 알림 설정"],
  ["e5", "446:3031", "E5 / 문의"]
];

test("B10 course creation enters the selected-start-place screen D4", () => {
  const record = actionContract.actions.find(({ screenId, actionId }) => (
    screenId === "b10" && actionId === "create-route"
  ));
  assert.equal(record.effect.destination, "d4");
  assert.equal(dispatchAction("b10", "create-route", {}).nextScreenId, "d4");
});

test("B1 has no invented feed-level save-place action", () => {
  assert.ok(!actionContract.actions.some(({ screenId, actionId }) => (
    screenId === "b1" && actionId === "save-place"
  )));
  assert.ok(!getScreen("b1").actions.includes("save-place"));
});

test("inventory equals the exact 55-screen current governed node set", () => {
  const actual = inventory
    .map(({ id, nodeId, name }) => [id, nodeId, name])
    .sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true }));
  const expected = [...expectedScreens]
    .sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true }));

  assert.equal(expectedScreens.length, 55);
  assert.equal(inventory.length, expectedScreens.length);
  assert.deepEqual(actual, expected);
  assert.equal(new Set(inventory.map(({ nodeId }) => nodeId)).size, expectedScreens.length);
  assert.deepEqual(Object.keys(measurements).sort(), inventory.map(({ id }) => id).sort());
  assert.deepEqual(Object.keys(masks).sort(), inventory.map(({ id }) => id).sort());
  assert.ok(!inventory.some(({ nodeId }) => (
    ["446:1348", "446:2341", "446:2462", "446:2530"].includes(nodeId)
  )));
  for (const screen of inventory) {
    assert.equal(screen.reference, `/app-preview/assets/references/${screen.id}.png`);
  }
});

test("C/D/E reference reindex is documented by exact live node and content hash", async () => {
  const manifest = JSON.parse(await readFile(
    new URL("../../public/app-preview/figma/current-flow-reindex.json", import.meta.url),
    "utf8"
  ));
  const inventoryByNode = new Map(inventory.map((screen) => [screen.nodeId, screen]));

  assert.equal(manifest.baselineCommit, "902475dddd5a690f10ac219b7966f16bbb47f9e7");
  assert.deepEqual(manifest.topLevelCounts, { A: 22, B: 13, C: 6, D: 9, E: 5 });
  assert.equal(manifest.moves.length, 19);
  assert.deepEqual(manifest.unchanged, [{ id: "e2", nodeId: "446:2850" }]);

  for (const move of manifest.moves) {
    const current = inventoryByNode.get(move.nodeId);
    assert.equal(current?.id, move.toId, move.nodeId);
    const bytes = await readFile(new URL(`../../public${current.reference}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), move.sha256, move.toId);
  }

  assert.deepEqual(
    manifest.removedHistoricalNodes.map(({ fromId, nodeId }) => [fromId, nodeId]),
    [["c2", "446:1348"], ["d7", "446:2341"], ["d9", "446:2462"], ["d10", "446:2530"]]
  );
  assert.ok(manifest.removedHistoricalNodes.every(({ nodeId }) => !inventoryByNode.has(nodeId)));
  assert.deepEqual(manifest.retiredReferenceAliases, ["d14", "e1", "e7"]);
});
