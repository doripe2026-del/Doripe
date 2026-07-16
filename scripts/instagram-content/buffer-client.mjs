import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parsePackageManifest } from "./contracts.mjs";

const BUFFER_GRAPHQL_ENDPOINT = "https://api.buffer.com";
const INSTAGRAM_SERVICE = "instagram";

function parseEnvText(text) {
  const values = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith("\"") && value.endsWith("\""))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(match[1], value);
  }
  return values;
}

export async function loadBufferEnv(options = {}) {
  const envPath = resolve(options.envPath ?? ".env.local");
  let fileValues = new Map();
  try {
    fileValues = parseEnvText(await readFile(envPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  return {
    accessToken:
      options.accessToken
      ?? process.env.BUFFER_ACCESS_TOKEN
      ?? fileValues.get("BUFFER_ACCESS_TOKEN")
      ?? "",
    channelId:
      options.channelId
      ?? process.env.BUFFER_INSTAGRAM_CHANNEL_ID
      ?? fileValues.get("BUFFER_INSTAGRAM_CHANNEL_ID")
      ?? "",
  };
}

async function bufferGraphql({ accessToken, query, variables = {}, fetchImpl = globalThis.fetch }) {
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    throw new Error("BUFFER_ACCESS_TOKEN is required");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required");
  }

  const response = await fetchImpl(BUFFER_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Buffer API request failed with HTTP ${response.status}`);
  }
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    throw new Error(`Buffer API error: ${payload.errors.map((error) => error.message).join("; ")}`);
  }
  return payload.data;
}

export async function listBufferChannels(options) {
  const organizationData = await bufferGraphql({
    ...options,
    query: `
      query GetOrganizations {
        account {
          organizations {
            id
          }
        }
      }
    `,
  });
  const organizations = organizationData.account.organizations;
  const channels = [];
  for (const organization of organizations) {
    const channelData = await bufferGraphql({
      ...options,
      query: `
        query GetChannels($organizationId: OrganizationId!) {
          channels(input: { organizationId: $organizationId }) {
            id
            name
            displayName
            service
            isQueuePaused
          }
        }
      `,
      variables: { organizationId: organization.id },
    });
    channels.push(...channelData.channels);
  }
  return channels;
}

export async function resolveInstagramChannelId(options) {
  if (options.channelId) return options.channelId;
  const channels = await listBufferChannels(options);
  const instagramChannels = channels.filter((channel) => channel.service === INSTAGRAM_SERVICE);
  if (instagramChannels.length === 0) {
    throw new Error("No Instagram channel is connected in Buffer");
  }
  if (instagramChannels.length > 1) {
    throw new Error("Multiple Instagram channels found; set BUFFER_INSTAGRAM_CHANNEL_ID");
  }
  return instagramChannels[0].id;
}

export function parseImageUrls(value) {
  if (!Array.isArray(value)) throw new Error("Image URLs must be a JSON array");
  return value.map((url, index) => {
    if (typeof url !== "string" || !/^https:\/\//.test(url)) {
      throw new Error(`Image URL ${index + 1} must be an https URL`);
    }
    return url;
  });
}

export async function readBufferDraftPackage(packageDir, imageUrlsPath) {
  const directory = resolve(packageDir);
  const manifest = parsePackageManifest(JSON.parse(
    await readFile(join(directory, "manifest.json"), "utf8"),
  ));
  const caption = (await readFile(join(directory, "caption.txt"), "utf8")).trim();
  const pngFiles = manifest.files.filter((file) => file.endsWith(".png"));
  const imageUrls = parseImageUrls(JSON.parse(await readFile(imageUrlsPath, "utf8")));

  if (imageUrls.length !== pngFiles.length) {
    throw new Error(`Image URL count (${imageUrls.length}) must match PNG count (${pngFiles.length})`);
  }

  return {
    candidateId: manifest.candidateId,
    caption,
    imageUrls,
    pngFiles,
  };
}

export async function createInstagramBufferDraft(options) {
  return createInstagramBufferPost({
    ...options,
    saveToDraft: true,
  });
}

export async function createInstagramBufferScheduledPost(options) {
  if (typeof options.dueAt !== "string" || !Number.isFinite(Date.parse(options.dueAt))) {
    throw new Error("A valid dueAt ISO date is required");
  }
  return createInstagramBufferPost({
    ...options,
    saveToDraft: false,
  });
}

async function createInstagramBufferPost(options) {
  const channelId = await resolveInstagramChannelId(options);
  const data = await bufferGraphql({
    ...options,
    query: `
      mutation CreateInstagramDraft($input: CreatePostInput!) {
        createPost(input: $input) {
          __typename
          ... on PostActionSuccess {
            post {
              id
              status
              dueAt
              text
              channelId
              channelService
              shareMode
            }
          }
          ... on InvalidInputError {
            message
          }
          ... on UnauthorizedError {
            message
          }
          ... on UnexpectedError {
            message
          }
          ... on RestProxyError {
            message
          }
          ... on LimitReachedError {
            message
          }
          ... on NotFoundError {
            message
          }
        }
      }
    `,
    variables: {
      input: {
        channelId,
        schedulingType: "automatic",
        dueAt: options.dueAt ?? null,
        text: options.caption,
        metadata: {
          instagram: {
            type: "post",
            shouldShareToFeed: true,
            isAiGenerated: false,
          },
        },
        assets: options.imageUrls.map((url) => ({ image: { url } })),
        mode: options.dueAt ? "customScheduled" : "addToQueue",
        source: "doripe-instagram-content",
        aiAssisted: true,
        saveToDraft: options.saveToDraft,
      },
    },
  });
  const result = data.createPost;
  if (result.__typename !== "PostActionSuccess") {
    throw new Error(`Buffer draft creation failed: ${result.message ?? result.__typename}`);
  }
  return result.post;
}
