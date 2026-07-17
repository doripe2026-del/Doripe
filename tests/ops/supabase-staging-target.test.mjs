import assert from "node:assert/strict";
import test from "node:test";
import {
  checkSupabaseStagingTarget,
  PRODUCTION_SUPABASE_PROJECT_ID,
  STAGING_CONFIRMATION,
} from "../../scripts/lib/supabase-staging-target.mjs";

const validInput = {
  projectId: "abcdefghijklmnopqrst",
  projectUrl: "https://abcdefghijklmnopqrst.supabase.co",
  confirmation: STAGING_CONFIRMATION,
};

test("accepts an explicitly confirmed project that is separate from production", () => {
  const result = checkSupabaseStagingTarget(validInput);
  assert.equal(result.safe, true);
  assert.deepEqual(result.errors, []);
});

test("fails closed when the staging target is missing", () => {
  const result = checkSupabaseStagingTarget();
  assert.equal(result.safe, false);
  assert.ok(result.errors.some((error) => error.includes("PROJECT_ID")));
  assert.ok(result.errors.some((error) => error.includes("SUPABASE_URL")));
  assert.ok(result.errors.some((error) => error.includes("CONFIRMATION")));
});

test("rejects the production project even with explicit confirmation", () => {
  const result = checkSupabaseStagingTarget({
    projectId: PRODUCTION_SUPABASE_PROJECT_ID,
    projectUrl: `https://${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`,
    confirmation: STAGING_CONFIRMATION,
  });
  assert.equal(result.safe, false);
  assert.ok(result.errors.some((error) => error.includes("production Supabase project")));
});

test("rejects the legacy project", () => {
  const projectId = "qfvirakzxtcgoerrqumh";
  const result = checkSupabaseStagingTarget({
    projectId,
    projectUrl: `https://${projectId}.supabase.co`,
    confirmation: STAGING_CONFIRMATION,
  });
  assert.equal(result.safe, false);
  assert.ok(result.errors.some((error) => error.includes("legacy Supabase project")));
});

test("rejects a URL that points at a different project", () => {
  const result = checkSupabaseStagingTarget({
    ...validInput,
    projectUrl: "https://zyxwvutsrqponmlkjihg.supabase.co",
  });
  assert.equal(result.safe, false);
  assert.ok(result.errors.some((error) => error.includes("does not match")));
});

test("rejects an accidental or missing confirmation", () => {
  const result = checkSupabaseStagingTarget({ ...validInput, confirmation: "yes" });
  assert.equal(result.safe, false);
  assert.ok(result.errors.some((error) => error.includes(STAGING_CONFIRMATION)));
});
