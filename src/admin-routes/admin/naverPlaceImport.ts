import { z } from "zod";
import { NextResponse } from "../../admin-server/response.js";
import { requireAdminRequest } from "../../admin-server/adminAuth.js";
import { createSupabaseAdminClient } from "../../admin-server/supabaseAdmin.js";

export const runtime = "nodejs";

const importSchema = z.object({
  category_id: z.string().max(80).optional().default(""),
  neighborhood_id: z.string().max(80).optional().default(""),
  url: z.string().trim().url().max(1000),
});

const allowedHosts = new Set([
  "map.naver.com",
  "m.map.naver.com",
  "m.place.naver.com",
  "naver.me",
  "nmap.place.naver.com",
  "pcmap.place.naver.com",
]);
const placeSelect = "*, place_photos!place_photos_place_id_fkey(*)";
const mobileUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

type NaverApolloState = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function assertAllowedUrl(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("http/https 네이버 지도 링크만 사용할 수 있습니다.");
  }
  const hostname = url.hostname.toLowerCase();
  const isAllowedNaverHost = allowedHosts.has(hostname)
    || hostname.endsWith(".map.naver.com")
    || hostname.endsWith(".place.naver.com");

  if (!isAllowedNaverHost) {
    throw new Error("네이버 지도/플레이스 링크만 사용할 수 있습니다.");
  }
}

async function fetchAllowedHtml(inputUrl: string) {
  let current = new URL(inputUrl);
  for (let index = 0; index < 5; index += 1) {
    assertAllowedUrl(current);
    const response = await fetch(current, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.7,en;q=0.6",
        "user-agent": mobileUserAgent,
      },
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("네이버 지도 링크 리다이렉트 위치를 찾지 못했습니다.");
      const next = new URL(location, current);
      assertAllowedUrl(next);
      if (extractPlaceId(next.toString())) {
        return {
          finalUrl: next.toString(),
          html: "",
        };
      }
      current = next;
      continue;
    }

    if (!response.ok) {
      throw new Error(`네이버 페이지를 불러오지 못했습니다. (${response.status})`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      throw new Error("네이버 플레이스 HTML 응답이 아닙니다.");
    }

    return {
      finalUrl: current.toString(),
      html: await response.text(),
    };
  }

  throw new Error("네이버 지도 링크 리다이렉트가 너무 많습니다.");
}

function extractPlaceId(url: string, html = "") {
  const candidates = [url, html];
  for (const value of candidates) {
    const match = value.match(/(?:entry\/place|place|restaurant|cafe|hospital|hairshop|accommodation)\/(\d{4,})/);
    if (match?.[1]) return match[1];
  }
  const parsed = new URL(url);
  return parsed.searchParams.get("placeId") ?? parsed.searchParams.get("pinId") ?? parsed.searchParams.get("id") ?? "";
}

function extractAssignedObject(html: string, assignmentName: string) {
  const marker = `window.${assignmentName}`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return "";

  const equalIndex = html.indexOf("=", markerIndex);
  if (equalIndex < 0) return "";

  const objectStart = html.indexOf("{", equalIndex);
  if (objectStart < 0) return "";

  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let index = objectStart; index < html.length; index += 1) {
    const char = html[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return html.slice(objectStart, index + 1);
    }
  }

  return "";
}

function parseApolloState(html: string): NaverApolloState {
  const rawState = extractAssignedObject(html, "__APOLLO_STATE__");
  if (!rawState) throw new Error("네이버 플레이스 데이터 상태를 찾지 못했습니다.");
  const parsed = JSON.parse(rawState) as unknown;
  if (!isRecord(parsed)) throw new Error("네이버 플레이스 데이터 형식이 올바르지 않습니다.");
  return parsed;
}

function findBasePlace(state: NaverApolloState, placeId: string) {
  const direct = state[`PlaceDetailBase:${placeId}`];
  if (isRecord(direct)) return direct;
  return Object.values(state).find((value) => isRecord(value) && value.__typename === "PlaceDetailBase") as Record<string, unknown> | undefined;
}

