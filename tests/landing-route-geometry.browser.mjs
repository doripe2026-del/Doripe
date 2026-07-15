import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { createServer as createTcpServer } from "node:net";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createLandingPreviewServer } from "../scripts/serve-landing.mjs";

const VIEWPORTS = [1440, 900, 480, 430, 390, 360, 320];
const SCENES = ["landingMotionHero", "motionSceneDiscovery", "motionSceneNearby", "motionSceneCourse"];
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address()));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
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
      if (entry.isDirectory()) queue.push(path);
      else if (["chrome-headless-shell", "Google Chrome for Testing"].includes(entry.name)
        && await isExecutable(path)) return path;
    }
  }
  return null;
}

async function chromiumExecutable() {
  for (const candidate of [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ]) {
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
      // Chrome is still opening the debugger socket.
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
        if (message.error) pending.reject(new Error(message.error.message));
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
      this.pending.set(id, { resolve, reject });
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
  const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}

async function navigate(client, url) {
  const loaded = client.waitFor("Page.loadEventFired");
  await client.send("Page.navigate", { url });
  await loaded;
}

const executable = await chromiumExecutable();
assert.ok(executable, "Set CHROME_PATH or install Chromium to run landing visual geometry checks");
const preview = createLandingPreviewServer();
const previewAddress = await listen(preview);
const debugPort = await freePort();
const userDataDir = await mkdtemp(join(tmpdir(), "doripe-landing-geometry-"));
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

  const reports = [];
  for (const width of VIEWPORTS) {
    await client.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width <= 480 });
    await navigate(client, `http://127.0.0.1:${previewAddress.port}/?visual-geometry=${width}`);
    await evaluate(client, `(async () => {
      for (const id of ${JSON.stringify(SCENES)}) {
        document.getElementById(id).scrollIntoView({ block: 'center', behavior: 'instant' });
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    })()`);
    await sleep(120);
    const report = await evaluate(client, `(() => {
      document.querySelectorAll('[data-motion-scene]').forEach((scene) => { scene.dataset.motionState = 'final'; });
      const round = (value) => Math.round(value * 100) / 100;
      const scenes = ${JSON.stringify(SCENES)}.map((id) => {
        const scene = document.getElementById(id);
        const box = scene.getBoundingClientRect();
        const named = [...scene.querySelectorAll('.hero-photo-expansion, .discovery-place-photo, .nearby-place-card, .nearby-course-tray, .folder-route-card, .day-folder-back, .day-folder, .course-reaction')];
        return {
          id,
          box: { left: round(box.left), right: round(box.right), width: round(box.width) },
          scrollWidth: scene.scrollWidth,
          clientWidth: scene.clientWidth,
          escaped: named.filter((node) => {
            const rect = node.getBoundingClientRect();
            return rect.left < box.left - 2 || rect.right > box.right + 2;
          }).map((node) => node.className),
          wide: [...scene.querySelectorAll('*')].filter((node) => {
            const rect = node.getBoundingClientRect();
            return rect.width > 0 && (rect.left < box.left - 2 || rect.right > box.right + 2);
          }).slice(0, 8).map((node) => ({ className: node.className?.baseVal ?? node.className, tag: node.tagName })),
          brokenImages: [...scene.querySelectorAll('img')].filter((image) => !image.complete || image.naturalWidth === 0).length,
        };
      });
      const photo = document.querySelector('.discovery-place-photo').getBoundingClientRect();
      const counters = [...document.querySelectorAll('.photo-engagement__item')].map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          inside: rect.left >= photo.left - 2 && rect.right <= photo.right + 2 && rect.top >= photo.top - 2 && rect.bottom <= photo.bottom + 2,
          rect: { left: round(rect.left), right: round(rect.right), top: round(rect.top), bottom: round(rect.bottom) },
          photo: { left: round(photo.left), right: round(photo.right), top: round(photo.top), bottom: round(photo.bottom) },
        };
      });
      const routes = [...document.querySelectorAll('.folder-route-line path')];
      const saveScene = document.querySelector('#motionSceneNearby').getBoundingClientRect();
      const c5Screen = document.querySelector('.nearby-c5-screen').getBoundingClientRect();
      const lineCount = (selector) => {
        const element = document.querySelector(selector);
        const range = document.createRange();
        range.selectNodeContents(element);
        return new Set([...range.getClientRects()]
          .filter((rect) => rect.width > 1 && rect.height > 1)
          .map((rect) => Math.round(rect.top)))
          .size;
      };
      const visibleTextOverflow = [...document.querySelectorAll(
        '.hero-title, .hero-sub, .section-title, .chat-text, .journey-title, .journey-text, .cta-title, #finalCtaSection p'
      )]
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => ({
          className: element.className,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          text: element.textContent.trim(),
        }));
      return {
        width: innerWidth,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        scenes,
        counters,
        c5WidthRatio: round(c5Screen.width / saveScene.width),
        routeLength: round(routes.reduce((total, route) => total + route.getTotalLength(), 0)),
        typography: {
          heroTitleLines: lineCount('.hero-title'),
          finalTitleLines: lineCount('.cta-title'),
          visibleTextOverflow,
        },
      };
    })()`);

    assert.ok(report.pageOverflow <= 1, `page overflows by ${report.pageOverflow}px at ${width}px`);
    assert.ok(
      report.counters.every((counter) => counter.inside),
      `engagement counter escaped the place photo at ${width}px (${JSON.stringify(report.counters)})`,
    );
    assert.ok(report.routeLength > 500, `folder route is missing at ${width}px`);
    assert.ok(report.c5WidthRatio >= 0.38, `C5 screen is too small to read at ${width}px (${report.c5WidthRatio})`);
    if (width <= 480) {
      assert.ok(
        report.typography.heroTitleLines <= 2,
        `hero title wraps to ${report.typography.heroTitleLines} lines at ${width}px`,
      );
      assert.ok(
        report.typography.finalTitleLines <= 3,
        `final title wraps to ${report.typography.finalTitleLines} lines at ${width}px`,
      );
      assert.deepEqual(
        report.typography.visibleTextOverflow,
        [],
        `visible copy overflows at ${width}px`,
      );
    }
    for (const scene of report.scenes) {
      assert.ok(scene.clientWidth > 0, `${scene.id} collapsed at ${width}px`);
      assert.ok(
        scene.scrollWidth <= scene.clientWidth + 2,
        `${scene.id} overflows internally at ${width}px (${scene.scrollWidth}/${scene.clientWidth}; ${JSON.stringify(scene.wide)})`,
      );
      assert.deepEqual(scene.escaped, [], `${scene.id} has escaped layers at ${width}px`);
      assert.equal(scene.brokenImages, 0, `${scene.id} has broken images at ${width}px`);
    }
    reports.push(report);
  }

  console.log(JSON.stringify({ browser: basename(executable), viewports: reports }, null, 2));
} finally {
  client?.close();
  browser.kill("SIGTERM");
  await close(preview);
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
