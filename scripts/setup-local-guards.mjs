import { execFileSync } from "node:child_process";
import { chmodSync } from "node:fs";

function run(command, args) {
  execFileSync(command, args, { stdio: "inherit" });
}

for (const hook of [".githooks/pre-commit", ".githooks/pre-push"]) {
  chmodSync(hook, 0o755);
}

run("git", ["config", "core.hooksPath", ".githooks"]);

console.log("Local git hooks enabled: .githooks");
