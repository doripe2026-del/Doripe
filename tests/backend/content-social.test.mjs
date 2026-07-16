import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function importTypescript(entry) {
  const output = await mkdtemp(path.join(os.tmpdir(), "doripe-domain-test-"));
  const outfile = path.join(output, "module.mjs");
  await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile });
  return {
    module: await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`),
    cleanup: () => rm(output, { recursive: true, force: true }),
  };
}

test("content contracts reject unknown fields and mismatched course targets", async () => {
  const loaded = await importTypescript("src/backend/domains/contents.ts");
  try {
    assert.equal(loaded.module.contentCreateSchema.safeParse({
      type: "place",
      caption: "test",
      placeIds: ["place-1"],
      unexpected: true,
    }).success, false);
    assert.equal(loaded.module.contentCreateSchema.safeParse({
      type: "course",
      caption: "test",
      placeIds: ["place-1"],
    }).success, false);
    assert.equal(loaded.module.contentCreateSchema.safeParse({
      type: "course",
      caption: "test",
      placeIds: ["place-1"],
      courseId: "00000000-0000-4000-8000-000000000001",
    }).success, true);
    assert.equal(loaded.module.contentUpdateSchema.safeParse({
      expectedVersion: 1,
      mediaIds: ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000001"],
    }).success, false);
  } finally {
    await loaded.cleanup();
  }
});

test("social and support bodies are strict and bounded", async () => {
  const [social, support] = await Promise.all([
    importTypescript("src/backend/domains/social.ts"),
    importTypescript("src/backend/domains/support.ts"),
  ]);
  try {
    assert.equal(social.module.commentCreateSchema.safeParse({ text: "  " }).success, false);
    assert.equal(social.module.commentUpdateSchema.safeParse({ text: "ok", expectedVersion: 0 }).success, false);
    assert.equal(support.module.inquiryCreateSchema.safeParse({ category: "bug", text: "help", email: "pii@example.com" }).success, false);
    assert.equal(support.module.reportCreateSchema.safeParse({ targetType: "content", targetId: "x", reasonCode: "unsafe" }).success, true);
    assert.equal(support.module.reportCreateSchema.safeParse({ targetType: "content", targetId: "x", reasonCode: "unknown" }).success, false);
  } finally {
    await Promise.all([social.cleanup(), support.cleanup()]);
  }
});

test("media filenames are normalized to an owner-safe storage leaf", async () => {
  const loaded = await importTypescript("src/backend/domains/media.ts");
  try {
    assert.equal(loaded.module.safeUploadFileName("../../서울 사진.JPG", "image/jpeg"), "image.jpg");
    assert.equal(loaded.module.safeUploadFileName("my photo.png", "image/png"), "my-photo.png");
    assert.match(loaded.module.safeUploadFileName("***", "image/webp"), /^[A-Za-z0-9_-]+\.webp$/);
    assert.equal(loaded.module.mediaUploadSchema.safeParse({
      kind: "image",
      mimeType: "image/jpeg",
      fileName: "a.jpg",
      byteSize: 10,
      checksumSha256: "a".repeat(64),
      secret: "no",
    }).success, false);
  } finally {
    await loaded.cleanup();
  }
});

test("content/social migrations keep media private and mutations atomic", async () => {
  const foundation = await readFile("supabase/migrations/20260714092000_content_social_support_media_foundation.sql", "utf8");
  const security = await readFile("supabase/migrations/20260714092100_content_social_support_media_rls_rpc.sql", "utf8");
  const backfill = await readFile("supabase/migrations/20260714092050_place_region_backfill.sql", "utf8");
  for (const table of ["contents", "content_likes", "comments", "profile_follows", "media_assets", "inquiries", "reports"]) {
    assert.match(foundation, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(security, /create trigger content_likes_adjust_count/i);
  assert.match(security, /create trigger comments_adjust_count/i);
  assert.match(security, /create trigger profile_follows_adjust_count/i);
  assert.match(security, /create or replace function public\.complete_media_upload/i);
  assert.match(security, /from storage\.objects/i);
  assert.match(backfill, /having count\(distinct decks\.region_id\) = 1/i);
  assert.doesNotMatch(foundation, /storage\.buckets[\s\S]*public\s*=\s*true/i);
});

test("comment likes have routes, handlers, counters, and user-owned RLS", async () => {
  const [routes, migration] = await Promise.all([
    readFile("src/backend/routes.ts", "utf8"),
    readFile("supabase/migrations/20260714101100_comment_likes.sql", "utf8"),
  ]);
  const loaded = await importTypescript("src/backend/domains/social.ts");
  try {
    assert.equal(typeof loaded.module.likeComment, "function");
    assert.equal(typeof loaded.module.unlikeComment, "function");
    assert.match(routes, /operationId: "likeComment"/);
    assert.match(routes, /operationId: "unlikeComment"/);
    assert.match(migration, /create table public\.comment_likes/i);
    assert.match(migration, /alter table public\.comments[\s\S]+like_count/i);
    assert.match(migration, /auth\.uid\(\) = user_id/i);
    assert.match(migration, /comment_likes_insert_own_visible[\s\S]+doripe_account_is_active/i);
    assert.match(migration, /function public\.doripe_adjust_comment_like_count\(\)[\s\S]+security definer/i);
    assert.match(migration, /comment_likes_adjust_count/i);
  } finally {
    await loaded.cleanup();
  }
});
