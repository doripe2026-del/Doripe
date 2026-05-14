# Doripe Mobile MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Doripe 5/31 MVP as a real React Native + Expo mobile app with access-code entry, place discovery, saved places, route view, event logging, and Android/iOS test-build readiness.

**Architecture:** Create a new `doripe-mobile` Expo app beside the existing reference materials. Keep domain data normalized in small TypeScript modules, isolate storage/event logging behind repository functions, and keep screens thin. Validate native Naver Map integration first; if it blocks delivery, swap only the `RouteMap` implementation while preserving the route screen contract.

**Tech Stack:** React Native, Expo Development Build, EAS Build, TypeScript, React Navigation, AsyncStorage, Jest, React Native Testing Library, `@mj-studio/react-native-naver-map` for the preferred map implementation.

---

## File Structure

Create a new app folder:

- `doripe-mobile/`: Expo React Native mobile app.
- `doripe-mobile/src/domain/types.ts`: Canonical entity and event types.
- `doripe-mobile/src/domain/fixtures.ts`: MVP seed data for neighborhoods, categories, places, and access codes.
- `doripe-mobile/src/domain/selectors.ts`: Read-only lookup and route derivation helpers.
- `doripe-mobile/src/services/storage.ts`: AsyncStorage wrappers.
- `doripe-mobile/src/services/accessCodes.ts`: Access-code validation.
- `doripe-mobile/src/services/events.ts`: Append-only event recording.
- `doripe-mobile/src/services/savedPlaces.ts`: Save/skip state and saved-order management.
- `doripe-mobile/src/navigation/AppNavigator.tsx`: Root navigation and bottom tabs.
- `doripe-mobile/src/screens/AccessCodeScreen.tsx`: Four-digit entry gate.
- `doripe-mobile/src/screens/DiscoverScreen.tsx`: Card browsing with save/skip.
- `doripe-mobile/src/screens/SavedScreen.tsx`: Saved place list.
- `doripe-mobile/src/screens/RouteScreen.tsx`: Route screen using saved places.
- `doripe-mobile/src/components/PlaceCard.tsx`: High-polish card component.
- `doripe-mobile/src/components/RouteMap.tsx`: Map abstraction used by `RouteScreen`.
- `doripe-mobile/src/components/SegmentList.tsx`: Segment-level navigation list.
- `doripe-mobile/src/utils/naverLinks.ts`: External Naver Map URL helpers.
- `doripe-mobile/src/theme/tokens.ts`: Color, spacing, and typography tokens.
- `doripe-mobile/__tests__/`: Unit and screen tests.
- `doripe-mobile/eas.json`: EAS build profiles.
- `docs/superpowers/specs/2026-05-15-doripe-mvp-design.md`: Approved design source.

## Task 1: Scaffold The Mobile App

**Files:**
- Create: `doripe-mobile/`
- Create: `doripe-mobile/package.json`
- Create: `doripe-mobile/tsconfig.json`
- Create: `doripe-mobile/app.json`
- Create: `doripe-mobile/eas.json`
- Create: `doripe-mobile/src/`

- [ ] **Step 1: Create the Expo TypeScript app**

Run from `C:\Users\cityb\Desktop\Claude\1. Projects\Doripe`:

```powershell
npx create-expo-app@latest doripe-mobile --template blank-typescript
```

Expected: a new `doripe-mobile` folder with Expo TypeScript files.

- [ ] **Step 2: Install runtime dependencies**

Run:

```powershell
npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack react-native-screens react-native-safe-area-context @react-native-async-storage/async-storage expo-linking expo-dev-client
```

Expected: dependencies added to `doripe-mobile/package.json`.

- [ ] **Step 3: Install test dependencies**

Run:

```powershell
npm install -D jest jest-expo @testing-library/react-native @types/jest react-test-renderer
```

Expected: dev dependencies added.

- [ ] **Step 4: Configure test scripts**

Modify `doripe-mobile/package.json`:

```json
{
  "scripts": {
    "start": "expo start --dev-client",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "test": "jest",
    "test:watch": "jest --watch",
    "typecheck": "tsc --noEmit"
  },
  "jest": {
    "preset": "jest-expo"
  }
}
```

Keep any existing Expo script names that `create-expo-app` generated if they are still useful, but ensure these six scripts exist.

- [ ] **Step 5: Configure EAS profiles**

Create `doripe-mobile/eas.json`:

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "simulator": false
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true,
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

- [ ] **Step 6: Verify the scaffold**

Run:

```powershell
npm run typecheck
npm test -- --runInBand
```

Expected: typecheck passes. Jest may report no tests found until Task 2; that is acceptable only before Task 2.

- [ ] **Step 7: Commit**

If this workspace has no git repository, initialize one first:

```powershell
git init
git add doripe-mobile docs/superpowers/specs docs/superpowers/plans
git commit -m "chore: scaffold Doripe mobile app"
```

Expected: first commit created.

## Task 2: Define Canonical Domain Data

**Files:**
- Create: `doripe-mobile/src/domain/types.ts`
- Create: `doripe-mobile/src/domain/fixtures.ts`
- Create: `doripe-mobile/src/domain/selectors.ts`
- Test: `doripe-mobile/__tests__/domain/selectors.test.ts`

- [ ] **Step 1: Write selector tests**

Create `doripe-mobile/__tests__/domain/selectors.test.ts`:

```ts
import { categories, neighborhoods, places } from "../../src/domain/fixtures";
import {
  getCategoryById,
  getNeighborhoodById,
  getReadyPlaces,
  getRouteSegments,
} from "../../src/domain/selectors";

describe("domain selectors", () => {
  it("resolves neighborhoods by id", () => {
    expect(getNeighborhoodById(neighborhoods, "hbc")?.name).toBe("후암동/해방촌");
  });

  it("resolves categories by id", () => {
    expect(getCategoryById(categories, "cafe")?.name).toBe("카페");
  });

  it("only returns ready places with approved photos", () => {
    const ready = getReadyPlaces(places);
    expect(ready.every((place) => place.status === "ready")).toBe(true);
    expect(ready.every((place) => place.photoQaStatus === "approved")).toBe(true);
  });

  it("derives route segments from saved place ids", () => {
    const segments = getRouteSegments(["hbc-001", "hbc-002", "hbc-003"], places);
    expect(segments).toEqual([
      { fromPlaceId: "hbc-001", toPlaceId: "hbc-002" },
      { fromPlaceId: "hbc-002", toPlaceId: "hbc-003" },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npm test -- --runInBand __tests__/domain/selectors.test.ts
```

Expected: FAIL because domain files do not exist.

- [ ] **Step 3: Add canonical types**

Create `doripe-mobile/src/domain/types.ts`:

