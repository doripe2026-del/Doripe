import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

function importSpecifiers(source) {
  const tokens = [];

  for (let index = 0; index < source.length;) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (/\s/u.test(character)) {
      index += 1;
      continue;
    }
    if (character === "/" && nextCharacter === "/") {
      index = source.indexOf("\n", index + 2);
      if (index === -1) break;
      continue;
    }
    if (character === "/" && nextCharacter === "*") {
      index = source.indexOf("*/", index + 2);
      if (index === -1) break;
      index += 2;
      continue;
    }
    if (["\"", "'", "`"].includes(character)) {
      const quote = character;
      let value = "";
      index += 1;
      while (index < source.length && source[index] !== quote) {
        if (source[index] === "\\") index += 1;
        value += source[index] || "";
        index += 1;
      }
      index += 1;
      tokens.push({ type: "string", value });
      continue;
    }
    if (/[A-Za-z_$]/u.test(character)) {
      const start = index;
      index += 1;
      while (/[A-Za-z0-9_$]/u.test(source[index] || "")) index += 1;
      tokens.push({ type: "word", value: source.slice(start, index) });
      continue;
    }
    tokens.push({ type: "punctuation", value: character });
    index += 1;
  }

  const specifiers = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index]?.type !== "word" || tokens[index].value !== "import") continue;

    const next = tokens[index + 1];
    if (next?.value === "(" && tokens[index + 2]?.type === "string") {
      specifiers.push(tokens[index + 2].value);
      continue;
    }
    if (next?.type === "string") {
      specifiers.push(next.value);
      continue;
    }
    for (let cursor = index + 1; cursor < tokens.length && tokens[cursor].value !== ";"; cursor += 1) {
      if (tokens[cursor]?.value === "from" && tokens[cursor + 1]?.type === "string") {
        specifiers.push(tokens[cursor + 1].value);
        break;
      }
    }
  }
  return specifiers;
}

function referencesFixtures(specifier) {
  return /(?:^|\/)fixtures\.js(?:[?#].*)?$/u.test(specifier);
}

test("import matcher detects fixture specifiers without reading comments or strings", () => {
  const source = [
    "// import '../fixtures.js';",
    "/* import '../fixtures.js'; */",
    "const example = \"import '../fixtures.js';\";",
    "import { PLACES } from '../fixtures.js';",
    "import '../fixtures.js';",
    "await import('../fixtures.js');"
  ].join("\n");

  assert.deepEqual(
    importSpecifiers(source).filter(referencesFixtures),
    ["../fixtures.js", "../fixtures.js", "../fixtures.js"]
  );
});

test("only fixture repository references fixture collections", async () => {
  const root = new URL("../../public/app-preview/", import.meta.url);
  const files = await readdir(root, { recursive: true });
  const offenders = [];

  for (const file of files.filter((name) => name.endsWith(".js") || name.endsWith(".mjs"))) {
    const source = await readFile(new URL(file, root), "utf8");
    if (importSpecifiers(source).some(referencesFixtures) && file !== "data/fixture-repository.js") {
      offenders.push(file);
    }
  }

  assert.deepEqual(offenders, []);
});
