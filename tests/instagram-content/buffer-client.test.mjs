import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createInstagramBufferDraft,
  createInstagramBufferScheduledPost,
  listBufferChannels,
  loadBufferEnv,
  parseImageUrls,
  readBufferDraftPackage,
} from "../../scripts/instagram-content/buffer-client.mjs";

async function makeTempDirectory() {
  return mkdtemp(join(tmpdir(), "doripe-buffer-client-"));
}

function makeFetch(responses, calls = []) {
  return async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    const next = responses.shift();
    assert.ok(next, "Unexpected fetch call");
    return {
      ok: next.ok ?? true,
      status: next.status ?? 200,
      async json() {
        return next.body;
      },
    };
  };
}

test("loads Buffer env values without printing secrets", async () => {
  const directory = await makeTempDirectory();
  const envPath = join(directory, ".env.local");
  await writeFile(envPath, "BUFFER_ACCESS_TOKEN='secret-token'\nBUFFER_INSTAGRAM_CHANNEL_ID=channel-1\n", "utf8");

  const env = await loadBufferEnv({ envPath });

  assert.deepEqual(env, {
    accessToken: "secret-token",
    channelId: "channel-1",
  });
});

test("lists Buffer channels across organizations", async () => {
  const calls = [];
  const fetchImpl = makeFetch([
    {
      body: {
        data: {
          account: {
            organizations: [{ id: "org-1" }],
          },
        },
      },
    },
    {
      body: {
        data: {
          channels: [
            {
              id: "channel-1",
              name: "doripe",
              displayName: "doripe.official",
              service: "instagram",
              isQueuePaused: false,
            },
          ],
        },
      },
    },
  ], calls);

  const channels = await listBufferChannels({
    accessToken: "secret-token",
    fetchImpl,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers.Authorization, "Bearer secret-token");
  assert.deepEqual(channels.map((channel) => channel.id), ["channel-1"]);
});

test("reads package caption and requires one image URL per PNG", async () => {
  const directory = await makeTempDirectory();
  const packageDirectory = join(directory, "package");
  await mkdir(packageDirectory);
  await writeFile(join(packageDirectory, "caption.txt"), "성수에서 걷는 오후\n", "utf8");
  await writeFile(join(packageDirectory, "manifest.json"), `${JSON.stringify({
    version: 1,
    candidateId: "seongsu-route",
    createdAt: "2026-07-15T00:00:00.000Z",
    files: ["01-cover.png", "02-content.png", "caption.txt", "sources.txt", "review.txt", "manifest.json"],
  }, null, 2)}\n`, "utf8");
  const imageUrlsPath = join(directory, "image-urls.json");
  await writeFile(imageUrlsPath, `${JSON.stringify([
    "https://cdn.example.com/01-cover.png",
    "https://cdn.example.com/02-content.png",
  ], null, 2)}\n`, "utf8");

  const draftPackage = await readBufferDraftPackage(packageDirectory, imageUrlsPath);

  assert.equal(draftPackage.candidateId, "seongsu-route");
  assert.equal(draftPackage.caption, "성수에서 걷는 오후");
  assert.deepEqual(draftPackage.pngFiles, ["01-cover.png", "02-content.png"]);
});

test("rejects non-https image URLs", () => {
  assert.throws(
    () => parseImageUrls(["http://cdn.example.com/01.png"]),
    /https URL/i,
  );
});

test("creates a multi-image Instagram post draft in Buffer", async () => {
  const calls = [];
  const fetchImpl = makeFetch([
    {
      body: {
        data: {
          createPost: {
            __typename: "PostActionSuccess",
            post: {
              id: "post-1",
              status: "draft",
              text: "caption",
              channelId: "channel-1",
              channelService: "instagram",
              shareMode: "addToQueue",
            },
          },
        },
      },
    },
  ], calls);

  const post = await createInstagramBufferDraft({
    accessToken: "secret-token",
    channelId: "channel-1",
    caption: "caption",
    imageUrls: [
      "https://cdn.example.com/01-cover.png",
      "https://cdn.example.com/02-content.png",
    ],
    fetchImpl,
  });

  assert.equal(post.id, "post-1");
  const input = calls[0].body.variables.input;
  assert.equal(input.saveToDraft, true);
  assert.equal(input.metadata.instagram.type, "post");
  assert.equal(input.metadata.instagram.shouldShareToFeed, true);
  assert.equal(input.mode, "addToQueue");
  assert.deepEqual(input.assets, [
    { image: { url: "https://cdn.example.com/01-cover.png" } },
    { image: { url: "https://cdn.example.com/02-content.png" } },
  ]);
});

test("creates a custom scheduled Instagram post in Buffer", async () => {
  const calls = [];
  const fetchImpl = makeFetch([
    {
      body: {
        data: {
          createPost: {
            __typename: "PostActionSuccess",
            post: {
              id: "post-2",
              status: "scheduled",
              dueAt: "2026-07-15T06:00:00.000Z",
              text: "caption",
              channelId: "channel-1",
              channelService: "instagram",
              shareMode: "customScheduled",
            },
          },
        },
      },
    },
  ], calls);

  const post = await createInstagramBufferScheduledPost({
    accessToken: "secret-token",
    channelId: "channel-1",
    caption: "caption",
    imageUrls: ["https://cdn.example.com/01-cover.png"],
    dueAt: "2026-07-15T06:00:00.000Z",
    fetchImpl,
  });

  assert.equal(post.id, "post-2");
  const input = calls[0].body.variables.input;
  assert.equal(input.saveToDraft, false);
  assert.equal(input.mode, "customScheduled");
  assert.equal(input.dueAt, "2026-07-15T06:00:00.000Z");
  assert.equal(input.metadata.instagram.type, "post");
});