```ts
export type EntityStatus = "active" | "inactive";

export type Neighborhood = {
  id: string;
  name: string;
  displayOrder: number;
  status: EntityStatus;
};

export type Category = {
  id: string;
  name: string;
  displayOrder: number;
  status: EntityStatus;
};

export type Place = {
  id: string;
  status: "draft" | "ready" | "inactive";
  neighborhoodId: string;
  subArea: string;
  categoryId: string;
  name: string;
  shortCopy: string;
  moodTags: string[];
  bestFor: string[];
  timeTags: string[];
  routeRole: "start" | "middle" | "finish" | "pause";
  lat: number;
  lng: number;
  address: string;
  nearestStation: string;
  naverPlaceUrl: string;
  coverImageUrl: string;
  imageUrls: string[];
  imageCredit: "team";
  photoQaStatus: "pending" | "approved" | "rejected";
  hoursText: string;
  priceHint: string;
  stayTimeMinutes: number;
  editorialNote: string;
  qaStatus: "draft" | "ready" | "needs_fix";
  lastCheckedAt: string;
};

export type AccessCode = {
  id: string;
  email: string;
  code: string;
  status: "active" | "inactive";
  cohort: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type SavedPlace = {
  id: string;
  accessCodeId: string;
  placeId: string;
  savedOrder: number;
  createdAt: string;
};

export type EventName =
  | "code_verified"
  | "place_seen"
  | "place_saved"
  | "place_skipped"
  | "saved_list_opened"
  | "route_opened"
  | "route_segment_clicked";

export type EventLog = {
  id: string;
  accessCodeId: string;
  eventName: EventName;
  placeId?: string;
  segmentFromPlaceId?: string;
  segmentToPlaceId?: string;
  createdAt: string;
};

export type RouteSegment = {
  fromPlaceId: string;
  toPlaceId: string;
};
```

- [ ] **Step 4: Add MVP fixture data**

Create `doripe-mobile/src/domain/fixtures.ts`:

```ts
import type { AccessCode, Category, Neighborhood, Place } from "./types";

export const neighborhoods: Neighborhood[] = [
  { id: "hbc", name: "후암동/해방촌", displayOrder: 1, status: "active" },
  { id: "mullae", name: "문래", displayOrder: 2, status: "active" },
  { id: "seochon", name: "서촌/원서/계동", displayOrder: 3, status: "active" },
];

export const categories: Category[] = [
  { id: "cafe", name: "카페", displayOrder: 1, status: "active" },
  { id: "food", name: "음식", displayOrder: 2, status: "active" },
  { id: "bar", name: "바/술집", displayOrder: 3, status: "active" },
  { id: "shop", name: "로컬숍", displayOrder: 4, status: "active" },
  { id: "culture", name: "전시/문화", displayOrder: 5, status: "active" },
  { id: "walk", name: "산책/뷰/공간", displayOrder: 6, status: "active" },
];

export const accessCodes: AccessCode[] = [
  {
    id: "access-0000",
    email: "team@doripe.test",
    code: "0000",
    status: "active",
    cohort: "team",
    note: "Internal team testing",
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
  },
  {
    id: "access-0529",
    email: "beta@doripe.test",
    code: "0529",
    status: "active",
    cohort: "beta-1",
    note: "First beta cohort",
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
  },
  {
    id: "access-9999",
    email: "inactive@doripe.test",
    code: "9999",
    status: "inactive",
    cohort: "inactive-test",
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
  },
];

export const places: Place[] = [
  {
    id: "hbc-001",
    status: "ready",
    neighborhoodId: "hbc",
    subArea: "해방촌",
    categoryId: "cafe",
    name: "해방 오후",
    shortCopy: "오후 빛이 길게 들어오는 조용한 골목 카페",
    moodTags: ["조용한", "로컬", "혼자"],
    bestFor: ["혼자", "친구"],
    timeTags: ["오후", "저녁"],
    routeRole: "start",
    lat: 37.54424,
    lng: 126.98574,
    address: "서울 용산구 신흥로",
    nearestStation: "녹사평역",
    naverPlaceUrl: "https://map.naver.com/",
    coverImageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085",
    imageUrls: ["https://images.unsplash.com/photo-1495474472287-4d71bcdd2085"],
    imageCredit: "team",
    photoQaStatus: "approved",
    hoursText: "운영시간 확인 필요",
    priceHint: "1만원대",
    stayTimeMinutes: 45,
    editorialNote: "첫 장소로 쓰기 좋은 조용한 카페",
    qaStatus: "ready",
    lastCheckedAt: "2026-05-15",
  },
  {
    id: "hbc-002",
    status: "ready",
    neighborhoodId: "hbc",
    subArea: "후암동",
    categoryId: "walk",
    name: "후암 골목 뷰포인트",
    shortCopy: "남산 아래 오래된 골목이 한눈에 잡히는 산책 포인트",
    moodTags: ["산책", "뷰", "느긋한"],
    bestFor: ["혼자", "데이트"],
    timeTags: ["오후", "해질녘"],
    routeRole: "middle",
    lat: 37.55012,
    lng: 126.98288,
    address: "서울 용산구 후암동",
    nearestStation: "숙대입구역",
    naverPlaceUrl: "https://map.naver.com/",
    coverImageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
    imageUrls: ["https://images.unsplash.com/photo-1500530855697-b586d89ba3ee"],
    imageCredit: "team",
    photoQaStatus: "approved",
    hoursText: "상시",
    priceHint: "무료",
    stayTimeMinutes: 25,
    editorialNote: "카페 뒤에 붙이기 좋은 짧은 산책",
    qaStatus: "ready",
    lastCheckedAt: "2026-05-15",
  },
  {
    id: "hbc-003",
    status: "ready",
    neighborhoodId: "hbc",
    subArea: "해방촌",
    categoryId: "bar",
    name: "소월 저녁",
    shortCopy: "하루의 끝에 넣기 좋은 작은 바",
    moodTags: ["저녁", "조용한", "마무리"],
    bestFor: ["친구", "데이트"],
    timeTags: ["저녁", "밤"],
    routeRole: "finish",
    lat: 37.5427,
    lng: 126.98741,
    address: "서울 용산구 소월로",
    nearestStation: "녹사평역",
    naverPlaceUrl: "https://map.naver.com/",
    coverImageUrl: "https://images.unsplash.com/photo-1514933651103-005eec06c04b",
    imageUrls: ["https://images.unsplash.com/photo-1514933651103-005eec06c04b"],
    imageCredit: "team",
    photoQaStatus: "approved",
    hoursText: "저녁 운영",
    priceHint: "2만원대",
    stayTimeMinutes: 70,
    editorialNote: "루트 마지막에 배치하기 좋은 장소",
    qaStatus: "ready",
    lastCheckedAt: "2026-05-15",
  },
];
```

This seed uses sample venue names with structurally valid data. Replace with real team-collected cards during the content import task.

- [ ] **Step 5: Add selectors**

Create `doripe-mobile/src/domain/selectors.ts`:

