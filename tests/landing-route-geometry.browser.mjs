import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import { createServer as createTcpServer } from "node:net";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { constants } from "node:fs";
import { createLandingPreviewServer } from "../scripts/serve-landing.mjs";

const TOLERANCE_PX = 8;
const VIEWPORTS = [1440, 520, 390, 320];
const CASES = [
  {
    sceneId: "landingMotionHero",
    markerSelector: ".motion-navigation .navigation-marker-icon",
    pathSelector: ".hero-route-line path",
    times: [7120, 7280, 7440, 7600, 7760],
  },
  {
    sceneId: "motionSceneCourse",
    markerSelector: ".navigation-handoff .navigation-marker-icon",
    pathSelector: ".route-line path",
    times: [6052, 6188, 6324, 6460, 6596],
  },
];

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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

async function freePort() {
  const server = createTcpServer();
  const address = await listen(server);
  await close(server);
  return address.port;
}

async function isExecutable(path) {
  if (!path) return false;
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findCachedChromium(root) {
  const queue = [root];
  while (queue.length) {
    const directory = queue.shift();
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        queue.push(path);
        continue;
      }
      if (["chrome-headless-shell", "Google Chrome for Testing"].includes(entry.name)
        && await isExecutable(path)) return path;
    }
  }
  return null;
}

async function chromiumExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const candidate of candidates) {
    if (await isExecutable(candidate)) return candidate;
  }
  return findCachedChromium(join(homedir(), "Library", "Caches", "ms-playwright"));
}

async function waitForDebugger(port, browser) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (browser.exitCode !== null) throw new Error(`Chromium exited with ${browser.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) return response.json();
    } catch {
      // Chromium has not opened its debugger socket yet.
    }
    await sleep(100);
  }
  throw new Error("Timed out waiting for Chromium remote debugging");
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? []) listener(message.params);
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  waitFor(method, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const listener = (params) => {
        clearTimeout(timer);
        this.listeners.get(method)?.delete(listener);
        resolve(params);
      };
      const timer = setTimeout(() => {
        this.listeners.get(method)?.delete(listener);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeout);
      if (!this.listeners.has(method)) this.listeners.set(method, new Set());
      this.listeners.get(method).add(listener);
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result.value;
}

async function navigate(client, url) {
  const loaded = client.waitFor("Page.loadEventFired");
  await client.send("Page.navigate", { url });
  await loaded;
}

async function sampleDistance(client, testCase, time) {
  await evaluate(client, `(() => {
    const scene = document.getElementById(${JSON.stringify(testCase.sceneId)});
    scene.scrollIntoView({ block: "center", behavior: "instant" });
    scene.dataset.motionState = "playing";
  })()`);
  await sleep(80);
  return evaluate(client, `(() => {
    const scene = document.getElementById(${JSON.stringify(testCase.sceneId)});
    for (const animation of scene.getAnimations({ subtree: true })) {
      animation.pause();
      animation.currentTime = ${time};
    }
    const marker = scene.querySelector(${JSON.stringify(testCase.markerSelector)});
    const path = scene.querySelector(${JSON.stringify(testCase.pathSelector)});
    if (!marker || !path) return { missing: { marker: !marker, path: !path } };

    const markerBox = marker.getBoundingClientRect();
    const label = marker.parentElement.querySelector("strong");
    const labelBox = label?.getBoundingClientRect();
    const labelStyle = label ? getComputedStyle(label) : null;
    const markerCenter = {
      x: markerBox.left + markerBox.width / 2,
      y: markerBox.top + markerBox.height / 2,
    };
    const matrix = path.getScreenCTM();
    const length = path.getTotalLength();
    let nearest = { distance: Infinity, x: 0, y: 0 };
    for (let index = 0; index <= 1200; index += 1) {
      const point = path.getPointAtLength(length * index / 1200);
      const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(matrix);
      const distance = Math.hypot(screenPoint.x - markerCenter.x, screenPoint.y - markerCenter.y);
      if (distance < nearest.distance) nearest = { distance, x: screenPoint.x, y: screenPoint.y };
    }
    return {
      distance: Math.round(nearest.distance * 100) / 100,
      marker: {
        x: Math.round(markerCenter.x * 100) / 100,
        y: Math.round(markerCenter.y * 100) / 100,
        left: Math.round(markerBox.left * 100) / 100,
        right: Math.round(markerBox.right * 100) / 100,
      },
      nearest: {
        x: Math.round(nearest.x * 100) / 100,
        y: Math.round(nearest.y * 100) / 100,
      },
      opacity: Number(getComputedStyle(marker.parentElement).opacity),
      viewportWidth: innerWidth,
      label: labelStyle?.display === "none" ? null : {
        left: Math.round(labelBox.left * 100) / 100,
        right: Math.round(labelBox.right * 100) / 100,
      },
    };
  })()`);
}

async function sampleHeroRouteDraw(client, time) {
  await evaluate(client, `(() => {
    const scene = document.getElementById("landingMotionHero");
    scene.scrollIntoView({ block: "center", behavior: "instant" });
    scene.dataset.motionState = "playing";
    for (const animation of scene.getAnimations({ subtree: true })) {
      animation.pause();
      animation.currentTime = ${time};
    }
  })()`);
  return evaluate(client, `(() => {
    const path = document.querySelector("#landingMotionHero .hero-route-line path");
    const line = path.closest("svg");
    return {
      time: ${time},
      strokeDashoffset: Math.round(Number.parseFloat(getComputedStyle(path).strokeDashoffset) * 100) / 100,
      opacity: Math.round(Number(getComputedStyle(line).opacity) * 100) / 100,
    };
  })()`);
}

const executable = await chromiumExecutable();
assert.ok(executable, "Set CHROME_PATH or install Chromium to run route geometry regression");
const preview = createLandingPreviewServer();
const previewAddress = await listen(preview);
const debugPort = await freePort();
const userDataDir = await mkdtemp(join(tmpdir(), "doripe-route-geometry-"));
const browser = spawn(executable, [
  "--headless",
  "--no-sandbox",
  "--disable-gpu",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${userDataDir}`,
  "about:blank",
], { stdio: "ignore" });

