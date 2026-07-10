function freezeItems(items) {
  return Object.freeze(items.map((item) => Object.freeze({
    ...item,
    ...(item.mediaIds ? { mediaIds: Object.freeze([...item.mediaIds]) } : {}),
    ...(item.placeIds ? { placeIds: Object.freeze([...item.placeIds]) } : {}),
    ...(item.tagIds ? { tagIds: Object.freeze([...item.tagIds]) } : {})
  })));
}

export const USERS = freezeItems([
  { id: "user-1", handle: "dori", name: "도리", avatarUrl: "/app-preview/assets/references/e1.png" },
  { id: "user-2", handle: "yeon_", name: "연", avatarUrl: "/app-preview/assets/references/e7.png" },
  { id: "user-3", handle: "minsu", name: "민수", avatarUrl: "/app-preview/assets/references/e7.png" },
  { id: "user-4", handle: "hyejin", name: "혜진", avatarUrl: "/app-preview/assets/references/e7.png" },
  { id: "user-5", handle: "jia", name: "지아", avatarUrl: "/app-preview/assets/references/e7.png" },
  { id: "user-6", handle: "sua", name: "수아", avatarUrl: "/app-preview/assets/references/e7.png" }
]);

export const TAGS = freezeItems([
  { id: "tag-shop-select", name: "소품/셀렉", group: "category" },
  { id: "tag-yeonnam", name: "연남", group: "neighborhood" },
  { id: "tag-western", name: "양식", group: "category" },
  { id: "tag-date", name: "데이트", group: "situation" },
  { id: "tag-quiet", name: "조용함", group: "mood" },
  { id: "tag-brunch", name: "브런치", group: "category" },
  { id: "tag-emotional", name: "감성적인", group: "mood" },
  { id: "tag-restaurant", name: "음식점", group: "category" },
  { id: "tag-healthy", name: "건강한", group: "mood" },
  { id: "tag-cozy", name: "아늑한", group: "mood" },
  { id: "tag-bar", name: "바", group: "category" },
  { id: "tag-cafe", name: "카페", group: "category" },
  { id: "tag-cafe-dessert", name: "카페/디저트", group: "category" },
  { id: "tag-elegant", name: "우아함", group: "mood" },
  { id: "tag-friends", name: "친구랑", group: "situation" },
  { id: "tag-alone", name: "혼자", group: "situation" },
  { id: "tag-family-group", name: "가족/단체", group: "situation" },
  { id: "tag-daytime", name: "낮", group: "time" },
  { id: "tag-afternoon", name: "오후", group: "time" },
  { id: "tag-evening", name: "저녁", group: "time" },
  { id: "tag-night", name: "밤", group: "time" },
  { id: "tag-good-for-talking", name: "대화하기 좋은", group: "mood" },
  { id: "tag-sophisticated", name: "세련된", group: "mood" },
  { id: "tag-bright", name: "밝은", group: "mood" },
  { id: "tag-dark", name: "어두운", group: "mood" },
  { id: "tag-walk-ten-minutes", name: "도보 10분 안", group: "distance" }
]);

const placeSpecs = [
  { id: "place-1", name: "오브젝트 연남", userId: "user-1", tagIds: ["tag-shop-select", "tag-yeonnam", "tag-date", "tag-elegant"], address: "서울 마포구 동교로 243-5", latitude: 37.5624, longitude: 126.9257 },
  { id: "place-2", name: "브런치가든 연남", userId: "user-1", tagIds: ["tag-brunch", "tag-emotional", "tag-afternoon"], address: "서울 마포구 성미산로 161", latitude: 37.5631, longitude: 126.9241 },
  { id: "place-3", name: "플랜트 연남", userId: "user-3", tagIds: ["tag-restaurant", "tag-healthy", "tag-alone"], address: "서울 마포구 동교로 262", latitude: 37.5641, longitude: 126.9261 },
  { id: "place-4", name: "무드키친", userId: "user-2", tagIds: ["tag-western", "tag-cozy", "tag-date", "tag-night"], address: "서울 마포구 연희로1길 57", latitude: 37.5614, longitude: 126.9274 },
  { id: "place-5", name: "연남 라운지", userId: "user-4", tagIds: ["tag-bar", "tag-quiet", "tag-good-for-talking"], address: "서울 마포구 동교로38길 27", latitude: 37.5638, longitude: 126.9232 },
  { id: "place-6", name: "그린테이블", userId: "user-1", tagIds: ["tag-cafe", "tag-alone", "tag-bright"], address: "서울 마포구 성미산로29길 35", latitude: 37.5652, longitude: 126.9252 },
  { id: "place-7", name: "리틀넬 연남", userId: "user-2", tagIds: ["tag-restaurant", "tag-date", "tag-evening"], address: "서울 마포구 동교로46길 42", latitude: 37.5657, longitude: 126.9272 },
  { id: "place-8", name: "카페 노티드", userId: "user-5", tagIds: ["tag-cafe-dessert", "tag-friends", "tag-daytime"], address: "서울 마포구 연희로 11", latitude: 37.5598, longitude: 126.9268 },
  { id: "place-9", name: "연남방앗간", userId: "user-6", tagIds: ["tag-cafe", "tag-sophisticated", "tag-afternoon"], address: "서울 마포구 동교로29길 34", latitude: 37.5619, longitude: 126.9219 },
  { id: "place-10", name: "포털로빈", userId: "user-3", tagIds: ["tag-western", "tag-family-group", "tag-good-for-talking"], address: "서울 마포구 연남로 15", latitude: 37.5629, longitude: 126.9227 },
  { id: "place-11", name: "소이연남", userId: "user-4", tagIds: ["tag-restaurant", "tag-friends", "tag-bright"], address: "서울 마포구 동교로 267", latitude: 37.5645, longitude: 126.9264 },
  { id: "place-12", name: "앤티크 커피", userId: "user-5", tagIds: ["tag-cafe-dessert", "tag-dark", "tag-walk-ten-minutes"], address: "서울 마포구 연희로 25", latitude: 37.5609, longitude: 126.9281 }
];

