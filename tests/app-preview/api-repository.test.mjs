import assert from "node:assert/strict";
import test from "node:test";

import { createApiRepository } from "../../public/app-preview/data/api-repository.js";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

const profile = {
  id: "11111111-1111-4111-8111-111111111111",
  nickname: "도리",
  introduction: "서울의 좋은 장소를 모아요",
  profileImageUrl: "https://images.example/dori.jpg",
  isCurator: true,
  officialBadge: true,
  followedByMe: false,
  followerCount: 12
};

const place = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "오브젝트 연남",
  shortCopy: "취향이 머무는 소품숍",
  neighborhoodId: "33333333-3333-4333-8333-333333333333",
  address: "서울 마포구 동교로 243-5",
  nearestStation: "홍대입구역",
  latitude: 37.5624,
  longitude: 126.9257,
  category: { id: "category-shop", name: "소품/체험", displayOrder: 1 },
  tags: [{ id: "tag-date", kind: "situation", name: "데이트" }],
  moodTags: ["감성적인"],
  bestFor: ["데이트"],
  timeTags: ["오후"],
  media: [{
    id: "44444444-4444-4444-8444-444444444444",
    kind: "image",
    url: "https://images.example/object.jpg",
    thumbnailUrl: null,
    position: 0,
    rightsStatus: "approved",
    placeId: "22222222-2222-4222-8222-222222222222"
  }],
  status: "published",
  updatedAt: "2026-07-15T00:00:00.000Z"
};

const content = {
  id: "55555555-5555-4555-8555-555555555555",
  type: "place",
  author: profile,
  caption: "오늘 발견한 곳",
  placeIds: [place.id],
  courseId: null,
  media: place.media,
  status: "published",
  version: 1,
  likedByMe: false,
  likeCount: 3,
  commentCount: 0,
  createdAt: "2026-07-15T00:00:00.000Z",
  updatedAt: "2026-07-15T00:00:00.000Z",
  publishedAt: "2026-07-15T00:00:00.000Z"
};

const courseOnlyPlace = {
  ...place,
  id: "77777777-7777-4777-8777-777777777777",
  name: "포멜로빈",
  media: [{
    ...place.media[0],
    id: "88888888-8888-4888-8888-888888888888",
    placeId: "77777777-7777-4777-8777-777777777777",
    url: "https://images.example/pomelobin.jpg"
  }]
};

const course = {
  id: "66666666-6666-4666-8666-666666666666",
  ownerId: profile.id,
  name: "연남 산책 코스",
  visibility: "private",
  version: 1,
  totalTravelMinutes: 25,
  places: [
    { id: "course-place-1", placeId: place.id, position: 1 },
    { id: "course-place-2", placeId: courseOnlyPlace.id, position: 2 }
  ]
};

test("API bootstrap is translated into the flat preview data contract", async () => {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url) === "/api/v1/bootstrap") {
      return jsonResponse({ data: {
        regions: [{ id: place.neighborhoodId, name: "연남", enabled: true }],
        categories: [place.category],
        tags: place.tags,
        featureFlags: { videoUpload: false, contentShare: true },
        contractVersions: { api: "v1", onboarding: 1, notifications: 1, analytics: 1 }
      }, meta: { requestId: "request-bootstrap" } });
    }
    if (String(url).startsWith("/api/v1/feed?")) {
      return jsonResponse({ data: { items: [content] }, meta: { requestId: "request-feed", nextCursor: null } });
    }
    if (String(url) === `/api/v1/places/${place.id}`) {
      return jsonResponse({ data: place, meta: { requestId: "request-place" } });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const repository = createApiRepository({ fetchImpl, storage: memoryStorage() });
  const snapshot = await repository.getBootstrap();

  assert.equal(repository.mode, "api");
  assert.equal(snapshot.contents[0].id, content.id);
  assert.equal(snapshot.contents[0].authorProfileId, profile.id);
  assert.equal(snapshot.places[0].name, place.name);
  assert.deepEqual(snapshot.places[0].mediaIds, [place.media[0].id]);
  assert.equal(snapshot.media[0].src, place.media[0].url);
  assert.equal(snapshot.profiles[0].officialBadge, true);
  assert.equal(snapshot.tags.some((tag) => tag.name === "소품/체험"), true);
  assert.equal(requests.some((request) => request.url.includes("fixtures")), false);
});

