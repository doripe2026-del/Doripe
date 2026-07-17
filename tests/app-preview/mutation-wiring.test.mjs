import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mainSource = await readFile(new URL("../../public/app-preview/main.js", import.meta.url), "utf8");

test("the main click dispatcher routes product mutations through action sync", () => {
  assert.match(mainSource, /import \{ createActionSync \} from "\.\/data\/action-sync\.js";/u);
  assert.match(mainSource, /actionSync\.isPending\(/u);
  assert.match(mainSource, /actionSync\.run\(/u);
});

test("mutation failures have a global visible status message", () => {
  assert.match(mainSource, /preview-mutation-feedback/u);
  assert.match(mainSource, /aria-live", "polite"/u);
});