```ts
import type { Category, Neighborhood, Place, RouteSegment } from "./types";

export function getNeighborhoodById(
  neighborhoods: Neighborhood[],
  id: string,
): Neighborhood | undefined {
  return neighborhoods.find((neighborhood) => neighborhood.id === id);
}

export function getCategoryById(categories: Category[], id: string): Category | undefined {
  return categories.find((category) => category.id === id);
}

export function getReadyPlaces(places: Place[]): Place[] {
  return places.filter(
    (place) => place.status === "ready" && place.photoQaStatus === "approved",
  );
}

export function getPlaceById(places: Place[], id: string): Place | undefined {
  return places.find((place) => place.id === id);
}

export function getRouteSegments(savedPlaceIds: string[], places: Place[]): RouteSegment[] {
  const existingPlaceIds = savedPlaceIds.filter((placeId) => getPlaceById(places, placeId));
  return existingPlaceIds.slice(0, -1).map((fromPlaceId, index) => ({
    fromPlaceId,
    toPlaceId: existingPlaceIds[index + 1],
  }));
}
```

- [ ] **Step 6: Verify tests pass**

Run:

```powershell
npm test -- --runInBand __tests__/domain/selectors.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add doripe-mobile/src/domain doripe-mobile/__tests__/domain
git commit -m "feat: define Doripe domain data"
```

## Task 3: Implement Local Storage And Event Logging

**Files:**
- Create: `doripe-mobile/src/services/storage.ts`
- Create: `doripe-mobile/src/services/accessCodes.ts`
- Create: `doripe-mobile/src/services/events.ts`
- Create: `doripe-mobile/src/services/savedPlaces.ts`
- Test: `doripe-mobile/__tests__/services/accessCodes.test.ts`
- Test: `doripe-mobile/__tests__/services/savedPlaces.test.ts`

- [ ] **Step 1: Write access-code tests**

Create `doripe-mobile/__tests__/services/accessCodes.test.ts`:

```ts
import { accessCodes } from "../../src/domain/fixtures";
import { verifyAccessCode } from "../../src/services/accessCodes";

describe("verifyAccessCode", () => {
  it("accepts active four-digit codes", () => {
    expect(verifyAccessCode("0529", accessCodes)).toEqual({
      status: "accepted",
      accessCodeId: "access-0529",
    });
  });

  it("rejects inactive codes distinctly", () => {
    expect(verifyAccessCode("9999", accessCodes)).toEqual({
      status: "inactive",
    });
  });

  it("rejects unknown codes", () => {
    expect(verifyAccessCode("1234", accessCodes)).toEqual({
      status: "unknown",
    });
  });

  it("rejects malformed values", () => {
    expect(verifyAccessCode("52a9", accessCodes)).toEqual({
      status: "invalid_format",
    });
  });
});
```

- [ ] **Step 2: Write saved-place tests**

Create `doripe-mobile/__tests__/services/savedPlaces.test.ts`:

```ts
import { addSavedPlace, removeSavedPlace } from "../../src/services/savedPlaces";
import type { SavedPlace } from "../../src/domain/types";

describe("saved place operations", () => {
  it("adds a place once and preserves saved order", () => {
    const existing: SavedPlace[] = [];
    const next = addSavedPlace(existing, "access-0529", "hbc-001", "2026-05-15T00:00:00.000Z");

    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      accessCodeId: "access-0529",
      placeId: "hbc-001",
      savedOrder: 1,
    });
  });

  it("does not duplicate a saved place for the same access code", () => {
    const first = addSavedPlace([], "access-0529", "hbc-001", "2026-05-15T00:00:00.000Z");
    const second = addSavedPlace(first, "access-0529", "hbc-001", "2026-05-15T00:01:00.000Z");

    expect(second).toHaveLength(1);
  });

  it("removes a saved place and reorders remaining places", () => {
    const first = addSavedPlace([], "access-0529", "hbc-001", "2026-05-15T00:00:00.000Z");
    const second = addSavedPlace(first, "access-0529", "hbc-002", "2026-05-15T00:01:00.000Z");
    const next = removeSavedPlace(second, "access-0529", "hbc-001");

    expect(next).toHaveLength(1);
    expect(next[0].placeId).toBe("hbc-002");
    expect(next[0].savedOrder).toBe(1);
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```powershell
npm test -- --runInBand __tests__/services
```

Expected: FAIL because service files do not exist.

- [ ] **Step 4: Add access-code service**

Create `doripe-mobile/src/services/accessCodes.ts`:

```ts
import type { AccessCode } from "../domain/types";

export type AccessCodeVerification =
  | { status: "accepted"; accessCodeId: string }
  | { status: "inactive" }
  | { status: "unknown" }
  | { status: "invalid_format" };

export function verifyAccessCode(code: string, accessCodes: AccessCode[]): AccessCodeVerification {
  const normalizedCode = code.trim();

  if (!/^\d{4}$/.test(normalizedCode)) {
    return { status: "invalid_format" };
  }

  const accessCode = accessCodes.find((item) => item.code === normalizedCode);

  if (!accessCode) {
    return { status: "unknown" };
  }

  if (accessCode.status !== "active") {
    return { status: "inactive" };
  }

  return { status: "accepted", accessCodeId: accessCode.id };
}
```

- [ ] **Step 5: Add saved-place pure functions**

Create `doripe-mobile/src/services/savedPlaces.ts`:

```ts
import type { SavedPlace } from "../domain/types";

function createId(accessCodeId: string, placeId: string): string {
  return `${accessCodeId}-${placeId}`;
}

export function addSavedPlace(
  savedPlaces: SavedPlace[],
  accessCodeId: string,
  placeId: string,
  createdAt: string,
): SavedPlace[] {
  const alreadySaved = savedPlaces.some(
    (savedPlace) => savedPlace.accessCodeId === accessCodeId && savedPlace.placeId === placeId,
  );

  if (alreadySaved) {
    return savedPlaces;
  }

  const userSavedPlaces = savedPlaces.filter(
    (savedPlace) => savedPlace.accessCodeId === accessCodeId,
  );

  return [
    ...savedPlaces,
    {
      id: createId(accessCodeId, placeId),
      accessCodeId,
      placeId,
      savedOrder: userSavedPlaces.length + 1,
      createdAt,
    },
  ];
}

export function removeSavedPlace(
  savedPlaces: SavedPlace[],
  accessCodeId: string,
  placeId: string,
): SavedPlace[] {
  const filtered = savedPlaces.filter(
    (savedPlace) =>
      !(savedPlace.accessCodeId === accessCodeId && savedPlace.placeId === placeId),
  );

  let order = 1;
  return filtered.map((savedPlace) => {
    if (savedPlace.accessCodeId !== accessCodeId) {
      return savedPlace;
    }

    const reordered = { ...savedPlace, savedOrder: order };
    order += 1;
    return reordered;
  });
}