test("an empty API feed stays empty and never becomes fixture content", async () => {
  const fetchImpl = async (url) => {
    if (String(url) === "/api/v1/bootstrap") {
      return jsonResponse({ data: {
        regions: [], categories: [], tags: [],
        featureFlags: { videoUpload: false, contentShare: false },
        contractVersions: { api: "v1", onboarding: 1, notifications: 1, analytics: 1 }
      }, meta: { requestId: "request-bootstrap" } });
    }
    return jsonResponse({ data: { items: [] }, meta: { requestId: "request-feed", nextCursor: null } });
  };

  const snapshot = await createApiRepository({ fetchImpl, storage: memoryStorage() }).getBootstrap();

  assert.deepEqual(snapshot.places, []);
  assert.deepEqual(snapshot.contents, []);
  assert.deepEqual(snapshot.media, []);
  assert.equal(snapshot.personalDataLoaded, false);
  assert.deepEqual(snapshot.savedPlaceIds, []);
  assert.deepEqual(snapshot.savedCourseIds, []);
});

test("filtered feed snapshots use stable UUID query ordering and preserve bootstrap tag keys", async () => {
  const tagDateId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const tagQuietId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const nextContent = {
    ...content,
    id: "99999999-9999-4999-8999-999999999999",
    placeIds: [courseOnlyPlace.id],
    media: courseOnlyPlace.media
  };
  const requests = [];
  const filteredPath = "/api/v1/feed?scope=discover&limit=50&tagIds=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa%2Cbbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb&centerLat=37.5&centerLng=126.9&radiusKm=2.5";
  const nextPagePath = `${filteredPath}&cursor=next-page`;
  const repository = createApiRepository({
    fetchImpl: async (url) => {
      const requestUrl = String(url);
      requests.push(requestUrl);
      if (requestUrl === "/api/v1/bootstrap") {
        return jsonResponse({ data: {
          regions: [], categories: [], tags: [
            { id: tagDateId, key: "date", kind: "situation", name: "데이트" },
            { id: tagQuietId, key: "quiet", kind: "mood", name: "조용함" }
          ], featureFlags: {}, contractVersions: {}
        } });
      }
      if (requestUrl === filteredPath) {
        return jsonResponse({ data: { items: [content] }, meta: { nextCursor: "next-page" } });
      }
      if (requestUrl === nextPagePath) {
        return jsonResponse({ data: { items: [nextContent] }, meta: { nextCursor: null } });
      }
      if (requestUrl === `/api/v1/places/${place.id}`) return jsonResponse({ data: place });
      if (requestUrl === `/api/v1/places/${courseOnlyPlace.id}`) return jsonResponse({ data: courseOnlyPlace });
      throw new Error(`Unexpected request: ${url}`);
    },
    storage: memoryStorage()
  });

  const snapshot = await repository.getFeedSnapshot({
    tagIds: [tagQuietId, tagDateId, tagQuietId],
    centerLat: 37.5,
    centerLng: 126.9,
    radiusKm: 2.5,
    limit: 99
  });

  assert.deepEqual(requests.slice(0, 2), ["/api/v1/bootstrap", filteredPath]);
  assert.deepEqual(snapshot.contents.map((item) => item.id), [content.id]);
  assert.equal(snapshot.tags.find((tag) => tag.id === tagDateId)?.key, "date");
  assert.equal(snapshot.feedNextCursor, "next-page");

  const nextPage = await repository.getFeedSnapshot({
    tagIds: [tagDateId, tagQuietId],
    centerLat: 37.5,
    centerLng: 126.9,
    radiusKm: 2.5,
    cursor: snapshot.feedNextCursor
  });

  assert.equal(requests.includes(nextPagePath), true);
  assert.deepEqual(nextPage.contents.map((item) => item.id), [nextContent.id]);
  assert.equal(nextPage.feedNextCursor, null);
});

