import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const home = await readFile(new URL("../public/home/index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../public/home/landing-motion.css", import.meta.url), "utf8");

function cssBlock(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `missing ${marker}`);
  const openIndex = source.indexOf("{", markerIndex);
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] !== "}") continue;
    depth -= 1;
    if (depth === 0) return source.slice(openIndex + 1, index);
  }
  assert.fail(`unclosed ${marker}`);
}

test("hero and course markers share the same responsive SVG route geometry", () => {
  const heroPath = home.match(/class="hero-route-line"[\s\S]*?<path[^>]*d="([^"]+)"/)?.[1];
  const coursePath = home.match(/class="route-line"[\s\S]*?<path[^>]*d="([^"]+)"/)?.[1];
  assert.ok(heroPath, "hero route path missing");
  assert.equal(heroPath, coursePath);
  assert.match(home, /motion-route-flow[\s\S]*motion-navigation[\s\S]*navigation-marker-icon/);
  assert.match(home, /route-navigation-track[\s\S]*navigation-handoff[\s\S]*navigation-marker-icon/);
  assert.doesNotMatch(css, /offset-(?:path|distance|rotate)\s*:/);
});

test("route navigation uses multiple path-derived responsive transform waypoints", () => {
  for (const name of ["heroNavigation", "startNavigation"]) {
    const keyframes = cssBlock(css, `@keyframes ${name}`);
    const waypoints = [...keyframes.matchAll(/translate\(([-.\d]+)%,\s*([-.\d]+)%\)/g)];
    assert.ok(waypoints.length >= 5, `${name} needs at least five responsive waypoints`);
    assert.doesNotMatch(keyframes, /translate\([^)]*px/);
    const properties = [...keyframes.matchAll(/([a-z][a-z-]*)\s*:/g)].map((match) => match[1]);
    assert.ok(properties.every((property) => property === "opacity" || property === "transform"));
  }
});

test("hero route visibly draws while cards become pins", () => {
  assert.match(home, /class="hero-route-line"[^>]*data-motion-layer="hero-route-line"/);
  const pathRule = cssBlock(css, ".landing-motion--hero .hero-route-line path");
  assert.match(pathRule, /stroke-dasharray:\s*700/);
  assert.match(pathRule, /stroke-dashoffset:\s*700/);
  assert.match(pathRule, /animation:\s*heroRouteDraw\s+8s/);

  const draw = cssBlock(css, "@keyframes heroRouteDraw");
  assert.match(draw, /stroke-dashoffset:\s*700/);
  assert.match(draw, /stroke-dashoffset:\s*0/);
  const properties = [...draw.matchAll(/([a-z][a-z-]*)\s*:/g)].map((match) => match[1]);
  assert.ok(properties.every((property) => property === "stroke-dashoffset"));
});