function formatMenuPrice(price: string) {
  if (!price) return "";
  const numeric = Number(price.replace(/[^\d]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return price;
  return `${numeric.toLocaleString("ko-KR")}원`;
}

function representativeMenu(state: NaverApolloState) {
  const menus = Object.values(state)
    .filter((value): value is Record<string, unknown> => isRecord(value) && value.__typename === "Menu")
    .sort((left, right) => numberValue(left.index) - numberValue(right.index));
  const menu = menus.find((item) => item.recommend === true) ?? menus[0];
  return {
    name: text(menu?.name),
    price: formatMenuPrice(text(menu?.price)),
  };
}

function proxiedNaverImageUrl(url: string) {
  if (!url) return "";
  if (url.includes("search.pstatic.net/common/")) return url;
  return `https://search.pstatic.net/common/?autoRotate=true&type=w560_sharpen&src=${encodeURIComponent(url)}`;
}

function imageUrlsFromState(state: NaverApolloState) {
  const topPhotos = Object.values(state)
    .filter((value): value is Record<string, unknown> => isRecord(value) && value.__typename === "PlaceDetailTopPhotoItem")
    .sort((left, right) => numberValue(left.no) - numberValue(right.no))
    .map((item) => proxiedNaverImageUrl(text(item.origin)));

  const menuImages = Object.values(state)
    .filter((value): value is Record<string, unknown> => isRecord(value) && value.__typename === "Menu")
    .sort((left, right) => numberValue(left.index) - numberValue(right.index))
    .flatMap((menu) => Array.isArray(menu.images) ? menu.images.map((url) => proxiedNaverImageUrl(text(url))) : []);

  return uniqueStrings([...topPhotos, ...menuImages]).slice(0, 5);
}

function openingHoursText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.map((item) => openingHoursText(item)).filter(Boolean).join(" / ").slice(0, 200);
  }
  if (!isRecord(value)) return "";

  const compactFields = ["day", "name", "businessStatus", "description", "start", "end", "time", "text"];
  const line = compactFields.map((field) => text(value[field])).filter(Boolean).join(" ");
  if (line) return line.slice(0, 200);

  for (const child of Object.values(value)) {
    const childText = openingHoursText(child);
    if (childText) return childText.slice(0, 200);
  }
  return "";
}

function inferSubArea(address: string) {
  return address.match(/[가-힣]+동/)?.[0] ?? "";
}

function categoryIdForNaverCategory(
  naverCategory: string,
  categories: Array<{ id: string; name: string }>,
  requestedCategoryId: string,
) {
  if (requestedCategoryId && categories.some((category) => category.id === requestedCategoryId)) {
    return requestedCategoryId;
  }

  const normalized = naverCategory.toLowerCase();
  const rules: Array<{ categoryNames: string[]; keywords: string[] }> = [
    { categoryNames: ["카페"], keywords: ["카페", "커피", "브런치카페"] },
    { categoryNames: ["디저트"], keywords: ["디저트", "베이커리", "빵", "케이크", "도넛", "아이스크림"] },
    { categoryNames: ["음식점"], keywords: ["음식", "한식", "양식", "일식", "중식", "분식", "퓨전", "브런치", "파스타", "스테이크", "고기", "식당", "레스토랑"] },
    { categoryNames: ["술 bar", "술", "바"], keywords: ["술", "바", "와인", "맥주", "호프", "이자카야", "칵테일", "주점"] },
    { categoryNames: ["전시/문화", "문화"], keywords: ["전시", "갤러리", "미술관", "공연", "문화"] },
    { categoryNames: ["쇼핑/체험", "쇼핑"], keywords: ["소품", "편집샵", "서점", "쇼핑", "공방", "체험"] },
  ];

  for (const rule of rules) {
    if (!rule.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) continue;
    const category = categories.find((item) => rule.categoryNames.some((name) => item.name.includes(name)));
    if (category) return category.id;
  }

  return categories.find((category) => category.name === "미분류")?.id ?? categories[0]?.id ?? "category-uncategorized";
}

async function createUncategorizedCategoryIfNeeded() {
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase.from("categories").select("id").eq("id", "category-uncategorized").maybeSingle();
  if (existing?.id) return;
  await supabase.from("categories").upsert({
    display_order: 9999,
    id: "category-uncategorized",
    name: "미분류",
    status: "active",
  });
}

