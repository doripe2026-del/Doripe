export const PRODUCTION_SUPABASE_PROJECT_ID = "dcyjrsxnpujslbxtitqj";
export const LEGACY_SUPABASE_PROJECT_IDS = ["qfvirakzxtcgoerrqumh"];
export const STAGING_CONFIRMATION = "I_UNDERSTAND_STAGING_ONLY";

const projectRefPattern = /^[a-z0-9]{20}$/;

export function checkSupabaseStagingTarget({
  projectId,
  projectUrl,
  confirmation,
  productionProjectId = PRODUCTION_SUPABASE_PROJECT_ID,
  legacyProjectIds = LEGACY_SUPABASE_PROJECT_IDS,
} = {}) {
  const errors = [];
  const normalizedId = projectId?.trim() ?? "";
  const normalizedUrl = projectUrl?.trim().replace(/\/$/, "") ?? "";

  if (!normalizedId) {
    errors.push("DORIPE_STAGING_SUPABASE_PROJECT_ID is required");
  } else if (!projectRefPattern.test(normalizedId)) {
    errors.push("staging project ID must be a 20-character lowercase Supabase project ref");
  }

  if (normalizedId === productionProjectId) {
    errors.push("production Supabase project is forbidden as a staging target");
  }

  if (legacyProjectIds.includes(normalizedId)) {
    errors.push("legacy Supabase project is forbidden as a staging target");
  }

  if (!normalizedUrl) {
    errors.push("DORIPE_STAGING_SUPABASE_URL is required");
  } else if (normalizedId && normalizedUrl !== `https://${normalizedId}.supabase.co`) {
    errors.push("staging URL does not match the staging project ID");
  }

  if (confirmation !== STAGING_CONFIRMATION) {
    errors.push(`DORIPE_STAGING_CONFIRMATION must equal ${STAGING_CONFIRMATION}`);
  }

  return {
    safe: errors.length === 0,
    errors,
    projectId: normalizedId,
    projectUrl: normalizedUrl,
    productionProjectId,
  };
}
