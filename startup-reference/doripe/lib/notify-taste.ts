import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

type Choice = "A" | "B";

export type NotifyTasteCharacterKey = "quiet_collector" | "route_planner";

export interface NotifyTasteResultRow {
  id: string;
  email: string;
  choices: Choice[];
  character_key: NotifyTasteCharacterKey;
  character_name: string;
  share_slug: string;
  referrer_share_slug: string | null;
  compatibility_score: number | null;
  compatibility_summary: string | null;
  created_at: string;
}

export const NOTIFY_TASTE_CHARACTERS: Record<NotifyTasteCharacterKey, {
  key: NotifyTasteCharacterKey;
  name: string;
  description: string;
  tags: string[];
}> = {
  quiet_collector: {
    key: "quiet_collector",
    name: "조용한 감도 수집가",
    description: "복잡한 곳보다 오래 머물고 싶은 장면을 먼저 고르는 타입이에요.",
    tags: ["조용함", "감성적인", "동네감"],
  },
  route_planner: {
    key: "route_planner",
    name: "하루 루트 설계자",
    description: "한 곳보다 이어지는 하루의 흐름을 중요하게 보는 타입이에요.",
    tags: ["루트형", "활동적인", "균형감"],
  },
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function createNotifySupabaseClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export function createShareSlug() {
  return `nt_${randomBytes(8).toString("base64url")}`;
}

export function computeCharacter(choices: Choice[]) {
  const bCount = choices.filter((choice) => choice === "B").length;
  const key: NotifyTasteCharacterKey = bCount >= 5 ? "route_planner" : "quiet_collector";
  return NOTIFY_TASTE_CHARACTERS[key];
}

export function computeCompatibility(myChoices: Choice[], friendChoices: Choice[], sameCharacter: boolean) {
  const sameCount = myChoices.reduce((count, choice, index) => (
    count + (choice === friendChoices[index] ? 1 : 0)
  ), 0);
  const raw = 25 + sameCount * 6 + (sameCharacter ? 13 : 0);
  const score = Math.max(40, Math.min(98, raw));
  const summary = score >= 80
    ? "조용한 카페 → 골목 산책 → 작은 디저트샵 조합이 잘 맞아요."
    : score >= 65
      ? "한두 곳은 각자 고르고, 마지막 장소를 같이 정하면 잘 맞아요."
      : "서로 다른 취향을 번갈아 넣으면 새로운 하루가 만들어져요.";
  return { score, summary };
}

export function toPublicResult(row: NotifyTasteResultRow) {
  const character = NOTIFY_TASTE_CHARACTERS[row.character_key];
  return {
    shareSlug: row.share_slug,
    characterKey: row.character_key,
    characterName: row.character_name,
    description: character.description,
    tags: character.tags,
  };
}
