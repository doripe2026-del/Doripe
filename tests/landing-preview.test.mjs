import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLandingPreviewServer } from "../scripts/serve-landing.mjs";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address()));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function rawGet(port, path) {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path }, (response) => {
      response.resume();
      response.on("end", () => resolve(response));
    });
    req.on("error", reject);
    req.end();
  });
}

function rawRequest(port, requestTarget) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    let response = "";
    socket.setEncoding("utf8");
    socket.on("connect", () => {
      socket.end(`GET ${requestTarget} HTTP/1.1\r\nHost: landing.local\r\nConnection: close\r\n\r\n`);
    });
    socket.on("data", (chunk) => {
      response += chunk;
    });
    socket.on("end", () => resolve(response));
    socket.on("error", reject);
  });
}

test("landing preview serves the page and motion assets without exposing repository files", async () => {
  const server = createLandingPreviewServer();
  const address = await listen(server);

  try {
    const root = await fetch(`http://127.0.0.1:${address.port}/`);
    assert.equal(root.status, 200);
    assert.match(root.headers.get("content-type"), /^text\/html/);
    assert.match(await root.text(), /id="landingMotionHero"/);

    const stylesheet = await fetch(`http://127.0.0.1:${address.port}/home/landing-motion.css`);
    assert.equal(stylesheet.status, 200);
    assert.match(stylesheet.headers.get("content-type"), /^text\/css/);

    const count = await fetch(`http://127.0.0.1:${address.port}/api/count`);
    assert.equal(count.status, 200);
    assert.deepEqual(await count.json(), { count: 10000 });

    const tracking = await fetch(`http://127.0.0.1:${address.port}/api/track`, { method: "POST" });
    assert.equal(tracking.status, 204);

    const traversal = await rawGet(address.port, "/%2e%2e/package.json");
    assert.equal(traversal.statusCode, 404);
  } finally {
    await close(server);
  }
});

test("landing preview rejects symlinks that escape the public root", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "doripe-preview-"));
  const publicRoot = join(fixtureRoot, "public");
  const externalRoot = join(fixtureRoot, "private");
  const externalFile = join(externalRoot, "secret.txt");
  await mkdir(join(publicRoot, "home"), { recursive: true });
  await mkdir(externalRoot, { recursive: true });
  await writeFile(join(publicRoot, "home", "index.html"), "landing");
  await writeFile(externalFile, "must stay private");
  await symlink(externalFile, join(publicRoot, "escaped.txt"));

  const server = createLandingPreviewServer({ publicRoot });
  const address = await listen(server);
  try {
    const escaped = await fetch(`http://127.0.0.1:${address.port}/escaped.txt`);
    assert.equal(escaped.status, 403);
    assert.doesNotMatch(await escaped.text(), /must stay private/);

    const root = await fetch(`http://127.0.0.1:${address.port}/`);
    assert.equal(root.status, 200);
    assert.equal(await root.text(), "landing");
  } finally {
    await close(server);
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("landing preview returns 400 for a malformed absolute target and keeps serving", async () => {
  const server = createLandingPreviewServer();
  const address = await listen(server);

  try {
    const malformed = await rawRequest(address.port, "http://[invalid");
    assert.match(malformed, /^HTTP\/1\.1 400 /);

    const valid = await fetch(`http://127.0.0.1:${address.port}/`);
    assert.equal(valid.status, 200);
    assert.match(await valid.text(), /id="landingMotionHero"/);
  } finally {
    await close(server);
  }
});
