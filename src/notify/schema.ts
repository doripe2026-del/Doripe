import { z } from "zod";

const AGE = ["20-24", "25-29", "30-34", "35+"] as const;
const GENDER = ["여", "남", "응답 안 함"] as const;
const REGION = ["서울", "경기·인천", "강원·충청", "전라·제주", "경상", "해외"] as const;
const PRIORITY = ["분위기", "음식", "가격", "새로움", "동선 효율", "사진 잘 나옴"] as const;
const SAVE_HABIT = ["인스타 저장 자주 함", "네이버 별표", "메모앱·노션", "머릿속에만", "안 모음"] as const;
const BUDGET = ["2만원 이하", "2-5만원", "5-10만원", "10만원 이상"] as const;
const FREQUENCY = ["주 3회+", "주 1-2회", "월 2-3회", "월 1회 이하"] as const;
const SEARCH_TIME = ["5분 이하", "10-30분", "30분-1시간", "1시간 이상", "그냥 가던 데 감"] as const;
const COMPANION = ["혼자", "연인", "친구", "가족", "여행객 동반"] as const;
const MOOD = [
  "조용함", "시끌벅적함", "인디·로컬", "럭셔리", "빈티지",
  "미니멀", "아늑함", "활기참", "어두운 무드", "밝고 환함",
] as const;
const TIME_SLOT = [
  "아침(6-11)", "점심(11-14)", "오후(14-18)",
  "저녁(18-22)", "심야(22-2)", "새벽(2-6)",
] as const;
const INFO_SOURCE = ["인스타그램", "네이버지도·카카오맵", "블로그", "유튜브", "지인 추천", "길 가다", "다른 앱"] as const;

export const SignupPayloadSchema = z.object({
  email: z.string().email().max(254),
  age: z.enum(AGE),
  gender: z.enum(GENDER),
  region: z.enum(REGION),
  companion: z.array(z.enum(COMPANION)).min(1),
  mood: z.array(z.enum(MOOD)).min(1).max(3),
  timeSlot: z.array(z.enum(TIME_SLOT)).min(1),
  priority: z.enum(PRIORITY),
  savingHabit: z.enum(SAVE_HABIT),
  budget: z.enum(BUDGET),
  infoSource: z.array(z.enum(INFO_SOURCE)).min(1),
  frequency: z.enum(FREQUENCY),
  searchTime: z.enum(SEARCH_TIME),
  expectedUse: z.number().int().min(0).max(15),
  opinion: z.string().max(2000).optional().default(""),
  // 한국 PIPA + 정보통신망법 동의 항목
  consentPrivacy: z.literal(true),
  consentTerms: z.literal(true),
  consentAge: z.literal(true),
  consentMarketing: z.boolean().optional().default(false),
  consentAnalytics: z.boolean().optional().default(false),
  campaignCode: z.string().max(40).optional().nullable(),
});

export type SignupPayload = z.infer<typeof SignupPayloadSchema>;

export const TrackPayloadSchema = z
  .object({
    type: z.enum(["page_view", "step_complete"]),
    route: z.string().startsWith("/").max(200),
    step: z.number().int().min(1).max(3).optional(),
    campaignCode: z.string().max(40).optional().nullable(),
  })
  .refine((v) => v.type !== "step_complete" || typeof v.step === "number", {
    message: "step is required when type=step_complete",
    path: ["step"],
  });

export const LoginPayloadSchema = z.object({
  password: z.string().min(1).max(200),
});

const NotifyChoiceSchema = z.enum(["A", "B"]);

export const NotifyTasteCreatePayloadSchema = z.object({
  email: z.string().email().max(254),
  choices: z.array(NotifyChoiceSchema).length(10),
  consentPrivacy: z.literal(true),
  characterKey: z.enum([
    "sunny_window",
    "alley_wanderer",
    "city_aesthetic",
    "food_first",
    "night_mood",
    "route_scene",
    "quiet_collector",
    "route_planner",
  ]).optional(),
  referrerShareSlug: z.string().regex(/^nt_[a-zA-Z0-9_-]{8,32}$/).optional().nullable(),
});

export type NotifyTasteCreatePayload = z.infer<typeof NotifyTasteCreatePayloadSchema>;

export const NotifyTasteEventPayloadSchema = z.object({
  eventName: z.enum(["page_view", "choice_complete", "email_submit", "result_view", "share_click", "compatibility_view"]),
  shareSlug: z.string().regex(/^nt_[a-zA-Z0-9_-]{8,32}$/).optional().nullable(),
  referrerShareSlug: z.string().regex(/^nt_[a-zA-Z0-9_-]{8,32}$/).optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({}),
});

export type NotifyTasteEventPayload = z.infer<typeof NotifyTasteEventPayloadSchema>;