export async function POST(request: Request) {
  const authError = await requireAdminRequest(request, { checkOrigin: true });
  if (authError) return authError;

  const parsed = importSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.message }, { status: 400 });
  }

  try {
    const initialFetch = await fetchAllowedHtml(parsed.data.url);
    const initialPlaceId = extractPlaceId(initialFetch.finalUrl, initialFetch.html);
    if (!initialPlaceId) {
      return NextResponse.json({ message: "네이버 플레이스 ID를 찾지 못했습니다." }, { status: 400 });
    }

    const mobileUrl = `https://m.place.naver.com/place/${initialPlaceId}/home`;
    const { finalUrl, html } = await fetchAllowedHtml(mobileUrl);
    const placeIdFromFinal = extractPlaceId(finalUrl, html) || initialPlaceId;
    const state = parseApolloState(html);
    const base = findBasePlace(state, placeIdFromFinal);
    if (!base) {
      return NextResponse.json({ message: "네이버 플레이스 기본 정보를 찾지 못했습니다." }, { status: 400 });
    }

    await createUncategorizedCategoryIfNeeded();

    const supabase = createSupabaseAdminClient();
    const [categoriesResult, neighborhoodsResult] = await Promise.all([
      supabase.from("categories").select("id,name").eq("status", "active").order("display_order"),
      supabase.from("neighborhoods").select("id,name").eq("status", "active").order("display_order"),
    ]);
    const categories = categoriesResult.data ?? [];
    const neighborhoods = neighborhoodsResult.data ?? [];
    const neighborhoodId = parsed.data.neighborhood_id && neighborhoods.some((item) => item.id === parsed.data.neighborhood_id)
      ? parsed.data.neighborhood_id
      : neighborhoods[0]?.id ?? "";

    if (!neighborhoodId) {
      return NextResponse.json({ message: "등록 가능한 동네가 없습니다." }, { status: 400 });
    }

    const placeId = `naver-${placeIdFromFinal}`;
    const category = text(base.category);
    const roadAddress = text(base.roadAddress);
    const menu = representativeMenu(state);
    const photoUrls = imageUrlsFromState(state);
    const microReviews = Array.isArray(base.microReviews) ? base.microReviews.map(text).filter(Boolean) : [];
    const coordinate = isRecord(base.coordinate) ? base.coordinate : {};
    const naverPlaceUrl = `https://m.place.naver.com/place/${placeIdFromFinal}/home`;
    const today = new Date().toISOString().slice(0, 10);

    const placePayload = {
      address: roadAddress || text(base.address),
      best_for: [],
      category_id: categoryIdForNaverCategory(category, categories, parsed.data.category_id),
      cover_image_url: photoUrls[0] ?? "",
      editorial_note: "",
      hours_text: openingHoursText(base.openingHours),
      id: placeId,
      image_credit: "naver",
      image_urls: photoUrls,
      instagram_url: "",
      last_checked_at: today,
      lat: numberValue(coordinate.y),
      lng: numberValue(coordinate.x),
      mood_tags: [],
      name: text(base.name),
      naver_place_url: naverPlaceUrl,
      nearest_station: "",
      neighborhood_id: neighborhoodId,
      phone_text: text(base.virtualPhone) || text(base.phone),
      photo_qa_status: photoUrls.length ? "approved" : "pending",
      price_hint: "",
      qa_status: "ready",
      representative_menu_name: menu.name,
      representative_menu_price: menu.price,
      route_role: "middle",
      short_copy: microReviews[0] ?? "",
      status: "ready",
      stay_time_minutes: 45,
      sub_area: inferSubArea(text(base.address) || roadAddress),
      time_tags: [],
    };

    const { error: placeError } = await supabase.from("places").upsert(placePayload);
    if (placeError) {
      return NextResponse.json({ message: placeError.message }, { status: 500 });
    }

    const existingNaverPhotos = await supabase
      .from("place_photos")
      .delete()
      .eq("place_id", placeId)
      .eq("source_type", "naver");
    if (existingNaverPhotos.error) {
      return NextResponse.json({ message: existingNaverPhotos.error.message }, { status: 500 });
    }

    let coverPhotoId: string | null = null;
    if (photoUrls.length) {
      const { data: photos, error: photoError } = await supabase
        .from("place_photos")
        .insert(photoUrls.map((url, index) => ({
          bucket_id: "external-naver",
          credit_text: "네이버 지도/플레이스",
          display_order: index,
          license_note: naverPlaceUrl,
          permission_status: "approved",
          photo_type: index === 0 ? "cover" : "gallery",
          place_id: placeId,
          public_url: url,
          rights_holder_name: "Naver",
          source_type: "naver",
          storage_path: "",
          usage_scope: "Doripe MVP 장소카드 출처 표기",
        })))
        .select("*");

      if (photoError) {
        return NextResponse.json({ message: photoError.message }, { status: 500 });
      }
      coverPhotoId = photos?.[0]?.id ?? null;
    }

    const { data: place, error: loadError } = await supabase
      .from("places")
      .update({
        cover_photo_id: coverPhotoId,
        cover_image_url: photoUrls[0] ?? "",
        image_urls: photoUrls,
        photo_qa_status: photoUrls.length ? "approved" : "pending",
      })
      .eq("id", placeId)
      .select(placeSelect)
      .single();

    if (loadError) {
      return NextResponse.json({ message: loadError.message }, { status: 500 });
    }

    await supabase.from("admin_audit_logs").insert({
      action: "import_naver_place",
      entity_type: "place",
      entity_id: placeId,
      payload: {
        category,
        importedPhotoCount: photoUrls.length,
        naverPlaceId: placeIdFromFinal,
        naverPlaceUrl,
        sourceUrl: parsed.data.url,
      },
    });

    return NextResponse.json({
      imported: {
        category,
        photoCount: photoUrls.length,
        sourceUrl: parsed.data.url,
      },
      ok: true,
      place,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "네이버 장소 가져오기에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
