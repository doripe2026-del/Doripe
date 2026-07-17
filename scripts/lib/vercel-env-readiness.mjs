const DEPLOYMENT_ENVIRONMENTS = ["production", "preview", "development"];

const SUPABASE_REQUIREMENTS = [
  {
    label: "Supabase URL",
    keys: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"],
  },
  {
    label: "publishable key",
    keys: [
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_ANON_KEY",
    ],
  },
  {
    label: "service role key",
    keys: ["SUPABASE_SERVICE_ROLE_KEY"],
  },
];

function targetsFor(variable) {
  if (Array.isArray(variable?.target)) return variable.target;
  return variable?.target ? [variable.target] : [];
}

function hasUsableValue(variable) {
  if (!Object.hasOwn(variable ?? {}, "value")) return true;
  return typeof variable.value === "string" && variable.value.trim().length > 0;
}

export function assessSupabaseEnvironmentReadiness(variables) {
  const available = new Map(DEPLOYMENT_ENVIRONMENTS.map((environment) => [environment, new Set()]));

  for (const variable of variables ?? []) {
    if (!variable?.key || !hasUsableValue(variable)) continue;
    for (const target of targetsFor(variable)) {
      available.get(target)?.add(variable.key);
    }
  }

  const missing = [];
  for (const environment of DEPLOYMENT_ENVIRONMENTS) {
    const keys = available.get(environment);
    for (const requirement of SUPABASE_REQUIREMENTS) {
      if (!requirement.keys.some((key) => keys.has(key))) {
        missing.push({ environment, requirement: requirement.label });
      }
    }
  }

  return { ready: missing.length === 0, missing };
}

export function assessReadinessResponse(status, body) {
  if (status !== 200) {
    return { ready: false, reason: `readiness endpoint returned HTTP ${status}` };
  }
  if (body?.data?.ready !== true) {
    return { ready: false, reason: "readiness endpoint reported degraded dependencies" };
  }
  return { ready: true, reason: null };
}
