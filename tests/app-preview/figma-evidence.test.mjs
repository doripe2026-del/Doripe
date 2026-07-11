import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import inventory from "../../public/app-preview/figma/screen-inventory.json" with { type: "json" };
import liveEvidence from "../../public/app-preview/figma/flow-a-live-evidence.json" with { type: "json" };
import measurements from "../../public/app-preview/figma/screen-measurements.json" with { type: "json" };
import masks from "../../public/app-preview/figma/visual-masks.json" with { type: "json" };
import { validateFlowALiveEvidence } from "../../scripts/app-preview-semantic-gates.mjs";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const allowedMaskReasons = new Set(["photo", "video", "map", "user-generated-text"]);
const expectedAScreens = [
  {
    id: "a1",
    nodeId: "446:34",
    provenance: {
      sourceSection: "Flow / A Onboarding",
      rationale: "Brief-required a1 retained; current equivalent is 579:603.",
      alternateNodeIds: ["579:603"]
    }
  },
  {
    id: "a1-splash",
    nodeId: "579:698",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Current modified splash selected over the original splash.",
      alternateNodeIds: ["446:134"]
    }
  },
  {
    id: "a3",
    nodeId: "579:929",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Current modified equivalent selected over the original login screen.",
      alternateNodeIds: ["446:430"]
    }
  },
  {
    id: "a4",
    nodeId: "579:991",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Unique current login-failure state; no original equivalent.",
      alternateNodeIds: []
    }
  },
  {
    id: "a5",
    nodeId: "579:833",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Current modified equivalent selected over the original reset-email screen.",
      alternateNodeIds: ["446:281"]
    }
  },
  {
    id: "a6",
    nodeId: "579:848",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Current modified equivalent selected over the original reset-sent screen.",
      alternateNodeIds: ["446:298"]
    }
  },
  {
    id: "a7",
    nodeId: "579:702",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Current modified equivalent selected over the original new-password screen.",
      alternateNodeIds: ["446:146"]
    }
  },
  {
    id: "a8",
    nodeId: "579:1063",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Unique current password-mismatch state; no original equivalent.",
      alternateNodeIds: []
    }
  },
  {
    id: "a9",
    nodeId: "579:638",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Current modified equivalent selected over the original signup-email screen.",
      alternateNodeIds: ["446:75"]
    }
  },
  {
    id: "a10",
    nodeId: "579:1015",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Unique current email-format error state; no original equivalent.",
      alternateNodeIds: []
    }
  },
  {
    id: "a11",
    nodeId: "579:1039",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Unique current existing-email error state; no original equivalent.",
      alternateNodeIds: []
    }
  },
  {
    id: "a12",
    nodeId: "579:621",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Current modified equivalent selected over the original password-creation screen.",
      alternateNodeIds: ["446:56"]
    }
  },
  {
    id: "a13",
    nodeId: "579:660",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Current modified equivalent selected over the original password-entry screen.",
      alternateNodeIds: ["446:98"]
    }
  },
  {
    id: "a14",
    nodeId: "579:763",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Current modified equivalent selected over the original birth-year screen.",
      alternateNodeIds: ["446:206"]
    }
  },
  {
    id: "a15",
    nodeId: "579:951",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Current modified equivalent selected over the original gender screen.",
      alternateNodeIds: ["446:457"]
    }
  },
  {
    id: "a16",
    nodeId: "579:739",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Current modified equivalent selected over the original nickname screen.",
      alternateNodeIds: ["446:182"]
    }
  },
  {
    id: "a17",
    nodeId: "579:1102",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Unique current duplicate-nickname error state; no original equivalent.",
      alternateNodeIds: []
    }
  },
  {
    id: "a18",
    nodeId: "579:781",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Current modified equivalent selected over the original acquisition-source screen.",
      alternateNodeIds: ["446:226"]
    }
  },
  {
    id: "a19",
    nodeId: "579:863",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Current modified equivalent selected over the original awareness-source screen.",
      alternateNodeIds: ["446:321"]
    }
  },
  {
    id: "a20",
    nodeId: "579:1127",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Current modified neighborhood-selection state selected over the original screen.",
      alternateNodeIds: ["446:391"]
    }
  },
  {
    id: "a21",
    nodeId: "579:1173",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Unique current neighborhood-transition frame; no original equivalent.",
      alternateNodeIds: []
    }
  },
  {
    id: "a22",
    nodeId: "579:1162",
    provenance: {
      sourceSection: "Flow / A Onboarding_수정",
      rationale: "Unique current completion-loading state; no original equivalent.",
      alternateNodeIds: []
    }
  }
];
const overlaps = (left, right) => (
  left.x < right.x + right.width
  && right.x < left.x + left.width
  && left.y < right.y + right.height
  && right.y < left.y + left.height
);

