import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("normal preview selects API data while static review selects fixtures", async () => {
  const source = await readFile(new URL("../../public/app-preview/main.js", import.meta.url), "utf8");

  assert.match(source, /isStaticPreview\(\)\s*\?\s*"fixture"\s*:\s*"api"/u);
  assert.doesNotMatch(source, /getAdapter\("fixture"\)/u);
});
