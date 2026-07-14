import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { parseTemplateContract } from "../../scripts/instagram-content/contracts.mjs";

const execFileAsync = promisify(execFile);
const fileKey = "9btf9oUzIvw3JQq4OPyYEn";
const approvedRoots = {
  place_event: "28:14",
  collection: "28:15",
  route: "28:16",
};
const expectedSlots = {
  place_event: ["slot:title", "slot:subtitle", "slot:photo:01", "slot:credit", "slot:brand-question"],
  collection: ["slot:title", "slot:subtitle", "slot:photo:01", "slot:place:01", "slot:body:01", "slot:credit", "slot:brand-question"],
  route: ["slot:title", "slot:subtitle", "slot:photo:01", "slot:place:01", "slot:body:01", "slot:info:location", "slot:credit", "slot:brand-question"],
};
const expectedSlideRanges = {
  place_event: { minSlides: 6, maxSlides: 8 },
  collection: { minSlides: 7, maxSlides: 11 },
  route: { minSlides: 7, maxSlides: 9 },
};

const assertNoReferenceAssetMetadata = (contract) => {
  assert.doesNotMatch(
    JSON.stringify(contract),
    /daytrip|daytrip-reference|imageHash|assetPath|sourcePath/i,
  );
};

test("tracked Figma template contract is complete", async () => {
  const raw = JSON.parse(await readFile("docs/instagram-content/template-contract.json", "utf8"));
  const contract = parseTemplateContract(raw);
  assert.equal(contract.fileKey, fileKey);
  assert.deepEqual(contract.canvas, { width: 1080, height: 1350, safeInsetX: 34 });
  assert.deepEqual(contract.templates.map(({ id }) => id).sort(), ["collection", "place_event", "route"]);
  for (const template of contract.templates) {
    assert.equal(template.rootNodeId, approvedRoots[template.id]);
    assert.deepEqual(template.slots, expectedSlots[template.id]);
    assert.deepEqual(
      { minSlides: template.minSlides, maxSlides: template.maxSlides },
      expectedSlideRanges[template.id],
    );
    assert.equal(new Set(template.slots).size, template.slots.length);
  }
  assertNoReferenceAssetMetadata(contract);
});

test("contract writer emits approved roots without Daytrip reference asset metadata", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "doripe-template-contract-"));
  const output = join(directory, "template-contract.json");
  t.after(() => rm(directory, { recursive: true, force: true }));

  await execFileAsync(process.execPath, [
    "scripts/instagram-content/write-template-contract.mjs",
    `fileKey=${fileKey}`,
    `placeEventNodeId=${approvedRoots.place_event}`,
    `collectionNodeId=${approvedRoots.collection}`,
    `routeNodeId=${approvedRoots.route}`,
    `output=${output}`,
  ]);

  const contract = parseTemplateContract(JSON.parse(await readFile(output, "utf8")));
  assert.deepEqual(
    Object.fromEntries(contract.templates.map(({ id, rootNodeId }) => [id, rootNodeId])),
    approvedRoots,
  );
  for (const template of contract.templates) {
    assert.deepEqual(template.slots, expectedSlots[template.id]);
    assert.deepEqual(
      { minSlides: template.minSlides, maxSlides: template.maxSlides },
      expectedSlideRanges[template.id],
    );
  }
  assertNoReferenceAssetMetadata(contract);
});