export function getSavedPlaceIds(savedPlaces: SavedPlace[], accessCodeId: string): string[] {
  return savedPlaces
    .filter((savedPlace) => savedPlace.accessCodeId === accessCodeId)
    .sort((left, right) => left.savedOrder - right.savedOrder)
    .map((savedPlace) => savedPlace.placeId);
}
```

- [ ] **Step 6: Add AsyncStorage wrappers**

Create `doripe-mobile/src/services/storage.ts`:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}
```

- [ ] **Step 7: Add append-only event service**

Create `doripe-mobile/src/services/events.ts`:

```ts
import type { EventLog, EventName } from "../domain/types";
import { readJson, writeJson } from "./storage";

export const EVENTS_STORAGE_KEY = "doripe.events";

type EventInput = {
  accessCodeId: string;
  eventName: EventName;
  placeId?: string;
  segmentFromPlaceId?: string;
  segmentToPlaceId?: string;
};

function createEventId(): string {
  return `event-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function recordEvent(input: EventInput): Promise<EventLog> {
  const existing = await readJson<EventLog[]>(EVENTS_STORAGE_KEY, []);
  const event: EventLog = {
    id: createEventId(),
    accessCodeId: input.accessCodeId,
    eventName: input.eventName,
    placeId: input.placeId,
    segmentFromPlaceId: input.segmentFromPlaceId,
    segmentToPlaceId: input.segmentToPlaceId,
    createdAt: new Date().toISOString(),
  };

  await writeJson(EVENTS_STORAGE_KEY, [...existing, event]);
  return event;
}

export async function listEvents(): Promise<EventLog[]> {
  return readJson<EventLog[]>(EVENTS_STORAGE_KEY, []);
}
```

- [ ] **Step 8: Verify services**

Run:

```powershell
npm test -- --runInBand __tests__/services
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add doripe-mobile/src/services doripe-mobile/__tests__/services
git commit -m "feat: add local persistence services"
```

## Task 4: Build Navigation And Access-Code Gate

**Files:**
- Modify: `doripe-mobile/App.tsx`
- Create: `doripe-mobile/src/navigation/AppNavigator.tsx`
- Create: `doripe-mobile/src/screens/AccessCodeScreen.tsx`
- Create: `doripe-mobile/src/screens/DiscoverScreen.tsx`
- Create: `doripe-mobile/src/screens/SavedScreen.tsx`
- Create: `doripe-mobile/src/screens/RouteScreen.tsx`
- Create: `doripe-mobile/src/theme/tokens.ts`
- Test: `doripe-mobile/__tests__/screens/AccessCodeScreen.test.tsx`

- [ ] **Step 1: Write access-code screen test**

Create `doripe-mobile/__tests__/screens/AccessCodeScreen.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { AccessCodeScreen } from "../../src/screens/AccessCodeScreen";

describe("AccessCodeScreen", () => {
  it("submits four-digit codes", () => {
    const onAccepted = jest.fn();

    render(<AccessCodeScreen onAccepted={onAccepted} />);

    fireEvent.changeText(screen.getByLabelText("실행코드 입력"), "0529");
    fireEvent.press(screen.getByText("시작하기"));

    expect(onAccepted).toHaveBeenCalledWith("access-0529");
  });

  it("shows inactive code message", () => {
    render(<AccessCodeScreen onAccepted={jest.fn()} />);

    fireEvent.changeText(screen.getByLabelText("실행코드 입력"), "9999");
    fireEvent.press(screen.getByText("시작하기"));

    expect(screen.getByText("현재 사용할 수 없는 코드입니다.")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
npm test -- --runInBand __tests__/screens/AccessCodeScreen.test.tsx
```

Expected: FAIL because screen does not exist.

- [ ] **Step 3: Add theme tokens**

Create `doripe-mobile/src/theme/tokens.ts`:

```ts
export const colors = {
  background: "#F7F3EC",
  surface: "#FFFDF8",
  ink: "#1F1A17",
  muted: "#776D63",
  line: "#E6DDD2",
  primary: "#E9552F",
  primaryDark: "#B73C22",
  success: "#2E7D5B",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
};
```

- [ ] **Step 4: Add access-code screen**

Create `doripe-mobile/src/screens/AccessCodeScreen.tsx`:

```tsx
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { accessCodes } from "../domain/fixtures";
import { verifyAccessCode } from "../services/accessCodes";
import { recordEvent } from "../services/events";
import { colors, radius, spacing } from "../theme/tokens";

type Props = {
  onAccepted: (accessCodeId: string) => void;
};

export function AccessCodeScreen({ onAccepted }: Props) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit() {
    const result = verifyAccessCode(code, accessCodes);

    if (result.status === "accepted") {
      await recordEvent({ accessCodeId: result.accessCodeId, eventName: "code_verified" });
      onAccepted(result.accessCodeId);
      return;
    }

    if (result.status === "inactive") {
      setMessage("현재 사용할 수 없는 코드입니다.");
      return;
    }

    setMessage("코드를 확인해주세요.");
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <View style={styles.panel}>
        <Text style={styles.logo}>Doripe</Text>
        <Text style={styles.title}>실행코드 4자리를 입력해주세요.</Text>
        <TextInput
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 4))}
          accessibilityLabel="실행코드 입력"
          keyboardType="number-pad"
          maxLength={4}
          style={styles.input}
        />
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <Pressable style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>시작하기</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    padding: spacing.lg,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  logo: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: spacing.xl,
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 32,
  },
  input: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#FFFFFF",
    color: colors.ink,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    textAlign: "center",
  },
  message: {
    color: colors.primaryDark,
    marginTop: spacing.sm,
  },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },
});
```

- [ ] **Step 5: Add temporary tab shells**

Create `doripe-mobile/src/screens/DiscoverScreen.tsx`:

```tsx
import { Text, View } from "react-native";

type Props = {
  accessCodeId: string;
};

export function DiscoverScreen({ accessCodeId }: Props) {
  return (
    <View>
      <Text>Discover {accessCodeId}</Text>
    </View>
  );
}
```

Create `doripe-mobile/src/screens/SavedScreen.tsx`:

```tsx
import { Text, View } from "react-native";

type Props = {
  accessCodeId: string;
};

export function SavedScreen({ accessCodeId }: Props) {
  return (
    <View>
      <Text>Saved {accessCodeId}</Text>
    </View>
  );
}
```

Create `doripe-mobile/src/screens/RouteScreen.tsx`:

```tsx
import { Text, View } from "react-native";

type Props = {
  accessCodeId: string;
};

export function RouteScreen({ accessCodeId }: Props) {
  return (
    <View>
      <Text>Route {accessCodeId}</Text>
    </View>
  );
}
```

- [ ] **Step 6: Add app navigator**

Create `doripe-mobile/src/navigation/AppNavigator.tsx`:

```tsx
import { useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AccessCodeScreen } from "../screens/AccessCodeScreen";
import { DiscoverScreen } from "../screens/DiscoverScreen";
import { RouteScreen } from "../screens/RouteScreen";
import { SavedScreen } from "../screens/SavedScreen";
import { colors } from "../theme/tokens";

