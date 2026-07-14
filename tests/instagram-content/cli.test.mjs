import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const cliPath = join(repoRoot, "scripts/instagram-content/cli.mjs");
const templatePath = join(
  repoRoot,
  "docs/instagram-content/template-contract.json",
);

const [templateContract, validDraft, candidateFixture] = await Promise.all([
  readJson(templatePath),
  readJson(join(repoRoot, "tests/instagram-content/fixtures/valid-draft.json")),
  readJson(join(repoRoot, "tests/instagram-content/fixtures/candidates.json")),
]);

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
  });
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function makeTempDirectory() {
  return mkdtemp(join(tmpdir(), "doripe-instagram-cli-"));
}

function validRouteLayoutEvidence() {
  const route = templateContract.templates.find(
    (template) => template.id === "route",
  );

  return {
    templateId: route.id,
    rootNodeId: route.rootNodeId,
    canvas: templateContract.canvas,
    slideCount: route.minSlides,
    slides: [
      {
        role: "cover",
        textSlots: ["slot:title", "slot:subtitle", "slot:credit"],
        visibleText: [validDraft.candidate.title],
        hasDoripeLogo: true,
      },
      ...Array.from({ length: route.minSlides - 2 }, () => ({
        role: "content",
        textSlots: [],
        visibleText: [],
        hasDoripeLogo: true,
      })),
      {
        role: "brand_end",
        textSlots: ["slot:brand-question"],
        visibleText: [validDraft.brandQuestion, "Doripe."],
        brandQuestion: validDraft.brandQuestion,
        hasDoripeLogo: true,
        doripeLogoColorHex: "#20F58A",
        hasBrandWordmark: true,
        hasPhoneMockup: true,
        backgroundHex: "#050505",
      },
    ],
    slots: route.slots.map((name) =>
      name.startsWith("slot:photo:")
        ? { name, editable: true }
        : {
            name,
            editable: true,
            overflows: false,
            midWordBreak: false,
            baseFontSize: 64,
            fontSize: 64,
          },
    ),
  };
}