test("an empty filtered snapshot stays empty without replacing the persisted bootstrap fallback", async () => {
  const storage = memoryStorage();
  const repository = createApiRepository({
    fetchImpl: async (url) => {
      const requestUrl = String(url);
      if (requestUrl === "/api/v1/bootstrap") {
        return jsonResponse({ data: {
          regions: [], categories: [], tags: [], featureFlags: {}, contractVersions: {}
        } });
      }
      if (requestUrl === "/api/v1/feed?scope=discover&limit=50") {
        return jsonResponse({ data: { items: [content] }, meta: { nextCursor: null } });
      }
      if (requestUrl === `/api/v1/places/${place.id}`) return jsonResponse({ data: place });
      if (requestUrl.startsWith("/api/v1/feed?scope=discover&limit=50&tagIds=")) {
        return jsonResponse({ data: { items: [] }, meta: { nextCursor: null } });
      }
      throw new Error(`Unexpected request: ${url}`);
    },
    storage
  });

  await repository.getBootstrap();
  const cachedBootstrap = storage.getItem("doripe.app_preview.api_snapshot.v1");
  const filtered = await repository.getFeedSnapshot({ tagIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"] });

  assert.deepEqual(filtered.contents, []);
  assert.deepEqual(filtered.places, []);
  assert.equal(storage.getItem("doripe.app_preview.api_snapshot.v1"), cachedBootstrap);
});

test("feed snapshots forward the requested Discover or Following scope", async () => {
  const requests = [];
  const repository = createApiRepository({
    fetchImpl: async (url) => {
      const requestUrl = String(url);
      requests.push(requestUrl);
      if (requestUrl === "/api/v1/bootstrap") {
        return jsonResponse({ data: {
          regions: [], categories: [], tags: [], featureFlags: {}, contractVersions: {}
        } });
      }
      if (requestUrl === "/api/v1/feed?scope=discover&limit=50") {
        return jsonResponse({ data: { items: [] }, meta: { nextCursor: null } });
      }
      if (requestUrl === "/api/v1/feed?scope=following&limit=50") {
        return jsonResponse({ data: { items: [] }, meta: { nextCursor: null } });
      }
      throw new Error(`Unexpected request: ${url}`);
    },
    storage: memoryStorage()
  });

  await repository.getBootstrap();
  await repository.getFeedSnapshot({ scope: "following" });

  assert.equal(requests.includes("/api/v1/feed?scope=following&limit=50"), true);
});

test("authenticated bootstrap restores private profile and saved items without caching them publicly", async () => {
  const requests = [];
  const storage = memoryStorage();
  const fetchImpl = async (url) => {
    const requestUrl = String(url);
    requests.push(requestUrl);
    if (requestUrl === "/api/v1/bootstrap") {
      return jsonResponse({ data: {
        regions: [], categories: [place.category], tags: place.tags,
        featureFlags: {}, contractVersions: {}
      } });
    }
    if (requestUrl.startsWith("/api/v1/feed?")) {
      return jsonResponse({ data: { items: [] }, meta: { nextCursor: null } });
    }
    if (requestUrl === "/api/v1/me/profile") return jsonResponse({ data: profile });
    if (requestUrl === "/api/v1/me/saves?targetType=place&limit=50") {
      return jsonResponse({ data: { items: [{ targetType: "place", targetId: place.id, target: null }] } });
    }
    if (requestUrl === "/api/v1/me/saves?targetType=course&limit=50") {
      return jsonResponse({ data: { items: [{ targetType: "course", targetId: course.id, target: null }] } });
    }
    if (requestUrl === "/api/v1/courses?limit=50") {
      return jsonResponse({ data: { items: [course] }, meta: { nextCursor: null } });
    }
    if (requestUrl === `/api/v1/places/${place.id}`) return jsonResponse({ data: place });
    if (requestUrl === `/api/v1/places/${courseOnlyPlace.id}`) return jsonResponse({ data: courseOnlyPlace });
    if (requestUrl === `/api/v1/courses/${course.id}`) return jsonResponse({ data: course });
    throw new Error(`Unexpected request: ${url}`);
  };

  const snapshot = await createApiRepository({
    fetchImpl,
    storage,
    accessTokenProvider: () => "current-access-token"
  }).getBootstrap();

  assert.equal(snapshot.personalDataLoaded, true);
  assert.equal(snapshot.viewerProfileId, profile.id);
  assert.deepEqual(snapshot.savedPlaceIds, [place.id]);
  assert.deepEqual(snapshot.savedCourseIds, [course.id]);
  assert.deepEqual(snapshot.ownedCourseIds, [course.id]);
  assert.equal(snapshot.profiles.some((item) => item.id === profile.id), true);
  assert.equal(snapshot.places.some((item) => item.id === place.id), true);
  assert.equal(snapshot.places.some((item) => item.id === courseOnlyPlace.id), true);
  assert.equal(snapshot.courses.some((item) => item.id === course.id), true);
  assert.equal(requests.includes(`/api/v1/places/${courseOnlyPlace.id}`), true);
  assert.equal(requests.includes("/api/v1/me/profile"), true);
  assert.equal(requests.includes("/api/v1/courses?limit=50"), true);

  const publicCache = JSON.parse(storage.getItem("doripe.app_preview.api_snapshot.v1"));
  assert.equal(publicCache.snapshot.personalDataLoaded, false);
  assert.equal(publicCache.snapshot.viewerProfileId, null);
  assert.deepEqual(publicCache.snapshot.savedPlaceIds, []);
  assert.deepEqual(publicCache.snapshot.savedCourseIds, []);
  assert.deepEqual(publicCache.snapshot.profiles, []);
});

test("authenticated bootstrap follows every cursor page for owned courses", async () => {
  const requests = [];
  const firstCourse = { ...course, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", places: [] };
  const secondCourse = { ...course, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", places: [] };
  const fetchImpl = async (url) => {
    const requestUrl = String(url);
    requests.push(requestUrl);
    if (requestUrl === "/api/v1/bootstrap") {
      return jsonResponse({ data: { regions: [], categories: [], tags: [], featureFlags: {}, contractVersions: {} } });
    }
    if (requestUrl.startsWith("/api/v1/feed?")) {
      return jsonResponse({ data: { items: [] }, meta: { nextCursor: null } });
    }
    if (requestUrl === "/api/v1/me/profile") return jsonResponse({ data: profile });
    if (requestUrl.startsWith("/api/v1/me/saves?")) {
      return jsonResponse({ data: { items: [] }, meta: { nextCursor: null } });
    }
    if (requestUrl === "/api/v1/courses?limit=50") {
      return jsonResponse({ data: { items: [firstCourse] }, meta: { nextCursor: "owned-next" } });
    }
    if (requestUrl === "/api/v1/courses?limit=50&cursor=owned-next") {
      return jsonResponse({ data: { items: [secondCourse] }, meta: { nextCursor: null } });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const snapshot = await createApiRepository({
    fetchImpl,
    storage: memoryStorage(),
    accessTokenProvider: () => "current-access-token"
  }).getBootstrap();

  assert.deepEqual(snapshot.ownedCourseIds, [firstCourse.id, secondCourse.id]);
  assert.equal(snapshot.courses.some((item) => item.id === secondCourse.id), true);
  assert.equal(requests.includes("/api/v1/courses?limit=50&cursor=owned-next"), true);
});

test("public cache strips personalized feed likes and follows", async () => {
  const storage = memoryStorage();
  const author = {
    ...profile,
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    followedByMe: true
  };
  const personalizedContent = { ...content, author, likedByMe: true };
  const fetchImpl = async (url) => {
    const requestUrl = String(url);
    if (requestUrl === "/api/v1/bootstrap") {
      return jsonResponse({ data: { regions: [], categories: [], tags: [], featureFlags: {}, contractVersions: {} } });
    }
    if (requestUrl.startsWith("/api/v1/feed?")) {
      return jsonResponse({ data: { items: [personalizedContent] }, meta: { nextCursor: null } });
    }
    if (requestUrl === `/api/v1/places/${place.id}`) return jsonResponse({ data: place });
    if (requestUrl === "/api/v1/me/profile") return jsonResponse({ data: profile });
    if (requestUrl.startsWith("/api/v1/me/saves?")) {
      return jsonResponse({ data: { items: [] }, meta: { nextCursor: null } });
    }
    if (requestUrl === "/api/v1/courses?limit=50") {
      return jsonResponse({ data: { items: [] }, meta: { nextCursor: null } });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const snapshot = await createApiRepository({
    fetchImpl,
    storage,
    accessTokenProvider: () => "current-access-token"
  }).getBootstrap();
  assert.equal(snapshot.contents[0].likedByMe, true);
  assert.equal(snapshot.profiles.find((item) => item.id === author.id).followedByMe, true);

  const publicCache = JSON.parse(storage.getItem("doripe.app_preview.api_snapshot.v1"));
  assert.equal(publicCache.snapshot.contents[0].likedByMe, false);
  assert.equal(publicCache.snapshot.profiles.find((item) => item.id === author.id).followedByMe, false);
  assert.equal(publicCache.snapshot.viewerProfileId, null);
  assert.equal(publicCache.snapshot.personalDataLoaded, false);
});

test("signed-out public reads never reuse personalized in-memory feed or profile data", async () => {
  let accessToken = "current-access-token";
  const requests = [];
  const personalizedAuthor = {
    ...profile,
    followedByMe: true
  };
  const personalizedContent = {
    ...content,
    author: personalizedAuthor,
    likedByMe: true
  };
  const publicContent = {
    ...personalizedContent,
    author: { ...personalizedAuthor, followedByMe: false },
    likedByMe: false
  };
  const repository = createApiRepository({
    fetchImpl: async (url, options = {}) => {
      const authenticated = Boolean(options.headers?.authorization);
      requests.push({ url: String(url), authenticated });
      if (String(url).startsWith("/api/v1/feed?")) {
        return jsonResponse({ data: { items: [authenticated ? personalizedContent : publicContent] } });
      }
      if (String(url) === `/api/v1/profiles/${profile.id}`) {
        return jsonResponse({ data: authenticated
          ? personalizedAuthor
          : { ...personalizedAuthor, followedByMe: false } });
      }
      throw new Error(`Unexpected request: ${url}`);
    },
    storage: memoryStorage(),
    accessTokenProvider: () => accessToken
  });

  assert.equal((await repository.getFeed())[0].likedByMe, true);
  assert.equal((await repository.getPublicProfile(profile.id)).followedByMe, true);

  accessToken = null;

  assert.equal((await repository.getFeed())[0].likedByMe, false);
  assert.equal((await repository.getPublicProfile(profile.id)).followedByMe, false);
  assert.deepEqual(requests.map((request) => request.authenticated), [true, true, false, false]);
});

test("the last successful API snapshot is used only after a later network failure", async () => {
  const storage = memoryStorage();
  let online = true;
  const fetchImpl = async (url) => {
    if (!online) throw new TypeError("offline");
    if (String(url) === "/api/v1/bootstrap") {
      return jsonResponse({ data: {
        regions: [], categories: [place.category], tags: place.tags,
        featureFlags: { videoUpload: false, contentShare: false },
        contractVersions: { api: "v1", onboarding: 1, notifications: 1, analytics: 1 }
      }, meta: { requestId: "request-bootstrap" } });
    }
    if (String(url).startsWith("/api/v1/feed?")) {
      return jsonResponse({ data: { items: [content] }, meta: { requestId: "request-feed", nextCursor: null } });
    }
    return jsonResponse({ data: place, meta: { requestId: "request-place" } });
  };
  const repository = createApiRepository({ fetchImpl, storage });
  const fresh = await repository.getBootstrap();
  online = false;

  const cached = await repository.getBootstrap();

  assert.equal(cached.places[0].id, fresh.places[0].id);
  assert.equal(repository.getLastLoadSource(), "cache");
});

test("authenticated mutations attach the current bearer token", async () => {
  const requests = [];
  const repository = createApiRepository({
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return jsonResponse({ data: { targetType: "place", targetId: place.id, saved: true }, meta: { requestId: "request-save" } }, 201);
    },
    storage: memoryStorage(),
    accessTokenProvider: () => "current-access-token"
  });

  await repository.savePlace(place.id);

  assert.equal(requests[0].url, `/api/v1/me/saves/place/${place.id}`);
  assert.equal(requests[0].options.method, "PUT");
  assert.equal(requests[0].options.headers.authorization, "Bearer current-access-token");
});

test("public reads include optional user context when a session exists", async () => {
  const requests = [];
  const repository = createApiRepository({
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return jsonResponse({ data: place });
    },
    storage: memoryStorage(),
    accessTokenProvider: () => "current-access-token"
  });

  await repository.getPlaceDetail(place.id);

  assert.equal(requests[0].options.headers.authorization, "Bearer current-access-token");
});

test("public reads remain anonymous when no session exists", async () => {
  const requests = [];
  const repository = createApiRepository({
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return jsonResponse({ data: place });
    },
    storage: memoryStorage(),
    accessTokenProvider: () => null
  });

  await repository.getPlaceDetail(place.id);

  assert.equal(requests[0].options.headers.authorization, undefined);
});

test("place snapshots preserve detail media and taxonomy for shared deep links", async () => {
  const repository = createApiRepository({
    fetchImpl: async () => jsonResponse({ data: place }),
    storage: memoryStorage()
  });

  const snapshot = await repository.getPlaceSnapshot(place.id);

  assert.deepEqual(snapshot.places.map((item) => item.id), [place.id]);
  assert.deepEqual(snapshot.media.map((item) => item.id), [place.media[0].id]);
  assert.equal(snapshot.tags.some((item) => item.name === "데이트"), true);
  assert.equal(snapshot.tags.some((item) => item.name === "소품/체험"), true);
});

test("course snapshots hydrate every referenced place for shared route links", async () => {
  const requested = [];
  const repository = createApiRepository({
    fetchImpl: async (url) => {
      requested.push(String(url));
      if (String(url) === `/api/v1/courses/${course.id}`) return jsonResponse({ data: course });
      if (String(url) === `/api/v1/profiles/${profile.id}`) return jsonResponse({ data: profile });
      if (String(url) === `/api/v1/places/${place.id}`) return jsonResponse({ data: place });
      if (String(url) === `/api/v1/places/${courseOnlyPlace.id}`) return jsonResponse({ data: courseOnlyPlace });
      throw new Error(`Unexpected request: ${url}`);
    },
    storage: memoryStorage()
  });

  const snapshot = await repository.getCourseSnapshot(course.id);

  assert.deepEqual(snapshot.courses.map((item) => item.id), [course.id]);
  assert.deepEqual(snapshot.places.map((item) => item.id), [place.id, courseOnlyPlace.id]);
  assert.deepEqual(snapshot.courses[0].placeIds, [place.id, courseOnlyPlace.id]);
  assert.deepEqual(snapshot.profiles.map((item) => item.id), [profile.id]);
  assert.equal(requested.length, 4);
});

test("create mutations send an idempotency key", async () => {
  const requests = [];
  const repository = createApiRepository({
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return jsonResponse({
        data: {
          id: "comment-1",
          contentId: "content-1",
          author: { id: "profile-1", nickname: "도리" },
          text: "댓글",
          likeCount: 0,
          createdAt: "2026-07-16T00:00:00.000Z"
        }
      }, 201);
    },
    storage: memoryStorage(),
    accessTokenProvider: () => "current-access-token"
  });

  await repository.createComment("content-1", "댓글");

  assert.match(requests[0].options.headers["idempotency-key"], /^[A-Za-z0-9_-]{8,80}$/u);
});

test("callers can reuse a stable idempotency key while migrating guest writes", async () => {
  const requests = [];
  const repository = createApiRepository({
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return jsonResponse({
        data: {
          id: "comment-1",
          contentId: "content-1",
          author: { id: "profile-1", nickname: "도리" },
          text: "댓글",
          likeCount: 0,
          createdAt: "2026-07-16T00:00:00.000Z"
        }
      }, 201);
    },
    storage: memoryStorage(),
    accessTokenProvider: () => "current-access-token"
  });

  await repository.createComment("content-1", "댓글", { idempotencyKey: "guest_comment_content_1_0001" });

  assert.equal(requests[0].options.headers["idempotency-key"], "guest_comment_content_1_0001");
});

test("profile and onboarding writes use their authenticated API contracts", async () => {
  const requests = [];
  const repository = createApiRepository({
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return String(url).endsWith("/me/profile")
        ? jsonResponse({ data: {
            id: "profile-1",
            nickname: "새도리",
            introduction: "서울을 기록해요",
            profileImageUrl: null,
            isCurator: false,
            officialBadge: false,
            followedByMe: false,
            followerCount: 0
          } })
        : jsonResponse({ data: { id: "profile-1", status: "completed", version: 1 } });
    },
    storage: memoryStorage(),
    accessTokenProvider: () => "current-access-token"
  });

  const profile = await repository.updateMyProfile({ nickname: "새도리", introduction: "서울을 기록해요" });
  const onboarding = await repository.putMyOnboarding({
    birthYear: 2000,
    gender: "female",
    nickname: "새도리",
    discoveryHabit: "instagram-saved",
    neighborhoodIds: [],
    placeTypeTagIds: [],
    situationTagIds: [],
    referralSource: "instagram"
  });

  assert.equal(profile.name, "새도리");
  assert.equal(onboarding.status, "completed");
  assert.deepEqual(requests.map(({ url, options }) => [url, options.method]), [
    ["/api/v1/me/profile", "PATCH"],
    ["/api/v1/me/onboarding", "PUT"]
  ]);
});

test("an authenticated 401 refreshes once and retries with the same idempotency key", async () => {
  const requests = [];
  let accessToken = "expired-access-token";
  let refreshCalls = 0;
  const repository = createApiRepository({
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      if (requests.length === 1) {
        return jsonResponse({ error: { code: "unauthorized", message: "expired" } }, 401);
      }
      return jsonResponse({ data: { targetType: "place", targetId: place.id, saved: true } }, 201);
    },
    storage: memoryStorage(),
    accessTokenProvider: () => accessToken,
    refreshAccessToken: async () => {
      refreshCalls += 1;
      accessToken = "rotated-access-token";
      return { ok: true, status: "authenticated" };
    }
  });

  await repository.savePlace(place.id);

  assert.equal(refreshCalls, 1);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.headers.authorization, "Bearer expired-access-token");
  assert.equal(requests[1].options.headers.authorization, "Bearer rotated-access-token");
  assert.equal(
    requests[1].options.headers["idempotency-key"],
    requests[0].options.headers["idempotency-key"]
  );
});

