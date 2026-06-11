import { z } from "zod";

export const APP_CARD_ACTION_LIMIT = 12;
export const ACTIVE_WEB_NEIGHBORHOOD_NAME = "연남";
export const ACTIVE_WEB_NEIGHBORHOOD_ID = "yeonnam";
export const ACTIVE_WEB_REGION_ID = "yeonnam_mangwon";

export const DISABLED_WEB_NEIGHBORHOODS = [
  { id: "seongsu", label: "성수" },
  { id: "yongsan-huam-haebangchon", label: "용산·후암·해방촌" },
  { id: "mangwon", label: "망원" },
] as const;

export const appEventNames = [
  "app_open",
  "session_start",
  "session_heartbeat",
  "neighborhood_select",
  "disabled_neighborhood_tap",
  "discover_card_view",
  "discover_photo_next",
  "discover_photo_previous",
  "place_save",
  "place_skip",
  "place_detail_open",
  "saved_tab_open",
  "saved_place_open",
  "place_unsave",
  "route_tab_open",
  "route_place_select",
  "route_create_attempt",
  "route_create_blocked",
  "share_button_tap",
  "share_link_created",
  "share_link_open",
  "shared_place_open",
  "shared_route_open",
  "external_map_open",
  "error_shown",
] as const;

export const anonymousIdSchema = z
  .string()
  .trim()
  .min(12)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);

export const sessionIdSchema = z
  .string()
  .trim()
  .min(12)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);

export const appEventPayloadSchema = z.object({
  anonymousUserId: anonymousIdSchema,
  sessionId: sessionIdSchema.optional().nullable(),
  eventName: z.enum(appEventNames),
  screen: z.string().trim().max(80).optional().default(""),
  placeId: z.string().trim().max(80).optional().nullable(),
  routeId: z.string().uuid().optional().nullable(),
  shareId: z.string().trim().max(80).optional().nullable(),
  neighborhoodId: z.string().trim().max(80).optional().nullable(),
  categoryId: z.string().trim().max(80).optional().nullable(),
  durationMs: z.number().int().min(0).max(86_400_000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  clientCreatedAt: z.string().datetime().optional().nullable(),
});

export const shareLinkPayloadSchema = z
  .object({
    anonymousUserId: anonymousIdSchema,
    type: z.enum(["place", "route"]),
    placeId: z.string().trim().max(80).optional().nullable(),
    placeIds: z.array(z.string().trim().max(80)).max(12).optional().default([]),
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(240).optional().default(""),
  })
  .refine(
    (value) => {
      if (value.type === "place") return Boolean(value.placeId);
      return value.placeIds.length >= 2;
    },
    { message: "Invalid share target" },
  );

export type AppEventPayload = z.infer<typeof appEventPayloadSchema>;
export type ShareLinkPayload = z.infer<typeof shareLinkPayloadSchema>;