const referenceScreens = ["b4", "b5", "b6", "b7", "b10", "c3", "c4", "d6", "d8", "d9", "d12", "d14"];

export const MEDIA = freezeItems(placeSpecs.flatMap((place, placeIndex) => (
  [0, 1, 2].map((offset) => {
    const mediaNumber = placeIndex * 3 + offset + 1;
    return {
      id: `media-${mediaNumber}`,
      placeId: place.id,
      userId: USERS[(placeIndex + offset) % USERS.length].id,
      kind: offset === 2 && placeIndex % 3 === 0 ? "video" : "photo",
      src: `/app-preview/assets/references/${referenceScreens[placeIndex]}.png`,
      alt: `${place.name} ${offset + 1}`,
      createdAt: `2026-06-${String((placeIndex * 2 + offset) % 28 + 1).padStart(2, "0")}T09:00:00.000Z`
    };
  })
)));

export const PLACES = freezeItems(placeSpecs.map((place, placeIndex) => ({
  ...place,
  mediaIds: [1, 2, 3].map((offset) => `media-${placeIndex * 3 + offset}`),
  summary: `${place.name}에서 보내는 취향에 맞는 시간`,
  walkingMinutes: 4 + (placeIndex % 7),
  savedCount: 18 + placeIndex * 3
})));

export const COMMENTS = freezeItems([
  { id: "comment-1", placeId: "place-1", userId: "user-3", body: "공간이 정말 예쁘고 소품 하나하나 취향 저격이에요!", likeCount: 12, createdAt: "2026-07-08T10:00:00.000Z" },
  { id: "comment-2", placeId: "place-1", userId: "user-2", body: "조용하고 편안해서 책 읽기 좋아요.", likeCount: 8, createdAt: "2026-07-05T13:00:00.000Z" },
  { id: "comment-3", placeId: "place-2", userId: "user-1", body: "브런치 메뉴와 정원 분위기가 잘 어울려요.", likeCount: 6, createdAt: "2026-07-04T09:30:00.000Z" },
  { id: "comment-4", placeId: "place-4", userId: "user-4", body: "저녁 데이트 장소로 다시 오고 싶어요.", likeCount: 9, createdAt: "2026-07-03T18:20:00.000Z" },
  { id: "comment-5", placeId: "place-6", userId: "user-5", body: "혼자 앉기 좋은 자리가 많아서 편했어요.", likeCount: 4, createdAt: "2026-07-02T11:10:00.000Z" },
  { id: "comment-6", placeId: "place-8", userId: "user-6", body: "디저트가 예쁘고 친구와 이야기하기 좋아요.", likeCount: 7, createdAt: "2026-07-01T15:45:00.000Z" }
]);

export const ROUTES = freezeItems([
  { id: "route-1", name: "연남 저녁 데이트 루트", userId: "user-1", placeIds: ["place-1", "place-7", "place-8"], tagIds: ["tag-date", "tag-evening", "tag-emotional"], walkingMinutes: 40 },
  { id: "route-2", name: "조용한 연남 오후", userId: "user-2", placeIds: ["place-6", "place-2", "place-12"], tagIds: ["tag-quiet", "tag-afternoon", "tag-cafe"], walkingMinutes: 32 },
  { id: "route-3", name: "친구와 맛집 산책", userId: "user-4", placeIds: ["place-3", "place-10", "place-11"], tagIds: ["tag-friends", "tag-restaurant", "tag-walk-ten-minutes"], walkingMinutes: 46 }
]);
