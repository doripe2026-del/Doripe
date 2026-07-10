import { createHash } from "node:crypto";
import { DOMParser } from "@xmldom/xmldom";

function numericDimension(value) {
  const parsed = Number.parseFloat(value || "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function svgDimensions(contents, path) {
  const document = new DOMParser().parseFromString(contents.toString("utf8"), "image/svg+xml");
  const svg = document.documentElement;
  if (svg?.localName !== "svg") throw new Error(`Invalid SVG asset: ${path}`);

  let width = numericDimension(svg.getAttribute("width"));
  let height = numericDimension(svg.getAttribute("height"));
  if (width === null || height === null) {
    const viewBox = svg.getAttribute("viewBox").trim().split(/[\s,]+/).map(Number);
    if (viewBox.length !== 4 || viewBox.some((value) => !Number.isFinite(value))) {
      throw new Error(`SVG asset has no dimensions: ${path}`);
    }
    width = viewBox[2];
    height = viewBox[3];
  }
  return { width, height };
}

function pngDimensions(contents, path) {
  if (contents.length < 24 || contents.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error(`Invalid PNG asset: ${path}`);
  }
  return { width: contents.readUInt32BE(16), height: contents.readUInt32BE(20) };
}

export function readAssetMetadata(contents, path) {
  const dimensions = path.toLowerCase().endsWith(".svg")
    ? svgDimensions(contents, path)
    : pngDimensions(contents, path);
  return {
    hash: createHash("sha256").update(contents).digest("hex"),
    ...dimensions
  };
}
