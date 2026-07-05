import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

type Choice = "A" | "B";

export type NotifyTasteCharacterKey =
  | "sunny_window"
  | "alley_wanderer"
  | "city_aesthetic"
  | "food_first"
  | "night_mood"
  | "route_scene";

type LegacyNotifyTasteCharacterKey = "quiet_collector" | "route_planner";
type StoredNotifyTasteCharacterKey = NotifyTasteCharacterKey | LegacyNotifyTasteCharacterKey;
type AxisKey = "quiet" | "day" | "stay" | "wander" | "local" | "city" | "visual" | "food" | "night" | "social" | "route";

export interface NotifyTasteResultRow {
  id: string;
  email: string;
  choices: Choice[];
  character_key: StoredNotifyTasteCharacterKey;
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
  image: string;
  representativeAxes: AxisKey[];
  legacyStorageKey: LegacyNotifyTasteCharacterKey;
}> = {
  sunny_window: {
    key: "sunny_window",
    name: "햇살 아래 오래 앉아있는 사람",
    description: "조용한 창가, 식물, 낮의 공기, 오래 머무는 공간에 끌려요.",
    tags: ["창가", "조용함", "낮"],
    image: "/img/notify-demo/character-quiet.svg",
    representativeAxes: ["quiet", "day", "stay"],
    legacyStorageKey: "quiet_collector",
  },
  alley_wanderer: {
    key: "alley_wanderer",
    name: "골목만 보면 일단 꺾는 사람",
    description: "목적지보다 로컬 골목, 작은 가게, 우연한 발견을 좋아해요.",
    tags: ["골목", "산책", "로컬"],
    image: "/img/notify-demo/character-quiet.svg",
    representativeAxes: ["wander", "local", "quiet"],
    legacyStorageKey: "quiet_collector",
  },
  city_aesthetic: {
    key: "city_aesthetic",
    name: "간판 예쁘면 이미 반쯤 넘어간 사람",
    description: "외관, 편집샵, 트렌디한 거리, 도시적인 장면에 반응해요.",
    tags: ["외관", "트렌디", "도시"],
    image: "/img/notify-demo/character-route.svg",
    representativeAxes: ["city", "visual", "wander"],
    legacyStorageKey: "route_planner",
  },
  food_first: {
    key: "food_first",
    name: "맛없는 감성은 용서 못 하는 사람",
    description: "분위기도 중요하지만 결국 메뉴와 한입의 만족도가 기준이에요.",
    tags: ["맛집", "메뉴", "실패없음"],
    image: "/img/notify-demo/character-route.svg",
    representativeAxes: ["food", "social", "stay"],
    legacyStorageKey: "route_planner",
  },
  night_mood: {
    key: "night_mood",
    name: "조명 어두워지면 취향 살아나는 사람",
    description: "와인바, 낮은 조명, 저녁 대화, 깊은 무드에 끌려요.",
    tags: ["밤", "데이트", "무드"],
    image: "/img/notify-demo/character-quiet.svg",
    representativeAxes: ["night", "social", "visual"],
    legacyStorageKey: "quiet_collector",
  },
  route_scene: {
    key: "route_scene",
    name: "하루를 한 장면으로 엮는 사람",
    description: "카페, 산책, 식사처럼 장소들이 자연스럽게 이어져야 좋아요.",
    tags: ["루트", "동선", "하루"],
    image: "/img/notify-demo/character-route.svg",
    representativeAxes: ["route", "wander", "day"],
    legacyStorageKey: "route_planner",
  },
};

const LEGACY_CHARACTER_ALIASES: Record<LegacyNotifyTasteCharacterKey, NotifyTasteCharacterKey> = {
  quiet_collector: "sunny_window",
  route_planner: "route_scene",
};

const CHARACTER_PRIORITY: NotifyTasteCharacterKey[] = [
  "sunny_window",
  "alley_wanderer",
  "city_aesthetic",
  "food_first",
  "night_mood",
  "route_scene",
];

type OptionScore = {
  characters: Partial<Record<NotifyTasteCharacterKey, number>>;
  axes: Partial<Record<AxisKey, number>>;
};

