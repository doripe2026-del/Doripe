import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import inventory from "../public/app-preview/figma/screen-inventory.json" with { type: "json" };
import measurements from "../public/app-preview/figma/screen-measurements.json" with { type: "json" };

const outputPath = fileURLToPath(new URL(
  "../public/app-preview/figma/flow-a-coverage-manifest.json",
  import.meta.url
));

const renderedSources = Object.freeze({
  a1: [
    "media/photo/crop-asset", "media/photo/crop-asset#2", "media/photo/crop-asset#3",
    "media/photo/crop-asset#4", "Header-/-brand/logo/image", "screen/title",
    "screen/subtitle", "action/start", "action/login"
  ],
  "a1-splash": ["Header-/-brand/logo/image", "ui/loading/track", "ui/loading/fill"],
  a3: [
    "Header-/-brand/logo/image", "screen/title", "field/email/bg", "field/password/bg",
    "action/forgot-password", "action/primary", "action/primary/bg#2", "action/primary/bg"
  ],
  a4: [
    "Header-/-brand/logo/image", "screen/title", "field/email/bg", "field/password/bg",
    "state/helper-text", "action/forgot-password", "action/primary", "action/primary/bg#2",
    "action/primary/bg"
  ],
  a5: ["action/back", "screen/title", "screen/subtitle", "field/email/bg", "action/next"],
  a6: [
    "action/back", "complete hero / check halo", "codex generated / polished check badge",
    "screen/title", "screen/subtitle", "action/primary", "resend"
  ],
  a7: [
    "action/back", "screen/title", "screen/subtitle", "field/new-password/bg",
    "field/password-rules/container", "field/password-confirm/bg", "action/save"
  ],
  a8: [
    "action/back", "screen/title", "screen/subtitle", "field/new-password/bg",
    "field/password-rules/container", "field/password-confirm/bg", "state/helper-text", "action/save"
  ],
  a9: [
    "action/back", "ui/intro-progress/track", "ui/intro-progress/fill", "screen/title",
    "field/email/bg", "action/next"
  ],
  a10: [
    "action/back", "ui/intro-progress/track", "ui/intro-progress/fill", "screen/title",
    "field/email/bg", "state/helper-text", "action/next"
  ],
  a11: [
    "action/back", "ui/intro-progress/track", "ui/intro-progress/fill", "screen/title",
    "field/email/bg", "state/helper-text", "action/next"
  ],
  a12: [
    "action/back", "ui/intro-progress/track", "ui/intro-progress/fill", "screen/title",
    "screen/subtitle", "field/password/bg", "action/next"
  ],
  a13: [
    "action/back", "ui/intro-progress/track", "ui/intro-progress/fill", "screen/title",
    "screen/subtitle", "field/password/bg", "field/password-rules/container", "action/next"
  ],
  a14: [
    "action/back", "ui/intro-progress/track", "ui/intro-progress/fill", "screen/title",
    "screen/subtitle", "field/year-picker/container", "action/next"
  ],
  a15: [
    "action/back", "ui/intro-progress/track", "ui/intro-progress/fill", "screen/title",
    "screen/subtitle", "gender", "gender radio/여성", "gender radio", "gender#2",
    "gender radio/남성", "gender radio#2", "gender#3", "gender radio/선택하지 않음",
    "gender radio#3", "action/next"
  ],
  a16: [
    "action/back", "ui/intro-progress/track", "ui/intro-progress/fill", "screen/title",
    "screen/subtitle", "field/nickname/bg", "legal/privacy-note", "action/next"
  ],
  a17: [
    "action/back", "ui/intro-progress/track", "ui/intro-progress/fill", "screen/title",
    "screen/subtitle", "field/nickname/bg", "legal/privacy-note", "action/next"
  ],
  a18: [
    "action/back", "ui/intro-progress/track", "ui/intro-progress/fill", "screen/title",
    "screen/subtitle", "slot/option-card/bg", "slot/option-card/bg#2", "slot/option-card/bg#3",
    "slot/option-card/bg#4", "slot/option-card/bg#5", "slot/option-card/bg#6",
    "action/choose-location", "action/skip"
  ],
  a19: [
    "action/back", "ui/intro-progress/track", "ui/intro-progress/fill", "screen/title",
    "screen/subtitle", "slot/option-card/bg", "slot/option-card/bg#2", "slot/option-card/bg#3",
    "slot/option-card/bg#4", "slot/option-card/bg#5", "slot/option-card/bg#6",
    "slot/option-card/bg#7", "slot/option-card/bg#8", "action/next", "action/skip"
  ],
  a20: [
    "misty map bg", "action/back", "ui/intro-progress/track", "ui/intro-progress/fill",
    "screen/title", "screen/subtitle", "region", "region#2", "region#3", "bottom hover",
    "bottom title", "bottom sub", "action/primary"
  ],
  a21: [
    "COMPONENT / floating glass travel status", "travel status / icon background",
    "ICON / Send Plane", "Text / TravelTransition / Destination", "Text / travel subtitle",
    "COMPONENT / loading dots", "Loading / dot 1", "Loading / dot 2", "Loading / dot 3"
  ],
  a22: [
    "ui/loading/track", "ui/loading/fill", "Header-/-brand/logo/image", "screen/title",
    "screen/subtitle"
  ]
});