type TabParamList = {
  Discover: undefined;
  Saved: undefined;
  Route: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export function AppNavigator() {
  const [accessCodeId, setAccessCodeId] = useState<string | null>(null);

  if (!accessCodeId) {
    return <AccessCodeScreen onAccepted={setAccessCodeId} />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.line,
          },
        }}
      >
        <Tab.Screen name="Discover" options={{ title: "발견" }}>
          {() => <DiscoverScreen accessCodeId={accessCodeId} />}
        </Tab.Screen>
        <Tab.Screen name="Saved" options={{ title: "저장함" }}>
          {() => <SavedScreen accessCodeId={accessCodeId} />}
        </Tab.Screen>
        <Tab.Screen name="Route" options={{ title: "루트" }}>
          {() => <RouteScreen accessCodeId={accessCodeId} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 7: Wire app root**

Modify `doripe-mobile/App.tsx`:

```tsx
import { StatusBar } from "expo-status-bar";
import { AppNavigator } from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <AppNavigator />
    </>
  );
}
```

- [ ] **Step 8: Verify navigation and access gate**

Run:

```powershell
npm test -- --runInBand __tests__/screens/AccessCodeScreen.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add doripe-mobile/App.tsx doripe-mobile/src/navigation doripe-mobile/src/screens doripe-mobile/src/theme doripe-mobile/__tests__/screens
git commit -m "feat: add access code gate and navigation"
```

## Task 5: Build Discover Card Flow

**Files:**
- Create: `doripe-mobile/src/components/PlaceCard.tsx`
- Modify: `doripe-mobile/src/screens/DiscoverScreen.tsx`
- Test: `doripe-mobile/__tests__/components/PlaceCard.test.tsx`

- [ ] **Step 1: Write place card test**

Create `doripe-mobile/__tests__/components/PlaceCard.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { places } from "../../src/domain/fixtures";
import { PlaceCard } from "../../src/components/PlaceCard";

describe("PlaceCard", () => {
  it("renders place content and calls actions", () => {
    const onSave = jest.fn();
    const onSkip = jest.fn();

    render(<PlaceCard place={places[0]} categoryName="카페" onSave={onSave} onSkip={onSkip} />);

    expect(screen.getByText("해방 오후")).toBeTruthy();
    expect(screen.getByText("오후 빛이 길게 들어오는 조용한 골목 카페")).toBeTruthy();

    fireEvent.press(screen.getByText("저장"));
    fireEvent.press(screen.getByText("스킵"));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
npm test -- --runInBand __tests__/components/PlaceCard.test.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Create PlaceCard**

Create `doripe-mobile/src/components/PlaceCard.tsx`:

```tsx
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import type { Place } from "../domain/types";
import { colors, radius, spacing } from "../theme/tokens";

type Props = {
  place: Place;
  categoryName: string;
  onSave: () => void;
  onSkip: () => void;
};

export function PlaceCard({ place, categoryName, onSave, onSkip }: Props) {
  return (
    <View style={styles.wrapper}>
      <ImageBackground source={{ uri: place.coverImageUrl }} style={styles.image} imageStyle={styles.imageRadius}>
        <View style={styles.scrim} />
        <View style={styles.content}>
          <Text style={styles.meta}>{place.subArea} · {categoryName}</Text>
          <Text style={styles.name}>{place.name}</Text>
          <Text style={styles.copy}>{place.shortCopy}</Text>
          <View style={styles.tags}>
            {place.moodTags.slice(0, 3).map((tag) => (
              <Text key={tag} style={styles.tag}>{tag}</Text>
            ))}
          </View>
        </View>
      </ImageBackground>
      <View style={styles.actions}>
        <Pressable style={[styles.actionButton, styles.skipButton]} onPress={onSkip}>
          <Text style={styles.skipText}>스킵</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.saveButton]} onPress={onSave}>
          <Text style={styles.saveText}>저장</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    padding: spacing.md,
    justifyContent: "center",
  },
  image: {
    minHeight: 560,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  imageRadius: {
    borderRadius: radius.lg,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.26)",
  },
  content: {
    padding: spacing.lg,
  },
  meta: {
    color: "#F7EDE1",
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  name: {
    color: "#FFFFFF",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
  },
  copy: {
    color: "#FFF7EF",
    marginTop: spacing.sm,
    fontSize: 16,
    lineHeight: 23,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tag: {
    color: "#FFFFFF",
    borderColor: "rgba(255,255,255,0.58)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    overflow: "hidden",
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  skipButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  saveButton: {
    backgroundColor: colors.ink,
  },
  skipText: {
    color: colors.ink,
    fontWeight: "800",
  },
  saveText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
```

- [ ] **Step 4: Implement DiscoverScreen**

Modify `doripe-mobile/src/screens/DiscoverScreen.tsx`:

```tsx
import { useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { PlaceCard } from "../components/PlaceCard";
import { categories, places } from "../domain/fixtures";
import { getCategoryById, getReadyPlaces } from "../domain/selectors";
import { recordEvent } from "../services/events";
import { addSavedPlace } from "../services/savedPlaces";
import { readJson, writeJson } from "../services/storage";
import type { SavedPlace } from "../domain/types";
import { colors, spacing } from "../theme/tokens";

type Props = {
  accessCodeId: string;
};

const SAVED_PLACES_KEY = "doripe.savedPlaces";

export function DiscoverScreen({ accessCodeId }: Props) {
  const readyPlaces = useMemo(() => getReadyPlaces(places), []);
  const [index, setIndex] = useState(0);
  const place = readyPlaces[index];

  async function moveNext() {
    setIndex((current) => Math.min(current + 1, readyPlaces.length));
  }

  async function handleSave() {
    if (!place) {
      return;
    }

    const existing = await readJson<SavedPlace[]>(SAVED_PLACES_KEY, []);
    const next = addSavedPlace(existing, accessCodeId, place.id, new Date().toISOString());
    await writeJson(SAVED_PLACES_KEY, next);
    await recordEvent({ accessCodeId, eventName: "place_saved", placeId: place.id });
    await moveNext();
  }

  async function handleSkip() {
    if (!place) {
      return;
    }

    await recordEvent({ accessCodeId, eventName: "place_skipped", placeId: place.id });
    await moveNext();
  }

  if (!place) {
    return (
      <SafeAreaView style={styles.empty}>
        <Text style={styles.emptyTitle}>오늘 볼 카드는 여기까지예요.</Text>
        <Text style={styles.emptyCopy}>저장함과 루트에서 저장한 장소를 확인해보세요.</Text>
      </SafeAreaView>
    );
  }

  const categoryName = getCategoryById(categories, place.categoryId)?.name ?? "";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>Doripe</Text>
        <Text style={styles.count}>{index + 1}/{readyPlaces.length}</Text>
      </View>
      <PlaceCard place={place} categoryName={categoryName} onSave={handleSave} onSkip={handleSkip} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  brand: {
    color: colors.primary,
    fontWeight: "900",
    fontSize: 18,
  },
  count: {
    color: colors.muted,
    fontWeight: "700",
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900",
  },
  emptyCopy: {
    color: colors.muted,
    marginTop: spacing.sm,
    fontSize: 16,
    lineHeight: 23,
  },
});
```

- [ ] **Step 5: Verify Discover flow**

Run:

```powershell
npm test -- --runInBand __tests__/components/PlaceCard.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add doripe-mobile/src/components/PlaceCard.tsx doripe-mobile/src/screens/DiscoverScreen.tsx doripe-mobile/__tests__/components
git commit -m "feat: add discover card flow"
```

## Task 6: Build Saved Tab

**Files:**
- Modify: `doripe-mobile/src/screens/SavedScreen.tsx`
- Create: `doripe-mobile/src/utils/naverLinks.ts`
- Test: `doripe-mobile/__tests__/utils/naverLinks.test.ts`

- [ ] **Step 1: Write Naver link tests**

Create `doripe-mobile/__tests__/utils/naverLinks.test.ts`:

```ts
import { buildNaverPlaceUrl, buildNaverDirectionsUrl } from "../../src/utils/naverLinks";

describe("naver link helpers", () => {
  it("returns place url when present", () => {
    expect(buildNaverPlaceUrl("https://map.naver.com/p/example")).toBe("https://map.naver.com/p/example");
  });

  it("builds a segment directions url", () => {
    const url = buildNaverDirectionsUrl({
      fromName: "A",
      fromLat: 37.1,
      fromLng: 127.1,
      toName: "B",
      toLat: 37.2,
      toLng: 127.2,
    });

    expect(url).toContain("https://map.naver.com/");
    expect(url).toContain("A");
    expect(url).toContain("B");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
npm test -- --runInBand __tests__/utils/naverLinks.test.ts
```

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Add Naver link helpers**

Create `doripe-mobile/src/utils/naverLinks.ts`:

```ts
type DirectionsInput = {
  fromName: string;
  fromLat: number;
  fromLng: number;
  toName: string;
  toLat: number;
  toLng: number;
};

export function buildNaverPlaceUrl(naverPlaceUrl: string): string {
  return naverPlaceUrl;
}

export function buildNaverDirectionsUrl(input: DirectionsInput): string {
  const from = `${input.fromLng},${input.fromLat},${input.fromName}`;
  const to = `${input.toLng},${input.toLat},${input.toName}`;
  return `https://map.naver.com/v5/directions/${encodeURIComponent(from)}/${encodeURIComponent(to)}/-/transit`;
}
```

- [ ] **Step 4: Implement SavedScreen**

Modify `doripe-mobile/src/screens/SavedScreen.tsx`:

```tsx
import { useCallback, useState } from "react";
import { FlatList, Linking, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { places } from "../domain/fixtures";
import { getPlaceById } from "../domain/selectors";
import type { SavedPlace } from "../domain/types";
import { recordEvent } from "../services/events";
import { getSavedPlaceIds } from "../services/savedPlaces";
import { readJson } from "../services/storage";
import { colors, radius, spacing } from "../theme/tokens";
import { buildNaverPlaceUrl } from "../utils/naverLinks";

type Props = {
  accessCodeId: string;
};

const SAVED_PLACES_KEY = "doripe.savedPlaces";

export function SavedScreen({ accessCodeId }: Props) {
  const [savedPlaceIds, setSavedPlaceIds] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function load() {
        const savedPlaces = await readJson<SavedPlace[]>(SAVED_PLACES_KEY, []);
        if (mounted) {
          setSavedPlaceIds(getSavedPlaceIds(savedPlaces, accessCodeId));
          await recordEvent({ accessCodeId, eventName: "saved_list_opened" });
        }
      }

      load();
      return () => {
        mounted = false;
      };
    }, [accessCodeId]),
  );

  const savedPlaces = savedPlaceIds
    .map((placeId) => getPlaceById(places, placeId))
    .filter(Boolean);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>저장함</Text>
      <FlatList
        data={savedPlaces}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>마음에 드는 장소를 저장하면 여기에 모여요.</Text>
        }
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <Text style={styles.order}>{index + 1}</Text>
            <View style={styles.body}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.copy}>{item.shortCopy}</Text>
              <Pressable onPress={() => Linking.openURL(buildNaverPlaceUrl(item.naverPlaceUrl))}>
                <Text style={styles.link}>네이버지도에서 보기</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
    marginTop: spacing.md,
  },
  list: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  empty: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23,
    marginTop: spacing.xl,
  },
  card: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  order: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.ink,
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 32,
    fontWeight: "900",
    marginRight: spacing.md,
    overflow: "hidden",
  },
  body: {
    flex: 1,
  },
  name: {
    color: colors.ink,
    fontWeight: "900",
    fontSize: 18,
  },
  copy: {
    color: colors.muted,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  link: {
    color: colors.primary,
    marginTop: spacing.sm,
    fontWeight: "800",
  },
});
```

- [ ] **Step 5: Verify Saved tab**

Run:

```powershell
npm test -- --runInBand __tests__/utils/naverLinks.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add doripe-mobile/src/screens/SavedScreen.tsx doripe-mobile/src/utils doripe-mobile/__tests__/utils
git commit -m "feat: add saved places tab"
```

## Task 7: Validate And Implement Route Map

**Files:**
- Create: `doripe-mobile/src/components/RouteMap.tsx`
- Create: `doripe-mobile/src/components/SegmentList.tsx`
- Modify: `doripe-mobile/src/screens/RouteScreen.tsx`
- Modify: `doripe-mobile/package.json`
- Modify: `doripe-mobile/app.json`
- Test: `doripe-mobile/__tests__/components/SegmentList.test.tsx`

- [ ] **Step 1: Install preferred native Naver Map library**

Run:

```powershell
npm install @mj-studio/react-native-naver-map
```

Expected: package added. If install fails due to package availability, use fallback Task 7 Step 4B and record the failure in `docs/superpowers/plans/route-map-validation-notes.md`.

- [ ] **Step 2: Configure Naver Map keys**

Modify `doripe-mobile/app.json` to include a plugin/config area matching the selected Naver Map package documentation. Use environment variables rather than committing real keys:

```json
{
  "expo": {
    "name": "Doripe",
    "slug": "doripe-mobile",
    "extra": {
      "naverMapClientId": "$NAVER_MAP_CLIENT_ID"
    }
  }
}
```

Expected: app config contains no real secret values.

- [ ] **Step 3: Write SegmentList test**

Create `doripe-mobile/__tests__/components/SegmentList.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { places } from "../../src/domain/fixtures";
import { SegmentList } from "../../src/components/SegmentList";