test("a second authenticated 401 clears the rejected session without looping", async () => {
  let accessToken = "expired-access-token";
  let requests = 0;
  let unauthorizedCalls = 0;
  const repository = createApiRepository({
    fetchImpl: async () => {
      requests += 1;
      return jsonResponse({ error: { code: "unauthorized", message: "rejected" } }, 401);
    },
    storage: memoryStorage(),
    accessTokenProvider: () => accessToken,
    refreshAccessToken: async () => {
      accessToken = "also-rejected-access-token";
      return { ok: true, status: "authenticated" };
    },
    onUnauthorized: () => { unauthorizedCalls += 1; }
  });

  await assert.rejects(repository.savePlace(place.id), (error) => error.status === 401);

  assert.equal(requests, 2);
  assert.equal(unauthorizedCalls, 1);
});

test("comment like and delete use the documented endpoints", async () => {
  const requests = [];
  const repository = createApiRepository({
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return jsonResponse({ data: { ok: true } });
    },
    storage: memoryStorage(),
    accessTokenProvider: () => "current-access-token"
  });

  await repository.likeComment("comment-1");
  await repository.deleteComment("comment-1");

  assert.deepEqual(requests.map(({ url, options }) => [url, options.method]), [
    ["/api/v1/comments/comment-1/like", "POST"],
    ["/api/v1/comments/comment-1", "DELETE"]
  ]);
});

