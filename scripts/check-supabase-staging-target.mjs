import { checkSupabaseStagingTarget } from "./lib/supabase-staging-target.mjs";

const result = checkSupabaseStagingTarget({
  projectId: process.env.DORIPE_STAGING_SUPABASE_PROJECT_ID,
  projectUrl: process.env.DORIPE_STAGING_SUPABASE_URL,
  confirmation: process.env.DORIPE_STAGING_CONFIRMATION,
});

if (!result.safe) {
  for (const error of result.errors) console.error(`Supabase staging guard failed: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Supabase staging target ${result.projectId} is separate from production.`);
  console.log("This check does not authorize a migration or production change.");
}
