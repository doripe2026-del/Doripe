import { z } from "zod";

const safeId = z.string().min(1).max(80).regex(/^[a-z0-9][a-z0-9_-]*$/i);

function csvList({ maxItemLength = 120, maxStringLength = 2000 } = {}) {
  return z
    .union([z.string().max(maxStringLength), z.array(z.string().max(maxItemLength)).max(80)])
    .optional()
    .transform((value) => {
      const items = Array.isArray(value) ? value : (value ?? "").split(",");
      return items.map((item) => item.trim()).filter(Boolean);
    });
}

const tagList = csvList();
const moodTagList = tagList.transform((tags) => tags.slice(0, 2));
const imageUrlList = csvList({ maxItemLength: 1000, maxStringLength: 20000 });

export const placePayloadSchema = z.object({
  id: safeId,
  status: z.enum(["draft", "ready", "inactive"]),
  neighborhood_id: safeId,
  sub_area: z.string().max(100).optional().default(""),
  category_id: safeId,
  name: z.string().min(1).max(120),
  short_copy: z.string().max(300).optional().default(""),
  mood_tags: moodTagList,
  best_for: tagList,
  time_tags: tagList,
  route_role: z.enum(["start", "middle", "finish", "pause"]),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  address: z.string().max(300).optional().default(""),
  nearest_station: z.string().max(100).optional().default(""),
  naver_place_url: z.string().max(500).optional().default(""),
  cover_photo_id: z.string().uuid().optional().nullable(),
  cover_image_url: z.string().max(1000).optional().default(""),
  image_urls: imageUrlList,
  image_credit: z.enum(["team", "owner", "creator", "licensed", "unsplash", "naver"]),
  photo_qa_status: z.enum(["pending", "approved", "rejected"]),
  hours_text: z.string().max(200).optional().default(""),
  phone_text: z.string().max(80).optional().default(""),
  price_hint: z.string().max(100).optional().default(""),
  representative_menu_name: z.string().max(120).optional().default(""),
  representative_menu_price: z.string().max(80).optional().default(""),
  instagram_url: z.string().max(500).optional().default(""),
  stay_time_minutes: z.coerce.number().int().min(0).max(1440).default(45),
  editorial_note: z.string().max(2000).optional().default(""),
  qa_status: z.enum(["draft", "ready", "needs_fix"]),
  last_checked_at: z.string().optional().nullable(),
});

export const photoPayloadSchema = z.object({
  place_id: safeId,
  photo_type: z.enum(["cover", "gallery", "original", "rights"]),
  source_type: z.enum(["team", "owner", "creator", "licensed", "naver"]),
  rights_holder_name: z.string().max(120).optional().default(""),
  credit_text: z.string().max(200).optional().default(""),
  permission_status: z.enum(["pending", "approved", "rejected"]),
  usage_scope: z.string().max(300).optional().default(""),
  license_note: z.string().max(1000).optional().default(""),
});