const reasonEvidence = Object.freeze({
  "brand-layer-owned-by-rendered-brand": "is a named text/group sub-layer inside the rendered brand component, not a separate interface element.",
  "component-text-owned-by-rendered-composite": "is a text sub-layer whose content is already owned by a rendered semantic composite or option control.",
  "control-background-owned-by-semantic-control": "is the visual background sub-layer of a rendered semantic control with its own measured DOM owner.",
  "control-label-owned-by-semantic-control": "is the text label sub-layer of a rendered semantic control with its own measured DOM owner.",
  "decorative-crop-source-owned-by-rendered-media": "is the clipped source layer inside a separately rendered decorative media crop and is not standalone UI.",
  "field-placeholder-owned-by-semantic-input": "is placeholder text owned by a rendered semantic input rather than an independent DOM element.",
  "picker-layer-owned-by-semantic-picker": "is an option/selection visual sub-layer owned by the rendered semantic year picker control.",
  "validation-layer-owned-by-rendered-status": "is an icon or label sub-layer owned by a rendered validation list or field status component.",
  "vector-child-owned-by-component-asset": "is an internal vector/instance layer owned by a separately rendered component-level image asset."
});

function classifySource(source) {
  if (/^asset\/source-reference\/full(?:#\d+)?$/.test(source)) {
    return "decorative-crop-source-owned-by-rendered-media";
  }
  if (/^(?:Group 1|brand\/name)$/.test(source)) return "brand-layer-owned-by-rendered-brand";
  if (/^field\/[^/]+\/placeholder(?:#\d+)?$/.test(source)) {
    return "field-placeholder-owned-by-semantic-input";
  }
  if (/^action\/[^/]+\/bg(?:#\d+)?$/.test(source)) {
    return "control-background-owned-by-semantic-control";
  }
  if (/^(?:action\/[^/]+\/label(?:#\d+)?|slot\/option-card\/label(?:#\d+)?|gender text(?:#\d+)?|region text(?:#\d+)?)$/.test(source)) {
    return "control-label-owned-by-semantic-control";
  }
  if (/^(?:field\/password-rules\/item-(?:icon|label)(?:#\d+)?|field\/validation\/|input check|check\/\d)/.test(source)) {
    return "validation-layer-owned-by-rendered-status";
  }
  if (/^field\/year-picker\//.test(source)) return "picker-layer-owned-by-semantic-picker";
  if (/^(?:gender text|region text)/.test(source)) return "component-text-owned-by-rendered-composite";
  if (/^(?:Vector(?:#\d+)?|web-icon \/ lucide(?:#\d+)?|icon\/back|input icon\/.+|option icon\/.+|gender icon.*|gender check\/.+|region icon\/.+|Icon \/.+|Z\d+ \/ instance|Artwork(?:#\d+)?|Path \d+|bottom pin)$/.test(source)) {
    return "vector-child-owned-by-component-asset";
  }
  throw new Error(`Unreviewed Flow A measurement classification: ${source}`);
}

const flowAScreens = inventory.filter((screen) => screen.group === "A");
const rendered = flowAScreens.map((screen) => ({
  screenId: screen.id,
  figmaNodeId: screen.nodeId,
  sources: renderedSources[screen.id]
}));
const classifications = [];

for (const screen of flowAScreens) {
  const renderedSet = new Set(renderedSources[screen.id]);
  for (const source of Object.keys(measurements[screen.id].elements)) {
    if (renderedSet.has(source)) continue;
    const reason = classifySource(source);
    classifications.push({
      screenId: screen.id,
      figmaNodeId: screen.nodeId,
      source,
      reason,
      evidence: `${screen.id.toUpperCase()} ${source} ${reasonEvidence[reason]}`
    });
  }
}

const manifest = {
  version: 1,
  fileKey: "TfZAtv9JUy508otim4P23w",
  generatedFrom: "screen-measurements.json plus reviewed semantic Flow A DOM ownership",
  rendered,
  classifications
};

await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Wrote ${rendered.length} rendered records and ${classifications.length} classifications to ${outputPath}`);