test("committed Flow A references match the exact live Figma capture registry", async () => {
  const referenceHashes = new Map();
  for (const screen of inventory.filter(({ group }) => group === "A")) {
    const png = await readFile(join(repositoryRoot, "public", screen.reference.replace(/^\//, "")));
    referenceHashes.set(screen.id, createHash("sha256").update(png).digest("hex"));
  }

  assert.doesNotThrow(() => validateFlowALiveEvidence({
    evidence: liveEvidence,
    inventory,
    referenceHashes
  }));
  assert.throws(() => validateFlowALiveEvidence({
    evidence: {
      ...liveEvidence,
      screens: liveEvidence.screens.slice(1)
    },
    inventory,
    referenceHashes
  }), /missing screen/);
});

test("every final screen has complete and internally consistent Figma evidence", async () => {
  assert.ok(inventory.length >= 50);
  assert.equal(new Set(inventory.map((item) => item.id)).size, inventory.length);
  assert.equal(new Set(inventory.map((item) => item.nodeId)).size, inventory.length);

  const inventoryIds = inventory.map((item) => item.id).sort();
  assert.deepEqual(Object.keys(measurements).sort(), inventoryIds);
  assert.deepEqual(Object.keys(masks).sort(), inventoryIds);

  const flowAScreens = inventory.filter((item) => item.group === "A");
  assert.deepEqual(
    flowAScreens.map(({ id, nodeId, provenance }) => ({ id, nodeId, provenance })),
    expectedAScreens
  );

  for (const screen of inventory) {
    assert.match(screen.id, /^[a-e]\d+[a-z0-9-]*$/);
    assert.match(screen.nodeId, /^\d+:\d+$/);
    assert.ok(["A", "B", "C", "D", "E"].includes(screen.group));
    assert.equal(measurements[screen.id].nodeId, screen.nodeId);
    assert.equal(measurements[screen.id].frame.width, 393);
    assert.equal(measurements[screen.id].frame.height, 852);
    assert.equal(screen.reference, `/app-preview/assets/references/${screen.id}.png`);
    assert.ok(Object.hasOwn(masks, screen.id));
    assert.ok(Array.isArray(masks[screen.id]));
    assert.deepEqual(screen.masks, masks[screen.id]);

    if (screen.group === "A") {
      assert.ok(screen.provenance);
      assert.ok([
        "Flow / A Onboarding",
        "Flow / A Onboarding_수정"
      ].includes(screen.provenance.sourceSection));
      assert.ok(screen.provenance.rationale.trim().length > 0);
      assert.ok(Array.isArray(screen.provenance.alternateNodeIds));
      for (const nodeId of screen.provenance.alternateNodeIds) assert.match(nodeId, /^\d+:\d+$/);
    }

    for (const mask of masks[screen.id]) {
      assert.ok(allowedMaskReasons.has(mask.reason));
      for (const key of ["x", "y", "width", "height"]) assert.ok(Number.isFinite(mask[key]));
      assert.ok(mask.x >= 0);
      assert.ok(mask.y >= 0);
      assert.ok(mask.width > 0);
      assert.ok(mask.height > 0);
      assert.ok(mask.x + mask.width <= 393);
      assert.ok(mask.y + mask.height <= 852);
    }

    const png = await readFile(join(repositoryRoot, "public", screen.reference.replace(/^\//, "")));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 393);
    assert.equal(png.readUInt32BE(20), 852);
  }

  const c1MapMasks = masks.c1.filter((mask) => mask.reason === "map");
  assert.ok(c1MapMasks.length > 0);
  assert.ok(c1MapMasks.every((mask) => mask.y + mask.height <= 220));

  const b4ProtectedUi = [
    { x: 17, y: 289, width: 76, height: 32 },
    { x: 327, y: 210, width: 50, height: 50 },
    { x: 327, y: 272, width: 50, height: 50 }
  ];
  const b4PhotoMasks = masks.b4.filter((mask) => mask.reason === "photo");
  assert.ok(b4PhotoMasks.length > 1);
  for (const mask of b4PhotoMasks) {
    assert.ok(b4ProtectedUi.every((fixedUi) => !overlaps(mask, fixedUi)));
  }

  const flattenedRouteHero = { x: 0, y: 0, width: 393, height: 386 };
  for (const screenId of ["c6"]) {
    assert.ok(masks[screenId].every((mask) => !overlaps(mask, flattenedRouteHero)));
  }

  assert.doesNotMatch(JSON.stringify({ inventory, measurements, masks }), /https?:\/\//i);
});