describe("SegmentList", () => {
  it("renders segment rows and handles open presses", () => {
    const onOpenSegment = jest.fn();

    render(
      <SegmentList
        places={[places[0], places[1], places[2]]}
        onOpenSegment={onOpenSegment}
      />,
    );

    expect(screen.getByText("1구간")).toBeTruthy();
    expect(screen.getByText("2구간")).toBeTruthy();

    fireEvent.press(screen.getAllByText("길찾기 열기")[0]);

    expect(onOpenSegment).toHaveBeenCalledWith(places[0], places[1]);
  });
});
```

- [ ] **Step 4: Add SegmentList**

Create `doripe-mobile/src/components/SegmentList.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Place } from "../domain/types";
import { colors, radius, spacing } from "../theme/tokens";

type Props = {
  places: Place[];
  onOpenSegment: (from: Place, to: Place) => void;
};

export function SegmentList({ places, onOpenSegment }: Props) {
  const segments = places.slice(0, -1).map((from, index) => ({
    from,
    to: places[index + 1],
  }));

  if (segments.length === 0) {
    return <Text style={styles.empty}>장소를 2개 이상 저장하면 루트가 생겨요.</Text>;
  }

  return (
    <View style={styles.container}>
      {segments.map((segment, index) => (
        <View key={`${segment.from.id}-${segment.to.id}`} style={styles.row}>
          <Text style={styles.label}>{index + 1}구간</Text>
          <View style={styles.body}>
            <Text style={styles.names}>{segment.from.name} → {segment.to.name}</Text>
            <Pressable style={styles.button} onPress={() => onOpenSegment(segment.from, segment.to)}>
              <Text style={styles.buttonText}>길찾기 열기</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  empty: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23,
  },
  row: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  label: {
    color: colors.primary,
    fontWeight: "900",
    width: 52,
  },
  body: {
    flex: 1,
  },
  names: {
    color: colors.ink,
    fontWeight: "800",
    lineHeight: 20,
  },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.ink,
    alignSelf: "flex-start",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
```

- [ ] **Step 5A: Add preferred native RouteMap**

Create `doripe-mobile/src/components/RouteMap.tsx` using the installed Naver Map package. If the exact component names differ from the installed package documentation, adjust only this file while preserving the exported `RouteMap` props.

```tsx
import { StyleSheet, Text, View } from "react-native";
import type { Place } from "../domain/types";
import { colors, radius, spacing } from "../theme/tokens";

type Props = {
  places: Place[];
};

export function RouteMap({ places }: Props) {
  if (places.length === 0) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.empty}>저장한 장소가 지도에 표시됩니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.fallback}>
      <Text style={styles.empty}>
        네이버 지도 검증 중: {places.map((place, index) => `${index + 1}. ${place.name}`).join(" · ")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    minHeight: 320,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: "center",
    padding: spacing.lg,
  },
  empty: {
    color: colors.muted,
    lineHeight: 22,
  },
});
```

This fallback body is deliberately shippable if the native map blocks delivery. Replace it with the native map only after a development build displays markers and a line on a device.

- [ ] **Step 5B: Record map validation**

Create `docs/superpowers/plans/route-map-validation-notes.md` after testing on device:

```md
# Route Map Validation Notes

Date: 2026-05-17
Package tested: @mj-studio/react-native-naver-map
Development build: Android
Result: pass or fallback-used

Checklist:
- App binary installed:
- Naver map visible:
- Numbered markers visible:
- Connecting line visible:
- External Naver directions opened:

Decision:
- Use native Naver map for MVP, or
- Use fallback RouteMap for May 31 and keep external Naver directions.
```

- [ ] **Step 6: Implement RouteScreen**

Modify `doripe-mobile/src/screens/RouteScreen.tsx`:

```tsx
import { useCallback, useState } from "react";
import { Linking, SafeAreaView, ScrollView, StyleSheet, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { RouteMap } from "../components/RouteMap";
import { SegmentList } from "../components/SegmentList";
import { places } from "../domain/fixtures";
import { getPlaceById } from "../domain/selectors";
import type { Place, SavedPlace } from "../domain/types";
import { recordEvent } from "../services/events";
import { getSavedPlaceIds } from "../services/savedPlaces";
import { readJson } from "../services/storage";
import { colors, spacing } from "../theme/tokens";
import { buildNaverDirectionsUrl } from "../utils/naverLinks";

type Props = {
  accessCodeId: string;
};

const SAVED_PLACES_KEY = "doripe.savedPlaces";

export function RouteScreen({ accessCodeId }: Props) {
  const [routePlaces, setRoutePlaces] = useState<Place[]>([]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function load() {
        const savedPlaces = await readJson<SavedPlace[]>(SAVED_PLACES_KEY, []);
        const savedPlaceIds = getSavedPlaceIds(savedPlaces, accessCodeId);
        const resolvedPlaces = savedPlaceIds
          .map((placeId) => getPlaceById(places, placeId))
          .filter(Boolean) as Place[];

        if (mounted) {
          setRoutePlaces(resolvedPlaces);
          await recordEvent({ accessCodeId, eventName: "route_opened" });
        }
      }

      load();
      return () => {
        mounted = false;
      };
    }, [accessCodeId]),
  );

  async function handleOpenSegment(from: Place, to: Place) {
    await recordEvent({
      accessCodeId,
      eventName: "route_segment_clicked",
      segmentFromPlaceId: from.id,
      segmentToPlaceId: to.id,
    });
    await Linking.openURL(
      buildNaverDirectionsUrl({
        fromName: from.name,
        fromLat: from.lat,
        fromLng: from.lng,
        toName: to.name,
        toLat: to.lat,
        toLng: to.lng,
      }),
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>루트</Text>
        <Text style={styles.copy}>저장한 장소를 방문하기 좋은 순서로 연결해요.</Text>
        <RouteMap places={routePlaces} />
        <SegmentList places={routePlaces} onOpenSegment={handleOpenSegment} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
  },
  copy: {
    color: colors.muted,
    lineHeight: 22,
  },
});
```

- [ ] **Step 7: Verify Route UI**

Run:

```powershell
npm test -- --runInBand __tests__/components/SegmentList.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Build a development client for map validation**

