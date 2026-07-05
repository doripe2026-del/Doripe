import { execFileSync } from "node:child_process";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function fail(message) {
  console.error(`Session guard failed: ${message}`);
  process.exitCode = 1;
}

const branch = git(["branch", "--show-current"]);
const origin = git(["remote", "get-url", "origin"]);

if (branch === "main") {
  fail("do not work or commit directly on main; create a codex/* branch");
}

if (!branch.startsWith("codex/")) {
  fail(`branch must start with codex/, got ${branch}`);
}

if (!origin.includes("github.com/doripe2026-del/Doripe")) {
  fail(`origin must be doripe2026-del/Doripe, got ${origin}`);
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("Session context checks passed.");
