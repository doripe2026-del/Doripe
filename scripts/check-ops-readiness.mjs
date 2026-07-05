import { execFileSync, spawnSync } from "node:child_process";

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function runCombined(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stderr || result.stdout}`);
  }
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
}

function fail(message) {
  console.error(`Ops readiness failed: ${message}`);
  process.exitCode = 1;
}

function checkGitHub() {
  const repo = JSON.parse(run("gh", ["repo", "view", "doripe2026-del/Doripe", "--json", "visibility,defaultBranchRef"]));
  if (repo.visibility !== "PUBLIC") fail(`GitHub repo must be PUBLIC, got ${repo.visibility}`);
  if (repo.defaultBranchRef?.name !== "main") fail(`default branch must be main, got ${repo.defaultBranchRef?.name}`);

  const protection = JSON.parse(run("gh", [
    "api",
    "repos/doripe2026-del/Doripe/branches/main/protection",
    "--jq",
    "{required_status_checks:.required_status_checks.contexts, strict:.required_status_checks.strict, required_pr:.required_pull_request_reviews.required_approving_review_count, enforce_admins:.enforce_admins.enabled, force_pushes:.allow_force_pushes.enabled, deletions:.allow_deletions.enabled}",
  ]));

  for (const requiredCheck of ["build", "repository-guard"]) {
    if (!protection.required_status_checks?.includes(requiredCheck)) {
      fail(`main protection missing required check: ${requiredCheck}`);
    }
  }
  if (protection.strict !== true) fail("main protection must require branches to be up to date");
  if (protection.enforce_admins !== true) fail("main protection must enforce admins");
  if (protection.force_pushes !== false) fail("main protection must block force pushes");
  if (protection.deletions !== false) fail("main protection must block branch deletion");
}

function checkVercel() {
  const inspect = runCombined("npx", ["vercel", "project", "inspect", "doripe", "--scope", "team_x4ATeutcmggg4kpLhjkZoJKA"]);
  if (!inspect.includes("prj_X7eZo91o0Aw0HcodafbBKhPnEP2k")) fail("Vercel project ID mismatch");
  if (!inspect.includes("Output Directory") || !inspect.includes("public")) fail("Vercel output directory must be public");

  const protection = run("npx", ["vercel", "project", "protection", "doripe", "--format", "json", "--scope", "team_x4ATeutcmggg4kpLhjkZoJKA"]);
  const jsonStart = protection.indexOf("{");
  const parsed = JSON.parse(protection.slice(jsonStart));
  if (parsed.gitForkProtection !== true) fail("Vercel git fork protection should be enabled");
}

checkGitHub();
checkVercel();

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("Ops readiness checks passed.");
