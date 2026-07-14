const EXPECTED_COPY = new Map(Object.entries({
  "hero-proof-score": "92.1%",
  "hero-proof": "초기 설문에서 사용 의향을 보였어요",
  "hero-title": "감도 높은 사진에서, 오늘 갈 곳을 발견하세요.",
  "hero-sub": "내 취향에 맞는 장소를 고르고, 가까운 장소를 이어 나만의 하루를 만들어보세요.",
  "features-kicker": "Before Doripe",
  "features-title": "이런 적, 있으시지 않나요?",
  "chat-1-meta": "장소를 찾다가",
  "chat-1-text": "“글보다 사진과 영상으로 분위기를 먼저 보고 싶어요.”",
  "chat-2-meta": "식당을 정한 뒤",
  "chat-2-text": "“밥 먹고 갈 카페와 놀 거리도 따로 찾아야 해요.”",
  "chat-3-meta": "감도 높은 큐레이터를 보다가",
  "chat-3-text": "“큐레이터가 고른 장소와 하루 코스를 따라가고 싶어요.”",
  "product-kicker": "How it works",
  "product-title": "발견한 장소가, 오늘의 코스가 되는 순간.",
  "product-intro": "유저와 큐레이터가 올린 사진에서 장소를 발견하고, 가까운 장소를 이어 친구와 공유할 수 있어요.",
  "discover-kicker": "INSPIRE",
  "discover-title": "누군가의 취향에서 시작해요.",
  "discover-text": "친구와 큐레이터가 올린 사진과 영상을 넘겨보며, 검색어 없이도 내 취향에 맞는 공간을 발견해요.",
  "save-kicker": "EXPLORE",
  "save-title": "가까운 장소들을 함께 골라요.",
  "save-text": "마음에 든 장소를 고르면, 주변에서 함께 가기 좋은 식당·카페·놀거리를 취향에 맞춰 추천해요.",
  "go-kicker": "SHARE",
  "go-title": "세 곳이 모여 하나의 하루가 돼요.",
  "go-text": "선택한 장소들을 하나의 코스로 묶고, 친구에게 공유해 함께 저장하고 반응할 수 있어요.",
  "final-title": "가고 싶은 한 장소를, 오늘의 코스로 이어보세요.",
  "final-sub": "Doripe 베타가 열리면 가장 먼저 알려드릴게요.",
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