test("CLI prints usage and exits non-zero without a command", () => {
  const result = runCli([]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
  assert.match(result.stderr, /check-template/);
  assert.match(result.stderr, /score/);
  assert.match(result.stderr, /validate/);
  assert.match(result.stderr, /finalize/);
});

test("each CLI command checks its exact argument count before reading files", () => {
  const commands = [
    { name: "check-template", count: 1 },
    { name: "score", count: 4 },
    { name: "validate", count: 3 },
    { name: "finalize", count: 4 },
  ];

  for (const command of commands) {
    for (const count of [command.count - 1, command.count + 1]) {
      const args = Array.from({ length: count }, (_, index) => `missing-${index}`);
      const result = runCli([command.name, ...args]);

      assert.notEqual(result.status, 0, `${command.name} should reject ${count} args`);
      assert.match(result.stderr, new RegExp(`Usage:.*${command.name}`));
      assert.doesNotMatch(result.stderr, /ENOENT|no such file/i);
    }
  }
});

test("check-template accepts the canonical contract and rejects invalid contracts or JSON", async () => {
  const directory = await makeTempDirectory();
  const invalidPath = join(directory, "invalid-template.json");
  const malformedPath = join(directory, "malformed-template.json");
  await writeJson(invalidPath, {});
  await writeFile(malformedPath, "{", "utf8");

  const validResult = runCli(["check-template", templatePath], { cwd: directory });
  assert.equal(validResult.status, 0, validResult.stderr);
  assert.match(validResult.stdout, /passed/i);

  const invalidResult = runCli(["check-template", invalidPath], {
    cwd: directory,
  });
  assert.notEqual(invalidResult.status, 0);
  assert.match(invalidResult.stderr, /template|invalid|version/i);

  const malformedResult = runCli(["check-template", malformedPath], {
    cwd: directory,
  });
  assert.notEqual(malformedResult.status, 0);
  assert.match(malformedResult.stderr, /Invalid JSON/i);
});

test("score parses domestic candidates, caps selection at two, and tolerates missing or empty performance CSV", async () => {
  const directory = await makeTempDirectory();
  const candidatesPath = join(directory, "candidates.json");
  const historyPath = join(directory, "history.json");
  const missingPerformancePath = join(directory, "missing-performance.csv");
  const emptyPerformancePath = join(directory, "empty-performance.csv");
  const missingOutputPath = join(directory, "selected-missing.json");
  const emptyOutputPath = join(directory, "selected-empty.json");

  await Promise.all([
    writeJson(candidatesPath, candidateFixture),
    writeJson(historyPath, []),
    writeFile(emptyPerformancePath, "", "utf8"),
  ]);

  const missingResult = runCli(
    [
      "score",
      candidatesPath,
      historyPath,
      missingPerformancePath,
      missingOutputPath,
    ],
    { cwd: directory },
  );
  assert.equal(missingResult.status, 0, missingResult.stderr);

  const selectedWithMissingPerformance = await readJson(missingOutputPath);
  assert.equal(selectedWithMissingPerformance.length, 2);
  assert.deepEqual(
    selectedWithMissingPerformance.map((candidate) => candidate.id),
    ["seongsu-weekend-route", "new-event"],
  );
  assert.ok(
    selectedWithMissingPerformance.every(
      (candidate) => Number.isFinite(candidate.totalScore),
    ),
  );

  const emptyResult = runCli(
    [
      "score",
      candidatesPath,
      historyPath,
      emptyPerformancePath,
      emptyOutputPath,
    ],
    { cwd: directory },
  );
  assert.equal(emptyResult.status, 0, emptyResult.stderr);
  assert.equal((await readJson(emptyOutputPath)).length, 2);
});

test("score rejects an overseas candidate and malformed history without writing output", async () => {
  const directory = await makeTempDirectory();
  const overseasPath = join(directory, "overseas-candidates.json");
  const historyPath = join(directory, "history.json");
  const malformedHistoryPath = join(directory, "malformed-history.json");
  const missingPerformancePath = join(directory, "missing-performance.csv");
  const overseasOutputPath = join(directory, "overseas-selected.json");
  const historyOutputPath = join(directory, "history-selected.json");
  const overseasCandidates = structuredClone(candidateFixture);
  overseasCandidates[0].countryCode = "JP";

  await Promise.all([
    writeJson(overseasPath, overseasCandidates),
    writeJson(historyPath, []),
    writeJson(malformedHistoryPath, {}),
  ]);

  const overseasResult = runCli([
    "score",
    overseasPath,
    historyPath,
    missingPerformancePath,
    overseasOutputPath,
  ]);
  assert.notEqual(overseasResult.status, 0);
  assert.match(overseasResult.stderr, /KR|countryCode|invalid/i);
  await assert.rejects(access(overseasOutputPath));

  const historyResult = runCli([
    "score",
    join(repoRoot, "tests/instagram-content/fixtures/candidates.json"),
    malformedHistoryPath,
    missingPerformancePath,
    historyOutputPath,
  ]);
  assert.notEqual(historyResult.status, 0);
  assert.match(historyResult.stderr, /history.*array/i);
  await assert.rejects(access(historyOutputPath));
});

test("validate checks layout evidence against the canonical template contract", async () => {
  const directory = await makeTempDirectory();
  const draftPath = join(directory, "draft.json");
  const layoutPath = join(directory, "layout-evidence.json");
  const validationPath = join(directory, "validation.json");
  const invalidLayoutPath = join(directory, "invalid-layout-evidence.json");
  const invalidValidationPath = join(directory, "invalid-validation.json");
  const layoutEvidence = validRouteLayoutEvidence();

  await Promise.all([
    writeJson(draftPath, validDraft),
    writeJson(layoutPath, layoutEvidence),
    writeJson(invalidLayoutPath, {
      ...layoutEvidence,
      rootNodeId: "wrong-root",
    }),
  ]);

  const validResult = runCli(
    ["validate", draftPath, layoutPath, validationPath],
    { cwd: directory },
  );
  assert.equal(validResult.status, 0, validResult.stderr);
  const validation = await readJson(validationPath);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(validation).map(([name, result]) => [name, result.ok]),
    ),
    {
      originality: true,
      caption: true,
      sources: true,
      layout: true,
      presentation: true,
    },
  );

  const invalidResult = runCli(
    ["validate", draftPath, invalidLayoutPath, invalidValidationPath],
    { cwd: directory },
  );
  assert.notEqual(invalidResult.status, 0);
  assert.match(invalidResult.stderr, /root|layout|template/i);
  await assert.rejects(access(invalidValidationPath));
});