test("bootstrap limits concurrent place and course detail requests", async () => {
  const places = Array.from({ length: 8 }, (_, index) => ({
    ...place,
    id: `place-${index + 1}`,
    media: []
  }));
  const feed = places.map((item, index) => ({
    ...content,
    id: `content-${index + 1}`,
    placeIds: [item.id],
    media: []
  }));
  let activeDetails = 0;
  let maxActiveDetails = 0;
  const fetchImpl = async (url) => {
    const requestUrl = String(url);
    if (requestUrl === "/api/v1/bootstrap") {
      return jsonResponse({ data: {
        regions: [], categories: [], tags: [],
        featureFlags: {}, contractVersions: {}
      } });
    }
    if (requestUrl.startsWith("/api/v1/feed?")) {
      return jsonResponse({ data: { items: feed } });
    }
    const requestedPlace = places.find((item) => requestUrl.endsWith(`/places/${item.id}`));
    if (!requestedPlace) throw new Error(`Unexpected request: ${url}`);
    activeDetails += 1;
    maxActiveDetails = Math.max(maxActiveDetails, activeDetails);
    await new Promise((resolve) => setTimeout(resolve, 5));
    activeDetails -= 1;
    return jsonResponse({ data: requestedPlace });
  };

  const repository = createApiRepository({
    fetchImpl,
    storage: memoryStorage(),
    detailConcurrency: 3
  });
  const snapshot = await repository.getBootstrap();

  assert.equal(snapshot.places.length, places.length);
  assert.ok(maxActiveDetails <= 3, `expected at most 3 detail requests, received ${maxActiveDetails}`);
});

