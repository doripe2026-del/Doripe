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
  place_event: "43:25",
  collection: "50:31",
  route: "46:49",
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

const assertNoDaytripReferenceMetadata = (contract) => {
  assert.doesNotMatch(
    JSON.stringify(contract),
    /daytrip|daytrip-reference|imageHash/i,
  );
};

test("tracked Figma template contract is complete", async () => {
  const raw = JSON.parse(await readFile("docs/instagram-content/template-contract.json", "utf8"));
  const contract = parseTemplateContract(raw);
  assert.equal(contract.fileKey, fileKey);
  assert.deepEqual(contract.canvas, { width: 1080, height: 1350, safeInsetX: 34 });
  assert.deepEqual(contract.brandEnd, {
    backgroundHex: "#050505",
    appScreen: {
      kind: "actual_discover_capture",
      sourcePath: "public/app-preview/assets/references/b2.png",
      width: 393,
      height: 852,
      sha256: "0a1ede7e8b24ab705c4f71a50dab92cfccc8b57a49f8b46451d28da036d4e250",
    },
    logo: {
      sourcePath: "public/instagram-pinned-feed/assets/doripe-icon-green.png",
      width: 500,
      height: 500,
      colorHex: "#20F58A",
      sha256: "b18f6f59e483b6363a94c96a10b67e092a231df6d29497d2a2f7cbec40905a76",
    },
  });
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
  assertNoDaytripReferenceMetadata(contract);
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
  assert.equal(contract.brandEnd.appScreen.kind, "actual_discover_capture");
  assert.equal(contract.brandEnd.appScreen.sha256, "0a1ede7e8b24ab705c4f71a50dab92cfccc8b57a49f8b46451d28da036d4e250");
  assert.equal(contract.brandEnd.logo.sha256, "b18f6f59e483b6363a94c96a10b67e092a231df6d29497d2a2f7cbec40905a76");
  for (const template of contract.templates) {
    assert.deepEqual(template.slots, expectedSlots[template.id]);
    assert.deepEqual(
      { minSlides: template.minSlides, maxSlides: template.maxSlides },
      expectedSlideRanges[template.id],
    );
  }
  assertNoDaytripReferenceMetadata(contract);
});
