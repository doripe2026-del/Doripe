import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import {
  parseDraft,
  parsePackageManifest,
} from "../../scripts/instagram-content/contracts.mjs";
import { writeProductionPackage } from "../../scripts/instagram-content/package-writer.mjs";

const fixtureUrl = new URL("./fixtures/valid-draft.json", import.meta.url);
const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
fixture.candidate.assets[0].rightsStatus = "not_found";
fixture.candidate.assets[0].privacyNote = "식별 가능한 얼굴이 있는지 확인 필요";
const draft = parseDraft(fixture);
const validation = {
  sources: {
    warnings: [`Rights not confirmed: ${draft.candidate.assets[0].sourceUrl}`],
  },
};
const now = new Date("2026-07-14T00:00:00.000Z");

async function createPng(directory, name, marker) {
  await mkdir(directory, { recursive: true });
  const path = join(directory, name);
  await writeFile(path, Buffer.from([0x89, 0x50, 0x4e, 0x47, marker]));
  return path;
}

test("writer atomically creates sequential images and review-ready text files", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "doripe-instagram-"));
  const exportsDir = join(outputRoot, "exports");
  const firstPng = await createPng(exportsDir, "cover.png", 1);
  const secondPng = await createPng(exportsDir, "inner.png", 2);

  const result = await writeProductionPackage({
    outputRoot,
    sequence: 1,
    draft,
    exportedPngs: [firstPng, secondPng],
    validation,
    now,
  });

  assert.equal(basename(result.directory), "01-seongsu-weekend-route");
  assert.deepEqual(
    (await readdir(result.directory)).sort(),
    [
      "01-cover.png",
      "02-content.png",
      "caption.txt",
      "manifest.json",
      "review.txt",
      "sources.txt",
    ],
  );
  assert.deepEqual(await readFile(join(result.directory, "01-cover.png")), await readFile(firstPng));
  assert.deepEqual(await readFile(join(result.directory, "02-content.png")), await readFile(secondPng));
  assert.match(await readFile(join(result.directory, "caption.txt"), "utf8"), /성수에서 천천히/);

  const sources = await readFile(join(result.directory, "sources.txt"), "utf8");
  assert.match(sources, /official-seongsu-route/);
  assert.match(sources, /공공기관/);
  assert.match(sources, /https:\/\/example\.go\.kr\/seongsu-route/);
  assert.match(sources, /photo-seongsu-route/);
  assert.match(sources, /https:\/\/example\.com\/photo-seongsu-route/);
  assert.match(sources, /Example/);
  assert.match(sources, /not_found/);

  const review = await readFile(join(result.directory, "review.txt"), "utf8");
  assert.match(review, /Location tag: 서울 성동구/);
  assert.match(review, /Rights not confirmed/);
  assert.match(review, /식별 가능한 얼굴/);
  assert.match(review, /Human checks/i);

  const manifestOnDisk = parsePackageManifest(JSON.parse(
    await readFile(join(result.directory, "manifest.json"), "utf8"),
  ));
  assert.deepEqual(manifestOnDisk, result.manifest);
  assert.deepEqual(result.manifest.files, [
    "01-cover.png",
    "02-content.png",
    "caption.txt",
    "sources.txt",
    "review.txt",
    "manifest.json",
  ]);

  const dayEntries = await readdir(join(outputRoot, "2026-07-14"));
  assert.equal(dayEntries.some((name) => name.includes(".writing-")), false);
});

test("writer rejects empty or missing PNG exports before creating output", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "doripe-instagram-"));
  const input = { outputRoot, sequence: 1, draft, validation, now };

  await assert.rejects(
    writeProductionPackage({ ...input, exportedPngs: [] }),
    /at least one PNG export/i,
  );
  await assert.rejects(
    writeProductionPackage({ ...input, exportedPngs: undefined }),
    /at least one PNG export/i,
  );
  await assert.rejects(access(join(outputRoot, "2026-07-14")));
});

test("writer rejects unsafe sequence and candidate identifiers", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "doripe-instagram-"));
  const png = await createPng(join(outputRoot, "exports"), "cover.png", 1);

  for (const sequence of [0, -1, 1.5, "../1"]) {
    await assert.rejects(
      writeProductionPackage({
        outputRoot,
        sequence,
        draft,
        exportedPngs: [png],
        validation,
        now,
      }),
      /safe positive integer sequence/i,
    );
  }

  for (const id of ["../escape", "nested/escape", "nested\\escape"]) {
    await assert.rejects(
      writeProductionPackage({
        outputRoot,
        sequence: 1,
        draft: { ...draft, candidate: { ...draft.candidate, id } },
        exportedPngs: [png],
        validation,
        now,
      }),
      /safe candidate ID/i,
    );
  }
});

test("failed writes preserve existing output and remove only their temporary directory", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "doripe-instagram-"));
  const dayDir = join(outputRoot, "2026-07-14");
  const existingDirectory = join(dayDir, "01-seongsu-weekend-route");
  const sentinel = join(existingDirectory, "keep.txt");
  await mkdir(existingDirectory, { recursive: true });
  await writeFile(sentinel, "keep me\n");
  const png = await createPng(join(outputRoot, "exports"), "cover.png", 1);

  await assert.rejects(
    writeProductionPackage({
      outputRoot,
      sequence: 1,
      draft,
      exportedPngs: [png],
      validation,
      now,
    }),
    /already exists/i,
  );
  assert.equal(await readFile(sentinel, "utf8"), "keep me\n");

  await assert.rejects(
    writeProductionPackage({
      outputRoot,
      sequence: 2,
      draft,
      exportedPngs: [join(outputRoot, "missing.png")],
      validation,
      now,
    }),
  );
  await assert.rejects(access(join(dayDir, "02-seongsu-weekend-route")));
  assert.equal((await readdir(dayDir)).some((name) => name.includes(".writing-")), false);
  assert.equal(await readFile(sentinel, "utf8"), "keep me\n");
});