let client;
try {
  const targets = await waitForDebugger(debugPort, browser);
  const page = targets.find((target) => target.type === "page");
  assert.ok(page, "Chromium page target missing");
  client = new CdpClient(page.webSocketDebuggerUrl);
  await Promise.all([client.send("Page.enable"), client.send("Runtime.enable")]);

  const measurements = [];
  let heroRouteDraw = [];
  for (const width of VIEWPORTS) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await navigate(client, `http://127.0.0.1:${previewAddress.port}/?route-geometry=${width}`);
    if (width === VIEWPORTS[0]) {
      for (const time of [4160, 4960, 5760]) {
        heroRouteDraw.push(await sampleHeroRouteDraw(client, time));
      }
      assert.ok(heroRouteDraw[0].strokeDashoffset >= 699);
      assert.ok(heroRouteDraw[1].strokeDashoffset > 0 && heroRouteDraw[1].strokeDashoffset < 700);
      assert.ok(heroRouteDraw[2].strokeDashoffset <= 1);
    }
    for (const testCase of CASES) {
      for (const time of testCase.times) {
        const sample = await sampleDistance(client, testCase, time);
        assert.ok(!sample.missing, `${testCase.sceneId} route or marker missing at ${width}px`);
        assert.ok(
          sample.distance <= TOLERANCE_PX,
          `${testCase.sceneId} marker is ${sample.distance}px from its route at ${width}px/${time}ms`,
        );
        assert.ok(sample.marker.left >= 0 && sample.marker.right <= sample.viewportWidth);
        if (sample.label) {
          assert.ok(sample.label.left >= 0 && sample.label.right <= sample.viewportWidth);
        }
        measurements.push({ width, scene: testCase.sceneId, time, ...sample });
      }
    }
  }

  console.log(JSON.stringify({
    browser: basename(executable),
    tolerancePx: TOLERANCE_PX,
    maxDistancePx: Math.max(...measurements.map((sample) => sample.distance)),
    heroRouteDraw,
    measurements,
  }, null, 2));
} finally {
  client?.close();
  browser.kill("SIGTERM");
  await close(preview);
  await rm(userDataDir, { recursive: true, force: true });
}