test("successful public reads use memory cache only until their TTL expires", async () => {
  let now = 1_000;
  let requests = 0;
  const repository = createApiRepository({
    fetchImpl: async () => {
      requests += 1;
      return jsonResponse({ data: place });
    },
    storage: memoryStorage(),
    now: () => now,
    readCacheTtlMs: 100
  });

  await repository.getPlaceDetail(place.id);
  await repository.getPlaceDetail(place.id);
  assert.equal(requests, 1);

  now += 101;
  await repository.getPlaceDetail(place.id);
  assert.equal(requests, 2);
});

test("empty public reads expire sooner and failed reads are never cached", async () => {
  let now = 2_000;
  let feedRequests = 0;
  let placeRequests = 0;
  const repository = createApiRepository({
    fetchImpl: async (url) => {
      if (String(url).startsWith("/api/v1/feed?")) {
        feedRequests += 1;
        return jsonResponse({ data: { items: [] } });
      }
      placeRequests += 1;
      if (placeRequests === 1) return jsonResponse({ error: { code: "temporary", message: "temporary" } }, 503);
      return jsonResponse({ data: place });
    },
    storage: memoryStorage(),
    now: () => now,
    readCacheTtlMs: 100,
    emptyReadCacheTtlMs: 10
  });

  await repository.getFeed();
  await repository.getFeed();
  assert.equal(feedRequests, 1);

  now += 11;
  await repository.getFeed();
  assert.equal(feedRequests, 2);

  await assert.rejects(repository.getPlaceDetail(place.id), (error) => error.status === 503);
  assert.equal((await repository.getPlaceDetail(place.id)).id, place.id);
  assert.equal(placeRequests, 2);
});

