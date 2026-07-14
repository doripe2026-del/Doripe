#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseTemplateContract } from "./contracts.mjs";

const entries = process.argv.slice(2).map((value) => value.split("=", 2));
const input = Object.fromEntries(entries);
const required = ["fileKey", "placeEventNodeId", "collectionNodeId", "routeNodeId", "output"];
for (const key of required) {
  if (!input[key]) throw new Error(`Missing ${key}= value`);
}

const slideRanges = {
  place_event: { minSlides: 6, maxSlides: 8 },
  collection: { minSlides: 7, maxSlides: 11 },
  route: { minSlides: 7, maxSlides: 9 },
};

const contract = parseTemplateContract({
  version: 1,
  fileKey: input.fileKey,
  pageName: "Instagram Content Automation",
  canvas: { width: 1080, height: 1350, safeInsetX: 34 },
  templates: [
    {
      id: "place_event",
      ...slideRanges.place_event,
      rootNodeId: input.placeEventNodeId,
      slots: [
        "slot:title",
        "slot:subtitle",
        "slot:photo:01",
        "slot:credit",
        "slot:brand-question",
      ],
    },
    {
      id: "collection",
      ...slideRanges.collection,
      rootNodeId: input.collectionNodeId,
      slots: [
        "slot:title",
        "slot:subtitle",
        "slot:photo:01",
        "slot:place:01",
        "slot:body:01",
        "slot:credit",
        "slot:brand-question",
      ],
    },
    {
      id: "route",
      ...slideRanges.route,
      rootNodeId: input.routeNodeId,
      slots: [
        "slot:title",
        "slot:subtitle",
        "slot:photo:01",
        "slot:place:01",
        "slot:body:01",
        "slot:info:location",
        "slot:credit",
        "slot:brand-question",
      ],
    },
  ],
});

await mkdir(dirname(input.output), { recursive: true });
await writeFile(input.output, `${JSON.stringify(contract, null, 2)}\n`);