Run:

```powershell
npm install -g eas-cli
eas build --profile development --platform android
```

Expected: an installable Android development build. If EAS account setup is missing, create the Expo account and rerun.

- [ ] **Step 9: Commit**

```powershell
git add doripe-mobile/src/components/RouteMap.tsx doripe-mobile/src/components/SegmentList.tsx doripe-mobile/src/screens/RouteScreen.tsx doripe-mobile/app.json doripe-mobile/package.json docs/superpowers/plans/route-map-validation-notes.md
git commit -m "feat: add route view and map validation path"
```

## Task 8: Content Import And QA Guardrails

**Files:**
- Create: `doripe-mobile/scripts/validate-content.mjs`
- Modify: `doripe-mobile/src/domain/fixtures.ts`
- Create: `doripe-mobile/content/place-template.csv`

- [ ] **Step 1: Create content template**

Create `doripe-mobile/content/place-template.csv`:

```csv
id,status,neighborhoodId,subArea,categoryId,name,shortCopy,moodTags,bestFor,timeTags,routeRole,lat,lng,address,nearestStation,naverPlaceUrl,coverImageUrl,imageUrls,imageCredit,photoQaStatus,hoursText,priceHint,stayTimeMinutes,editorialNote,qaStatus,lastCheckedAt
hbc-001,ready,hbc,해방촌,cafe,장소명,한 줄 문구,"조용한|로컬|혼자","혼자|친구","오후|저녁",start,37.54424,126.98574,서울 용산구...,녹사평역,https://map.naver.com/,https://example.com/photo.jpg,https://example.com/photo.jpg,team,approved,운영시간 확인 필요,1만원대,45,루트 메모,ready,2026-05-29
```

