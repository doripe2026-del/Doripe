const EXPECTED_COPY = new Map(Object.entries({
  "hero-proof-score": "92.1%",
  "hero-proof": "초기 설문에서 사용 의향을 보였어요",
  "hero-title": "오늘 어디 갈지, 떠오르는 곳이 없다면.",
  "hero-sub": "검색어가 없어도 괜찮아요. 오늘의 분위기에 맞는 카페, 식당, 술집, 샵을 가볍게 넘겨보세요.",
  "hero-count": "10,000명이 Doripe를 먼저 확인했어요",
  "features-kicker": "Before Doripe",
  "features-title": "이런 적, 있으시지 않나요?",
  "chat-1-meta": "약속 잡기 전",
  "chat-1-text": "😵 오늘 어디 갈지 정해야 하는데, 딱 떠오르는 장소가 없어... 큰일이야 ㅠ_ㅠ",
  "chat-2-meta": "검색창 앞",
  "chat-2-text": "😰 조용하고 아늑한 분위기의 술집을 가고 싶은데, 뭐라고 검색해야 할지 모르겠어 ㅠㅠ",
  "chat-3-meta": "나가기 직전",
  "chat-3-text": "🫠 인스타에 저장한 곳은 많은데, 막상 약속 잡을 때 다시 찾기가 귀찮아...",
  "chat-4-meta": "동선 확인 중",
  "chat-4-text": "😳 마음에 드는 장소를 찾아도, 실제로 내가 오늘 갈 동선에 넣을 수 있을지 잘 모르겠어...",
  "product-kicker": "How it works",
  "product-title": "장소는 발견하고, 고르고, 떠나세요.",
  "product-intro": "Doripe는 단순히 장소를 검색하는 앱이 아니라, 사용자의 취향에 맞는 장소를 발견합니다.",
  "discover-kicker": "Discover",
  "discover-title": "검색어 대신 분위기로 찾아요.",
  "discover-text": "\"성수 카페\"처럼 넓게 검색하지 않고, 나에게 필요한 분위기와 상황에 맞춰 장소를 탐색합니다. 다양한 장소 사진을 먼저 보고, 나의 취향에 맞는 장소만 따로 남길 수 있어요.",
  "save-kicker": "Save",
  "save-title": "나중에 다시 찾기 쉬운 방식으로 저장해요.",
  "save-text": "인스타 저장함이나 지도 핀처럼 쌓이기만 하는 방식에서 벗어나, \"데이트\", \"조용한 술집\", \"혼자 가기 좋은 곳\"처럼 상황 태그와 필터로 다시 찾기 쉽게 정리해요.",
  "go-kicker": "Go",
  "go-title": "나만의 코스를 만들고, 떠나보세요.",
  "go-text": "카페, 식당, 술집까지 이어서 가려면 순서와 동선이 복잡해지기 쉽습니다. Doripe에서는 장소를 지도 위에서 한 번에 보고, 오늘 움직일 동선을 간단하게 정리할 수 있어요.",
  "final-title": "저장해두고 잊고 있던 장소, 가고 싶을 때, 다시 꺼내보세요.",
  "final-sub": "Doripe 베타가 열리면 가장 먼저 알려드릴게요.",
  "final-count": "10,000명이 Doripe를 먼저 확인했어요",
}));

const EXPECTED_NOTIFY_CTAS = [
  { href: "/notify", text: "알림신청" },
  { href: "/notify", text: "알림신청" },
  { href: "/notify", text: "알림신청" },
  { href: "/notify", text: "알림신청" },
];

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function normalizeText(markup) {
  return decodeEntities(
    markup
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, ""),
  ).replace(/\s+/g, " ").trim();
}

function attribute(attributes, name) {
  return attributes.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] ?? null;
}

export function extractProtectedLandingSurface(html) {
  const copyBlocks = [];
  const copyPattern = /<([a-z][a-z0-9-]*)\b([^>]*\bdata-protected-copy="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/gi;
  for (const match of html.matchAll(copyPattern)) {
    copyBlocks.push({ id: match[3], text: normalizeText(match[4]) });
  }

  const notifyCtas = [];
  const ctaPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(ctaPattern)) {
    const href = attribute(match[1], "href");
    if (href !== "/notify") continue;
    notifyCtas.push({
      href,
      text: normalizeText(match[2]),
    });
  }

  return { copyBlocks, notifyCtas };
}

export function assertProtectedLandingSurface(html) {
  const surface = extractProtectedLandingSurface(html);
  const actualCopy = new Map();
  for (const block of surface.copyBlocks) {
    if (actualCopy.has(block.id)) {
      throw new Error(`Protected landing copy has duplicate id: ${block.id}`);
    }
    actualCopy.set(block.id, block.text);
  }

  if (actualCopy.size !== EXPECTED_COPY.size) {
    throw new Error(`Protected landing copy count changed: expected ${EXPECTED_COPY.size}, received ${actualCopy.size}`);
  }
  for (const [id, expected] of EXPECTED_COPY) {
    const actual = actualCopy.get(id);
    if (actual !== expected) {
      throw new Error(`Protected landing copy changed at ${id}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
    }
  }

  if (surface.notifyCtas.length !== EXPECTED_NOTIFY_CTAS.length) {
    throw new Error(`Notify CTA count changed: expected ${EXPECTED_NOTIFY_CTAS.length}, received ${surface.notifyCtas.length}`);
  }
  for (let index = 0; index < EXPECTED_NOTIFY_CTAS.length; index += 1) {
    const expected = EXPECTED_NOTIFY_CTAS[index];
    const actual = surface.notifyCtas[index];
    if (actual.href !== expected.href || actual.text !== expected.text) {
      throw new Error(`Notify CTA changed at index ${index}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
    }
  }

  return surface;
}
