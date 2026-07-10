import test from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
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