- [ ] **Step 2: Add content validation script**

Create `doripe-mobile/scripts/validate-content.mjs`:

```js
import { readFileSync } from "node:fs";

const fixturesPath = new URL("../src/domain/fixtures.ts", import.meta.url);
const source = readFileSync(fixturesPath, "utf8");

const requiredNeighborhoodIds = ["hbc", "mullae", "seochon"];
const requiredCategoryIds = ["cafe", "food", "bar", "shop", "culture", "walk"];

for (const id of requiredNeighborhoodIds) {
  if (!source.includes(`id: "${id}"`)) {
    throw new Error(`Missing neighborhood id: ${id}`);
  }
}

for (const id of requiredCategoryIds) {
  if (!source.includes(`id: "${id}"`)) {
    throw new Error(`Missing category id: ${id}`);
  }
}

const readyMatches = source.match(/status: "ready"/g) ?? [];
const approvedMatches = source.match(/photoQaStatus: "approved"/g) ?? [];

if (readyMatches.length < 45) {
  throw new Error(`Need at least 45 ready places for public test. Found ${readyMatches.length}.`);
}

if (approvedMatches.length < readyMatches.length) {
  throw new Error("Every ready place must have approved photoQaStatus.");
}

console.log(`Content validation passed with ${readyMatches.length} ready places.`);
```

- [ ] **Step 3: Add script to package.json**

Modify `doripe-mobile/package.json`:

```json
{
  "scripts": {
    "validate:content": "node scripts/validate-content.mjs"
  }
}
```

Merge this with existing scripts rather than replacing them.

- [ ] **Step 4: Replace seed fixtures with team content**

Modify `doripe-mobile/src/domain/fixtures.ts` by replacing `places` with real team-collected cards. Preserve these invariants:

```ts
// Required invariants:
// - place.id is unique
// - place.neighborhoodId references neighborhoods
// - place.categoryId references categories
// - ready places have photoQaStatus: "approved"
// - ready places have coverImageUrl
// - lat and lng are numbers
```

- [ ] **Step 5: Verify content**

Run:

```powershell
npm run validate:content
npm run typecheck
```

Expected: content validation passes. If fewer than 90 cards are ready, public-test minimum is 45 ready cards with at least 15 per neighborhood.

- [ ] **Step 6: Commit**

```powershell
git add doripe-mobile/content doripe-mobile/scripts doripe-mobile/src/domain/fixtures.ts doripe-mobile/package.json
git commit -m "feat: import MVP place content"
```

## Task 9: Polish, Device QA, And Build Readiness

**Files:**
- Modify: `doripe-mobile/app.json`
- Create: `doripe-mobile/docs/release-checklist.md`
- Create: `doripe-mobile/docs/tester-missions.md`

- [ ] **Step 1: Configure app metadata**

Modify `doripe-mobile/app.json`:

```json
{
  "expo": {
    "name": "Doripe",
    "slug": "doripe-mobile",
    "version": "0.1.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.doripe.app"
    },
    "android": {
      "package": "com.doripe.app",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#F7F3EC"
      }
    }
  }
}
```

Expected: bundle identifiers are stable before store-console setup.

- [ ] **Step 2: Add release checklist**

Create `doripe-mobile/docs/release-checklist.md`:

```md
# Doripe MVP Release Checklist

## Accounts
- Apple Developer account created
- Google Play Console account created
- Expo account created
- EAS project linked

## Build
- Android development build installed
- Android closed test build uploaded
- iOS TestFlight build uploaded or submission-ready

## App QA
- Valid active code enters app
- Inactive code is blocked
- Unknown code shows code check message
- Discover card displays image and text
- Save adds place to Saved
- Skip advances card
- Saved tab opens Naver place link
- Route tab shows saved places
- Segment button opens external directions
- Events are recorded without email copies

## Content QA
- 45 or more ready cards
- 15 or more ready cards per neighborhood
- No unapproved cover photos
- No visible faces or license plates
- Coordinates checked
```

- [ ] **Step 3: Add tester missions**

Create `doripe-mobile/docs/tester-missions.md`:

```md
# Doripe Tester Missions

Use your four-digit code to enter.

## Day 1
- Save at least 3 places.
- Skip at least 5 places.
- Open Saved.
- Open Route.
- Tap one segment-level directions button.

## Day 2
- Save 2 more places.
- Check whether the route still feels understandable.
- Send one screenshot and one sentence of feedback.

## Feedback Prompt
- Which card felt most worth saving?
- Which card felt least useful?
- Did the route screen feel like a real next step?
```

- [ ] **Step 4: Run full verification**

Run:

```powershell
npm test -- --runInBand
npm run typecheck
npm run validate:content
```

Expected: PASS.

- [ ] **Step 5: Build Android closed-test candidate**

Run:

```powershell
eas build --profile production --platform android
```

Expected: `.aab` build produced for Google Play closed testing.

- [ ] **Step 6: Build iOS candidate**

Run:

```powershell
eas build --profile production --platform ios
```

Expected: iOS build produced. This requires Apple Developer credentials.

- [ ] **Step 7: Commit**

```powershell
git add doripe-mobile/app.json doripe-mobile/docs
git commit -m "chore: prepare mobile MVP release"
```

## Self-Review

Spec coverage:

- Access-code entry: Task 4.
- Active/inactive code behavior: Tasks 3 and 4.
- Three bottom tabs: Task 4.
- Discover save/skip: Task 5.
- Saved tab: Task 6.
- Route tab with route wording, segment list, and external navigation: Task 7.
- Naver Map validation and fallback: Task 7.
- Normalized domain data: Task 2.
- Append-only events with ID references: Task 3.
- Content QA and direct-photo guardrails: Task 8.
- Android closed test and iOS build readiness: Task 9.

No unresolved blanks remain in implementation steps. The native map package can require package-specific component names; the plan isolates that uncertainty inside `RouteMap.tsx` and requires a validation note before relying on it.
