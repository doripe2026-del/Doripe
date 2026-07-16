import { execFileSync, spawnSync } from "node:child_process";
import {
  assessReadinessResponse,
  assessSupabaseEnvironmentReadiness,
} from "./lib/vercel-env-readiness.mjs";

const VERCEL_SCOPE = "team_x4ATeutcmggg4kpLhjkZoJKA";
const PRODUCTION_URL = (process.env.DORIPE_PRODUCTION_URL ?? "https://doripe.kr").replace(/\/$/, "");

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
  const inspect = runCombined("npx", ["vercel", "project", "inspect", "doripe", "--scope", VERCEL_SCOPE]);
  if (!inspect.includes("prj_X7eZo91o0Aw0HcodafbBKhPnEP2k")) fail("Vercel project ID mismatch");
  if (!inspect.includes("Output Directory") || !inspect.includes("public")) fail("Vercel output directory must be public");

  const protection = run("npx", ["vercel", "project", "protection", "doripe", "--format", "json", "--scope", VERCEL_SCOPE]);
  const jsonStart = protection.indexOf("{");
  const parsed = JSON.parse(protection.slice(jsonStart));
  if (parsed.gitForkProtection !== true) fail("Vercel git fork protection should be enabled");

  const environmentOutput = run("npx", ["vercel", "env", "list", "--format", "json", "--scope", VERCEL_SCOPE]);
  const environmentJsonStart = environmentOutput.indexOf("{");
  const environmentVariables = JSON.parse(environmentOutput.slice(environmentJsonStart)).envs ?? [];
  const environmentReadiness = assessSupabaseEnvironmentReadiness(environmentVariables);
  for (const missing of environmentReadiness.missing) {
    fail(`Vercel ${missing.environment} is missing ${missing.requirement}`);
  }
}

async function checkProductionReadiness() {
  let response;
  try {
    response = await fetch(`${PRODUCTION_URL}/api/v1/readiness`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    fail(`production readiness endpoint is unreachable (${error instanceof Error ? error.name : "request error"})`);
    return;
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    fail("production readiness endpoint did not return JSON");
    return;
  }

  const result = assessReadinessResponse(response.status, body);
  if (!result.ready) fail(result.reason);
}

try {
  checkGitHub();
  checkVercel();
  await checkProductionReadiness();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("Ops readiness checks passed.");