export const NOTIFY_TASTE_ROUNDS: Array<Record<Choice, OptionScore>> = [
  {
    A: { characters: { sunny_window: 2, alley_wanderer: 1 }, axes: { quiet: 2, day: 1, stay: 1 } },
    B: { characters: { city_aesthetic: 2, route_scene: 1 }, axes: { city: 2, visual: 1, wander: 1 } },
  },
  {
    A: { characters: { sunny_window: 2, food_first: 1 }, axes: { stay: 2, quiet: 1, food: 1 } },
    B: { characters: { alley_wanderer: 2, route_scene: 2 }, axes: { wander: 2, route: 2, local: 1 } },
  },
  {
    A: { characters: { city_aesthetic: 2, sunny_window: 1 }, axes: { visual: 2, city: 1, quiet: 1 } },
    B: { characters: { food_first: 2, night_mood: 1 }, axes: { food: 2, social: 1, stay: 1 } },
  },
  {
    A: { characters: { sunny_window: 2, food_first: 1 }, axes: { day: 2, food: 1, stay: 1 } },
    B: { characters: { night_mood: 2, city_aesthetic: 1 }, axes: { night: 2, social: 1, visual: 1 } },
  },
  {
    A: { characters: { alley_wanderer: 2, sunny_window: 1 }, axes: { local: 2, quiet: 1, wander: 1 } },
    B: { characters: { city_aesthetic: 2, route_scene: 1 }, axes: { visual: 2, city: 1, route: 1 } },
  },
  {
    A: { characters: { sunny_window: 2, alley_wanderer: 1 }, axes: { quiet: 2, stay: 1, local: 1 } },
    B: { characters: { night_mood: 2, food_first: 1 }, axes: { social: 2, food: 1, night: 1 } },
  },
  {
    A: { characters: { alley_wanderer: 2, sunny_window: 1 }, axes: { local: 1, day: 1, quiet: 1 } },
    B: { characters: { city_aesthetic: 2, night_mood: 1 }, axes: { city: 2, visual: 1, night: 1 } },
  },
  {
    A: { characters: { city_aesthetic: 2, night_mood: 1 }, axes: { visual: 2, city: 1, night: 1 } },
    B: { characters: { food_first: 2, route_scene: 1 }, axes: { food: 2, route: 1, stay: 1 } },
  },
  {
    A: { characters: { sunny_window: 2, city_aesthetic: 1 }, axes: { quiet: 1, visual: 1, stay: 1 } },
    B: { characters: { alley_wanderer: 2, route_scene: 1 }, axes: { wander: 2, local: 1, route: 1 } },
  },
  {
    A: { characters: { route_scene: 2, food_first: 1 }, axes: { route: 2, food: 1, day: 1 } },
    B: { characters: { alley_wanderer: 2, city_aesthetic: 1 }, axes: { wander: 2, visual: 1, local: 1 } },
  },
];

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

function addScores<T extends string>(target: Record<T, number>, source: Partial<Record<T, number>>) {
  (Object.entries(source) as Array<[T, number]>).forEach(([key, value]) => {
    target[key] = (target[key] ?? 0) + value;
  });
}

function getStoredCharacter(characterKey: StoredNotifyTasteCharacterKey, characterName?: string | null) {
  const direct = NOTIFY_TASTE_CHARACTERS[characterKey as NotifyTasteCharacterKey];
  if (direct) return direct;

  const byName = Object.values(NOTIFY_TASTE_CHARACTERS).find((character) => character.name === characterName);
  if (byName) return byName;

  return NOTIFY_TASTE_CHARACTERS[LEGACY_CHARACTER_ALIASES[characterKey as LegacyNotifyTasteCharacterKey] ?? "sunny_window"];
}

export function computeCharacter(choices: Choice[]) {
  const characterScores = Object.fromEntries(CHARACTER_PRIORITY.map((key) => [key, 0])) as Record<NotifyTasteCharacterKey, number>;
  const axisScores = {} as Record<AxisKey, number>;
  const recentScores = Object.fromEntries(CHARACTER_PRIORITY.map((key) => [key, 0])) as Record<NotifyTasteCharacterKey, number>;

  choices.slice(0, 10).forEach((choice, index) => {
    const option = NOTIFY_TASTE_ROUNDS[index]?.[choice];
    if (!option) return;
    addScores(characterScores, option.characters);
    addScores(axisScores, option.axes);
    if (index >= 7) addScores(recentScores, option.characters);
  });

  const key = [...CHARACTER_PRIORITY].sort((a, b) => {
    const scoreDiff = characterScores[b] - characterScores[a];
    if (scoreDiff !== 0) return scoreDiff;

    const axisDiff = NOTIFY_TASTE_CHARACTERS[b].representativeAxes.reduce((sum, axis) => sum + (axisScores[axis] ?? 0), 0)
      - NOTIFY_TASTE_CHARACTERS[a].representativeAxes.reduce((sum, axis) => sum + (axisScores[axis] ?? 0), 0);
    if (axisDiff !== 0) return axisDiff;

    const recentDiff = recentScores[b] - recentScores[a];
    if (recentDiff !== 0) return recentDiff;

    return CHARACTER_PRIORITY.indexOf(a) - CHARACTER_PRIORITY.indexOf(b);
  })[0];

  return NOTIFY_TASTE_CHARACTERS[key];
}

export function toLegacyStorageCharacterKey(characterKey: NotifyTasteCharacterKey): LegacyNotifyTasteCharacterKey {
  return NOTIFY_TASTE_CHARACTERS[characterKey].legacyStorageKey;
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
  const character = getStoredCharacter(row.character_key, row.character_name);
  return {
    shareSlug: row.share_slug,
    characterKey: character.key,
    characterName: character.name,
    description: character.description,
    tags: character.tags,
    image: character.image,
  };
}
