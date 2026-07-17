import { z } from "zod";
import { posix } from "node:path";
import { PHOTO_ROLES, SHOT_TYPES } from "./photo-aesthetic.mjs";

export const CONTENT_TYPES = Object.freeze(["place_event", "collection", "route"]);
export const RIGHTS_STATUSES = Object.freeze(["confirmed", "not_found", "restricted"]);
export const PLACE_TYPES = Object.freeze([
  "cafe",
  "restaurant",
  "bar",
  "exhibition",
  "shop",
  "walk",
  "park",
  "architecture",
  "market",
  "mixed",
]);
export const EDITORIAL_ANGLES = Object.freeze([
  "hidden_gem",
  "fresh_pairing",
  "situational_pick",
  "timely_window",
  "neighborhood_lens",
  "route_story",
]);
export const EDITORIAL_ELEMENTS = Object.freeze([
  "selection_reason",
  "comparison",
  "recommended_context",
  "map_or_route",
  "practical_info",
  "ordered_story",
]);

const sourceSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["official", "editorial", "social"]),
  url: z.string().url(),
  title: z.string().min(1),
  publisher: z.string().min(1),
  checkedAt: z.string().datetime(),
});

const aestheticScoresSchema = z.object({
  naturalLight: z.number().min(0).max(5),
  placeSpecificity: z.number().min(0).max(5),
  composition: z.number().min(0).max(5),
  livedExperience: z.number().min(0).max(5),
  paletteCoherence: z.number().min(0).max(5),
}).strict();

const assetSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("web_photo"),
  localPath: z.string().min(1).refine((localPath) => {
    const normalizedPath = posix.normalize(localPath.replaceAll("\\", "/"));
    return !/(?:^|\/)public\/instagram-pinned-feed\/assets(?:\/|$)/.test(normalizedPath);
  }, "AI asset folder is forbidden"),
  sourceUrl: z.string().url(),
  credit: z.string().min(1),
  rightsStatus: z.enum(RIGHTS_STATUSES),
  privacyNote: z.string().default(""),
  countryCode: z.literal("KR"),
  aiGenerated: z.literal(false),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  photoRole: z.enum(PHOTO_ROLES),
  shotType: z.enum(SHOT_TYPES),
  aestheticScores: aestheticScoresSchema,
}).strict();

const scoreSchema = z.object({
  sendPotential: z.number().min(0).max(5),
  saveValue: z.number().min(0).max(5),
  brandFit: z.number().min(0).max(5),
  timeliness: z.number().min(0).max(5),
  photoQuality: z.number().min(0).max(5),
  originalityPotential: z.number().min(0).max(5),
  factCompleteness: z.number().min(0).max(5),
  reusePermission: z.number().min(0).max(5),
});

const candidateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  type: z.enum(CONTENT_TYPES),
  title: z.string().min(1).max(120),
  hook: z.string().min(1).max(120),
  countryCode: z.literal("KR"),
  cityCode: z.literal("SEOUL"),
  domesticEvidenceSourceId: z.string().min(1),
  region: z.string().min(1).max(80),
  officialAddress: z.string().min(1).max(160),
  placeTypes: z.array(z.enum(PLACE_TYPES)).min(1).refine(
    (types) => new Set(types).size === types.length,
    "Place types must be unique",
  ),
  editorialAngle: z.enum(EDITORIAL_ANGLES),
  editorialAngleNote: z.string().trim().min(10).max(240),
  familiarity: z.enum(["emerging", "well_known"]),
  shareThesis: z.string().trim().min(10).max(160),
  placeIds: z.array(z.string().min(1)).min(1),
  expiresAt: z.string().datetime().nullable(),
  sources: z.array(sourceSchema).min(1),
  assets: z.array(assetSchema).min(1),
  editorialElements: z.array(z.enum(EDITORIAL_ELEMENTS)).min(2).refine(
    (elements) => new Set(elements).size >= 2,
    "Candidate requires at least two unique editorial elements",
  ),
  scores: scoreSchema,
}).strict().superRefine((candidate, context) => {
  const evidence = candidate.sources.find(({ id }) => id === candidate.domesticEvidenceSourceId);
  if (!evidence || evidence.kind !== "official") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["domesticEvidenceSourceId"], message: "Domestic location requires a matching official source" });
  }
  if (!candidate.region.includes("서울")) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["region"], message: "Candidate region must be in Seoul" });
  }
  if (!/^서울(?:특별시)?(?:\s|$)/.test(candidate.officialAddress)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["officialAddress"], message: "Official address must be in Seoul" });
  }
  if (candidate.familiarity === "well_known" && candidate.editorialAngle === "hidden_gem") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["editorialAngle"], message: "A well-known place requires a new editorial angle, not hidden-gem framing" });
  }
});

const templateSchema = z.object({
  id: z.enum(CONTENT_TYPES),
  minSlides: z.number().int().positive(),
  maxSlides: z.number().int().positive(),
  rootNodeId: z.string().regex(/^\d+:\d+$/),
  slots: z.array(z.string().regex(/^slot:/)).min(3),
});

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const brandEndSchema = z.object({
  backgroundHex: z.literal("#050505"),
  appScreen: z.object({
    kind: z.literal("actual_discover_capture"),
    sourcePath: z.literal("public/app-preview/assets/references/b2.png"),
    width: z.literal(393),
    height: z.literal(852),
    sha256: sha256Schema,
  }).strict(),
  logo: z.object({
    sourcePath: z.literal("public/instagram-pinned-feed/assets/doripe-icon-green.png"),
    width: z.literal(500),
    height: z.literal(500),
    colorHex: z.literal("#20F58A"),
    sha256: sha256Schema,
  }).strict(),
}).strict();

const templateContractSchema = z.object({
  version: z.literal(1),
  fileKey: z.string().min(1),
  pageName: z.literal("INSTAGRAM FEED V2 / SHAREABLE DISCOVERY"),
  canvas: z.object({ width: z.literal(1080), height: z.literal(1350), safeInsetX: z.literal(34) }),
  brandEnd: brandEndSchema,
  templates: z.array(templateSchema).length(3),
});

const draftSchema = z.object({
  version: z.literal(2),
  candidate: candidateSchema,
  caption: z.string().min(1),
  brandQuestion: z.string().trim().min(1).max(60).refine(
    (value) => value.endsWith("?"),
    "Brand question must end with ?",
  ),
  keywordPhrases: z.array(z.string().min(1)).min(2).max(6),
  locationTag: z.string().min(1),
  factSourceIds: z.array(z.string().min(1)).min(1),
}).strict();

const packageManifestSchema = z.object({
  version: z.literal(1),
  candidateId: z.string().min(1),
  createdAt: z.string().datetime(),
  files: z.array(z.string().min(1)).refine((files) =>
    files.includes("caption.txt") && files.includes("sources.txt") && files.includes("review.txt") && files.some((file) => file.endsWith(".png")),
    "package files are incomplete",
  ),
});

export const parseTemplateContract = (value) => templateContractSchema.parse(value);
export const parseCandidate = (value) => candidateSchema.parse(value);
export const parseDraft = (value) => draftSchema.parse(value);
export const parsePackageManifest = (value) => packageManifestSchema.parse(value);