test("an expired bootstrap snapshot is not used after a network failure", async () => {
  const storage = memoryStorage();
  let now = 3_000;
  let online = true;
  const repository = createApiRepository({
    fetchImpl: async (url) => {
      if (!online) throw new TypeError("offline");
      if (String(url) === "/api/v1/bootstrap") {
        return jsonResponse({ data: {
          regions: [], categories: [], tags: [],
          featureFlags: {}, contractVersions: {}
        } });
      }
      return jsonResponse({ data: { items: [] } });
    },
    storage,
    now: () => now,
    readCacheTtlMs: 10,
    snapshotCacheTtlMs: 100
  });

  await repository.getBootstrap();
  online = false;
  now += 101;

  await assert.rejects(repository.getBootstrap(), /offline/);
});

test("saved place and course reads follow every server page", async () => {
  const requests = [];
  const repository = createApiRepository({
    fetchImpl: async (url) => {
      requests.push(String(url));
      if (String(url) === "/api/v1/me/saves?targetType=place&limit=50") {
        return jsonResponse({
          data: { items: [{ targetType: "place", target: place }] },
          meta: { nextCursor: "next-place-page" }
        });
      }
      if (String(url).includes("cursor=next-place-page")) {
        return jsonResponse({ data: { items: [{ targetType: "place", target: courseOnlyPlace }] } });
      }
      if (String(url) === "/api/v1/me/saves?targetType=course&limit=50") {
        return jsonResponse({
          data: { items: [{ targetType: "course", target: course }] },
          meta: { nextCursor: "next-course-page" }
        });
      }
      if (String(url).includes("cursor=next-course-page")) {
        return jsonResponse({ data: { items: [{ targetType: "course", target: { ...course, id: "course-page-2" } }] } });
      }
      return jsonResponse({ data: { items: [] } });
    },
    storage: memoryStorage(),
    accessTokenProvider: () => "current-access-token"
  });

  const places = await repository.getSavedPlaces();
  const courses = await repository.getSavedCourses();

  assert.deepEqual(requests, [
    "/api/v1/me/saves?targetType=place&limit=50",
    "/api/v1/me/saves?targetType=place&limit=50&cursor=next-place-page",
    "/api/v1/me/saves?targetType=course&limit=50",
    "/api/v1/me/saves?targetType=course&limit=50&cursor=next-course-page"
  ]);
  assert.deepEqual(places.map((item) => item.id), [place.id, courseOnlyPlace.id]);
  assert.deepEqual(courses.map((item) => item.id), [course.id, "course-page-2"]);
});

test("comment reads use the server maximum limit", async () => {
  const requests = [];
  const repository = createApiRepository({
    fetchImpl: async (url) => {
      requests.push(String(url));
      return jsonResponse({ data: { items: [] } });
    },
    storage: memoryStorage()
  });

  await repository.getComments("content-1");

  assert.deepEqual(requests, [
    "/api/v1/contents/content-1/comments?limit=50"
  ]);
});
