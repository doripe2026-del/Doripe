import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function importTypescript(entry) {
  const output = await mkdtemp(path.join(os.tmpdir(), "doripe-env-test-"));
  const outfile = path.join(output, "module.mjs");
  try {
    await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile });
    return {
      module: await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`),
      cleanup: () => rm(output, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(output, { recursive: true, force: true });
    throw error;
  }
}

function preserveEnvironment() {
  const original = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
  };

  return () => {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}

test("admin and notify clients accept the server-only Supabase URL alias", async () => {
  const restore = preserveEnvironment();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.SUPABASE_URL = "https://demo-project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";

  let admin;
  let notify;
  try {
    admin = await importTypescript("src/admin-server/supabaseAdmin.ts");
    notify = await importTypescript("src/notify/notify-taste.ts");
    assert.equal(admin.module.createSupabaseAdminClient().supabaseUrl, process.env.SUPABASE_URL);
    assert.equal(notify.module.createNotifySupabaseClient().supabaseUrl, process.env.SUPABASE_URL);
  } finally {
    await admin?.cleanup();
    await notify?.cleanup();
    restore();
  }
});

test("server clients prefer the server-only URL when both aliases are configured", async () => {
  const restore = preserveEnvironment();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://legacy-project.supabase.co";
  process.env.SUPABASE_URL = "https://server-project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";

  let admin;
  let notify;
  try {
    admin = await importTypescript("src/admin-server/supabaseAdmin.ts");
    notify = await importTypescript("src/notify/notify-taste.ts");
    assert.equal(admin.module.createSupabaseAdminClient().supabaseUrl, process.env.SUPABASE_URL);
    assert.equal(notify.module.createNotifySupabaseClient().supabaseUrl, process.env.SUPABASE_URL);
  } finally {
    await admin?.cleanup();
    await notify?.cleanup();
    restore();
  }
});

test("missing Supabase URL errors list both supported variable names without values", async () => {
  const restore = preserveEnvironment();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret-must-not-appear";

  let admin;
  try {
    admin = await importTypescript("src/admin-server/supabaseAdmin.ts");
    assert.throws(
      () => admin.module.createSupabaseAdminClient(),
      (error) => {
        assert.equal(error.message.includes("SUPABASE_URL"), true);
        assert.equal(error.message.includes("NEXT_PUBLIC_SUPABASE_URL"), true);
        assert.equal(error.message.includes(process.env.SUPABASE_SERVICE_ROLE_KEY), false);
        return true;
      },
    );
  } finally {
    await admin?.cleanup();
    restore();
  }
});