test("finalize rejects an export count that differs from the validated slide count", async () => {
  const directory = await makeTempDirectory();
  const draftPath = join(directory, "draft.json");
  const layoutPath = join(directory, "layout-evidence.json");
  const pngPath = join(directory, "slide.png");
  const exportsPath = join(directory, "exports.json");
  const outputRoot = join(directory, "packages");
  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01,
  ]);

  await Promise.all([
    writeJson(draftPath, validDraft),
    writeJson(layoutPath, validRouteLayoutEvidence()),
    writeFile(pngPath, pngBytes),
    writeJson(exportsPath, { sequence: 1, files: [pngPath] }),
  ]);

  const result = runCli(
    ["finalize", draftPath, layoutPath, exportsPath, outputRoot],
    { cwd: directory },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /export.*count|slide.*count|6/i);
  await assert.rejects(access(outputRoot));
});

test("finalize rejects duplicate export paths used to satisfy the slide count", async () => {
  const directory = await makeTempDirectory();
  const draftPath = join(directory, "draft.json");
  const layoutPath = join(directory, "layout-evidence.json");
  const pngPath = join(directory, "slide.png");
  const exportsPath = join(directory, "exports.json");
  const outputRoot = join(directory, "packages");
  const layoutEvidence = validRouteLayoutEvidence();
  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01,
  ]);

  await Promise.all([
    writeJson(draftPath, validDraft),
    writeJson(layoutPath, layoutEvidence),
    writeFile(pngPath, pngBytes),
    writeJson(exportsPath, {
      sequence: 1,
      files: Array(layoutEvidence.slideCount).fill(pngPath),
    }),
  ]);

  const result = runCli(
    ["finalize", draftPath, layoutPath, exportsPath, outputRoot],
    { cwd: directory },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unique|duplicate/i);
  await assert.rejects(access(outputRoot));
});

test("finalize writes a complete package when PNG exports exactly match the slide count", async () => {
  const directory = await makeTempDirectory();
  const draftPath = join(directory, "draft.json");
  const layoutPath = join(directory, "layout-evidence.json");
  const exportsPath = join(directory, "exports.json");
  const outputRoot = join(directory, "packages");
  const pngPaths = Array.from(
    { length: validRouteLayoutEvidence().slideCount },
    (_, index) => join(directory, `slide-${index + 1}.png`),
  );
  const pngBytes = pngPaths.map((_, index) =>
    Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, index + 1,
    ]),
  );

  await Promise.all([
    writeJson(draftPath, validDraft),
    writeJson(layoutPath, validRouteLayoutEvidence()),
    ...pngPaths.map((pngPath, index) => writeFile(pngPath, pngBytes[index])),
    writeJson(exportsPath, { sequence: 1, files: pngPaths }),
  ]);

  const result = runCli(
    ["finalize", draftPath, layoutPath, exportsPath, outputRoot],
    { cwd: directory },
  );
  assert.equal(result.status, 0, result.stderr);

  const packageDirectory = result.stdout.trim();
  assert.ok(packageDirectory.startsWith(outputRoot));
  const expectedFiles = [
    "01-cover.png",
    "02-content.png",
    "03-content.png",
    "04-content.png",
    "05-content.png",
    "06-content.png",
    "caption.txt",
    "sources.txt",
    "review.txt",
    "manifest.json",
  ];
  await Promise.all(
    expectedFiles.map((fileName) => access(join(packageDirectory, fileName))),
  );

  await Promise.all(
    pngBytes.map(async (bytes, index) => {
      const prefix = String(index + 1).padStart(2, "0");
      const label = index === 0 ? "cover" : "content";
      const packagedPng = await readFile(
        join(packageDirectory, `${prefix}-${label}.png`),
      );
      assert.deepEqual(packagedPng, bytes);
    }),
  );
  const manifest = await readJson(join(packageDirectory, "manifest.json"));
  assert.equal(manifest.candidateId, validDraft.candidate.id);
  const review = await readFile(join(packageDirectory, "review.txt"), "utf8");
  for (const gate of ["Originality", "Caption", "Sources", "Layout", "Presentation"]) {
    assert.match(review, new RegExp(`- ${gate}: PASS`));
  }
});
