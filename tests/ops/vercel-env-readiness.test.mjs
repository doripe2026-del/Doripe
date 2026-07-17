import assert from "node:assert/strict";
import test from "node:test";

import {
  assessSupabaseEnvironmentReadiness,
  assessReadinessResponse,
} from "../../scripts/lib/vercel-env-readiness.mjs";

const environments = ["production", "preview", "development"];

function completeEnvironmentVariables() {
  return environments.flatMap((target) => [
    { key: "NEXT_PUBLIC_SUPABASE_URL", target: [target] },
    { key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", target: [target] },
    { key: "SUPABASE_SERVICE_ROLE_KEY", target: [target] },
  ]);
}

test("all deployment environments pass with the required Supabase variables", () => {
  const result = assessSupabaseEnvironmentReadiness(completeEnvironmentVariables());

  assert.equal(result.ready, true);
  assert.deepEqual(result.missing, []);
});

test("production fails when its publishable key is missing", () => {
  const variables = completeEnvironmentVariables().filter((variable) => !(
    variable.key === "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    && variable.target.includes("production")
  ));

  const result = assessSupabaseEnvironmentReadiness(variables);

  assert.equal(result.ready, false);
  assert.deepEqual(result.missing, [{ environment: "production", requirement: "publishable key" }]);
});

test("development fails when all Supabase variables are missing", () => {
  const variables = completeEnvironmentVariables().filter((variable) => !variable.target.includes("development"));

  const result = assessSupabaseEnvironmentReadiness(variables);

  assert.deepEqual(result.missing, [
    { environment: "development", requirement: "Supabase URL" },
    { environment: "development", requirement: "publishable key" },
    { environment: "development", requirement: "service role key" },
  ]);
});

test("compatible server and legacy public variable names are accepted", () => {
  const variables = environments.flatMap((target) => [
    { key: "SUPABASE_URL", target },
    { key: "SUPABASE_ANON_KEY", target },
    { key: "SUPABASE_SERVICE_ROLE_KEY", target },
  ]);

  assert.equal(assessSupabaseEnvironmentReadiness(variables).ready, true);
});

test("failure messages never expose environment variable values", () => {
  const secret = "service-role-secret-that-must-not-appear";
  const result = assessSupabaseEnvironmentReadiness([
    { key: "NEXT_PUBLIC_SUPABASE_URL", target: ["production"], value: secret },
  ]);

  assert.equal(JSON.stringify(result).includes(secret), false);
});

test("blank values are treated as missing when the provider returns values", () => {
  const variables = completeEnvironmentVariables().map((variable) => ({
    ...variable,
    value: variable.key === "SUPABASE_SERVICE_ROLE_KEY" ? "   " : "configured",
  }));

  const result = assessSupabaseEnvironmentReadiness(variables);

  assert.deepEqual(result.missing, environments.map((environment) => ({
    environment,
    requirement: "service role key",
  })));
});

test("production readiness requires HTTP 200 and ready true", () => {
  assert.deepEqual(assessReadinessResponse(200, { data: { ready: true } }), { ready: true, reason: null });
  assert.deepEqual(assessReadinessResponse(503, { data: { ready: false } }), {
    ready: false,
    reason: "readiness endpoint returned HTTP 503",
  });
  assert.deepEqual(assessReadinessResponse(200, { data: { ready: false } }), {
    ready: false,
    reason: "readiness endpoint reported degraded dependencies",
  });
});
