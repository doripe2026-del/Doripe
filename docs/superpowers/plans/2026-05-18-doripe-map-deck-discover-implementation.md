# Doripe Map-Deck-Discover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved MVP flow `Access Code -> Map -> Deck Gallery -> Discover -> Place Gallery -> Saved / Route` in the existing Expo React Native app.

**Architecture:** Add a minimal region/deck/session domain layer while preserving canonical `Place` records and `placeId`-based saved storage. Navigation becomes bottom tabs with a Map stack (`Map -> DeckGallery -> Discover -> PlaceGallery`) plus Saved and Route tabs. UI follows the Figma Bright States design tokens translated into React Native `StyleSheet` components.

**Tech Stack:** Expo SDK 54, React Native 0.81, React Navigation bottom tabs/native stack, AsyncStorage, Jest, TypeScript.

---

## File Structure

- Modify `doripe-mobile/src/theme/tokens.ts`: add bright palette tokens, card gradient presets, and keep existing spacing/radius names.
- Modify `doripe-mobile/src/domain/types.ts`: add `Region`, `Deck`, `DeckPlace`, `ActiveDeckSession`; extend `EventName`.
- Replace content in `doripe-mobile/src/domain/fixtures.ts`: fix mojibake Korean, seed regions/decks/deckPlaces/places.
- Modify `doripe-mobile/src/domain/selectors.ts`: add region/deck/deck-place selectors while keeping existing selectors.
- Create `doripe-mobile/src/services/deckSession.ts`: AsyncStorage read/write helpers for active deck session and final selected place IDs.
- Create tests:
  - `doripe-mobile/__tests__/domain/decks.test.ts`
  - `doripe-mobile/__tests__/services/deckSession.test.ts`
- Modify `doripe-mobile/src/navigation/AppNavigator.tsx`: switch to Map/Saved/Route tabs and Map stack.
- Create screens:
  - `doripe-mobile/src/screens/MapScreen.tsx`
  - `doripe-mobile/src/screens/DeckGalleryScreen.tsx`
  - `doripe-mobile/src/screens/PlaceGalleryScreen.tsx`
- Modify screens:
  - `doripe-mobile/src/screens/DiscoverScreen.tsx`
  - `doripe-mobile/src/screens/SavedScreen.tsx`
  - `doripe-mobile/src/screens/RouteScreen.tsx`
  - `doripe-mobile/src/screens/AccessCodeScreen.tsx`
- Create components:
  - `doripe-mobile/src/components/AppScaffold.tsx`
  - `doripe-mobile/src/components/BackButton.tsx`
  - `doripe-mobile/src/components/Chip.tsx`
  - `doripe-mobile/src/components/GradientCard.tsx`
  - `doripe-mobile/src/components/PrimaryButton.tsx`
  - `doripe-mobile/src/components/StateMessage.tsx`
- Update tests that assert old Korean strings or old Discover-first behavior.

---

## Task 1: Bright Tokens And Shared UI Primitives

**Files:**
- Modify: `doripe-mobile/src/theme/tokens.ts`
- Create: `doripe-mobile/src/components/AppScaffold.tsx`
- Create: `doripe-mobile/src/components/BackButton.tsx`
- Create: `doripe-mobile/src/components/Chip.tsx`
- Create: `doripe-mobile/src/components/GradientCard.tsx`
- Create: `doripe-mobile/src/components/PrimaryButton.tsx`
- Create: `doripe-mobile/src/components/StateMessage.tsx`

- [ ] **Step 1: Update tokens**

Replace `colors` in `doripe-mobile/src/theme/tokens.ts` with:

```ts
export const colors = {
  background: "#F6F4EC",
  surface: "#FFFFF9",
  surfaceElevated: "#EEECE3",
  ink: "#090B0A",
  muted: "#5C6159",
  line: "#D1D1C5",
  primary: "#21F073",
  primaryDark: "#12B85C",
  primaryInk: "#052E14",
  danger: "#E12E29",
  dark: "#090B0A",
  white: "#FFFFFF",
};
```

Keep `spacing`, `radius`, `typography`, and `touch`, but add:

```ts
export const gradients = {
  sunset: ["#F5995C", "#80A68C"],
  lane: ["#B2C7B2", "#F5EBC7"],
  night: ["#1F333D", "#AD7A47"],
  lookout: ["#DBBA8C", "#6B8C75"],
};
```

- [ ] **Step 2: Create `AppScaffold`**

Create `doripe-mobile/src/components/AppScaffold.tsx`:

```tsx
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors, spacing } from "../theme/tokens";

type AppScaffoldProps = {
  children: ReactNode;
  padded?: boolean;
};

export function AppScaffold({ children, padded = true }: AppScaffoldProps) {
  return <View style={[styles.screen, padded && styles.padded]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  padded: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
});
```

- [ ] **Step 3: Create `PrimaryButton`**

Create `doripe-mobile/src/components/PrimaryButton.tsx`:

```tsx
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, spacing, touch, typography } from "../theme/tokens";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function PrimaryButton({ label, onPress, disabled = false }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.text, disabled && styles.disabledText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    justifyContent: "center",
    minHeight: touch.minimum + spacing.sm,
  },
  disabled: {
    backgroundColor: colors.surfaceElevated,
  },
  pressed: {
    opacity: 0.74,
  },
  text: {
    color: colors.primaryInk,
    fontSize: typography.body,
    fontWeight: "900",
  },
  disabledText: {
    color: colors.muted,
  },
});
```

- [ ] **Step 4: Create `Chip`**

Create `doripe-mobile/src/components/Chip.tsx`:

```tsx
import { StyleSheet, Text } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

type ChipProps = {
  label: string;
  active?: boolean;
};

export function Chip({ label, active = false }: ChipProps) {
  return <Text style={[styles.chip, active && styles.active]}>{label}</Text>;
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    color: colors.ink,
    fontSize: typography.caption - 2,
    fontWeight: "900",
    minHeight: 30,
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingTop: 8,
  },
  active: {
    backgroundColor: colors.ink,
    color: colors.white,
  },
});
```

- [ ] **Step 5: Create `BackButton`**

Create `doripe-mobile/src/components/BackButton.tsx`:

```tsx
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, touch } from "../theme/tokens";

type BackButtonProps = {
  onPress: () => void;
  label?: string;
};

export function BackButton({ onPress, label = "뒤로" }: BackButtonProps) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={styles.button}>
      <Text style={styles.icon}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: "rgba(9, 11, 10, 0.08)",
    borderRadius: radius.pill,
    height: touch.minimum,
    justifyContent: "center",
    width: touch.minimum,
  },
  icon: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 30,
  },
});
```

- [ ] **Step 6: Create `GradientCard`**

Create `doripe-mobile/src/components/GradientCard.tsx`. React Native has no built-in gradient dependency, so use a solid fallback color from each gradient pair now and keep image support for actual places.

```tsx
import type { ReactNode } from "react";
import { ImageBackground, StyleSheet, View } from "react-native";
import { colors, radius } from "../theme/tokens";

type GradientCardProps = {
  children: ReactNode;
  imageUrl?: string;
  tone?: "sunset" | "lane" | "night" | "lookout";
  style?: object;
};

const toneColors = {
  sunset: "#D9875C",
  lane: "#B8C9B2",
  night: "#2A3541",
  lookout: "#C6A06E",
};

export function GradientCard({ children, imageUrl, tone = "sunset", style }: GradientCardProps) {
  const content = (
    <View style={[styles.card, { backgroundColor: toneColors[tone] }, style]}>
      <View style={styles.scrim} />
      <View style={styles.content}>{children}</View>
    </View>
  );

  if (!imageUrl) {
    return content;
  }

  return (
    <ImageBackground source={{ uri: imageUrl }} resizeMode="cover" style={[styles.card, style]} imageStyle={styles.radius}>
      <View style={styles.scrim} />
      <View style={styles.content}>{children}</View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: "hidden",
  },
  radius: {
    borderRadius: 14,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.28)",
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
  },
});
```

- [ ] **Step 7: Create `StateMessage`**

Create `doripe-mobile/src/components/StateMessage.tsx`:

```tsx
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";
import { PrimaryButton } from "./PrimaryButton";

type StateMessageProps = {
  title: string;
  copy: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function StateMessage({ title, copy, actionLabel, onAction }: StateMessageProps) {
  return (
    <View style={styles.shell}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.copy}>{copy}</Text>
      {actionLabel && onAction ? <PrimaryButton label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    color: colors.ink,
    fontSize: typography.headline,
    fontWeight: "900",
    lineHeight: 36,
    textAlign: "center",
  },
  copy: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: "700",
    lineHeight: 24,
    textAlign: "center",
  },
});
```

- [ ] **Step 8: Run typecheck**

Run:

```bash
cd doripe-mobile
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add doripe-mobile/src/theme/tokens.ts doripe-mobile/src/components
git commit -m "feat: add doripe bright ui primitives"
```

---

## Task 2: Domain Types, Fixtures, And Selectors

**Files:**
- Modify: `doripe-mobile/src/domain/types.ts`
- Replace: `doripe-mobile/src/domain/fixtures.ts`
- Modify: `doripe-mobile/src/domain/selectors.ts`
- Test: `doripe-mobile/__tests__/domain/decks.test.ts`
- Update: `doripe-mobile/__tests__/domain/selectors.test.ts`

- [ ] **Step 1: Extend domain types**

Add these types to `doripe-mobile/src/domain/types.ts` after `Category`:

```ts
export type Region = {
  id: "seongsu" | "yongsan_hbc" | "yeonnam_mangwon";
  name: string;
  shortName: string;
  displayOrder: number;
  status: EntityStatus;
  mapPin: {
    x: number;
    y: number;
  };
};

export type Deck = {
  id: string;
  regionId: Region["id"];
  status: EntityStatus;
  title: string;
  shortCopy: string;
  tags: string[];
  tone: "sunset" | "lane" | "night" | "lookout";
  displayOrder: number;
};

export type DeckPlace = {
  deckId: string;
  placeId: string;
  displayOrder: number;
  featured?: boolean;
};

export type ActiveDeckSession = {
  accessCodeId: string;
  regionId: Region["id"];
  deckId: string;
  seenPlaceIds: string[];
  selectedPlaceIds: string[];
  skippedPlaceIds: string[];
  updatedAt: string;
};
```

Extend `EventName` with:

```ts
  | "region_selected"
  | "deck_selected"
  | "deck_finished"
  | "place_gallery_opened"
  | "place_selection_confirmed"
```

- [ ] **Step 2: Replace fixtures with clean Korean seed data**

Replace `doripe-mobile/src/domain/fixtures.ts` with a clean fixture file exporting `regions`, `neighborhoods`, `categories`, `accessCodes`, `decks`, `deckPlaces`, and `places`.

The first part must look like:

```ts
import type { AccessCode, Category, Deck, DeckPlace, Neighborhood, Place, Region } from "./types";

export const regions: Region[] = [
  {
    id: "seongsu",
    name: "성수",
    shortName: "성수",
    displayOrder: 1,
    status: "active",
    mapPin: { x: 249, y: 296 },
  },
  {
    id: "yongsan_hbc",
    name: "용산·후암·해방촌",
    shortName: "용산·후암",
    displayOrder: 2,
    status: "active",
    mapPin: { x: 182, y: 421 },
  },
  {
    id: "yeonnam_mangwon",
    name: "연남·망원",
    shortName: "연남·망원",
    displayOrder: 3,
    status: "active",
    mapPin: { x: 82, y: 335 },
  },
];
```

Include at least these decks:

```ts
export const decks: Deck[] = [
  {
    id: "yongsan-solo-afternoon",
    regionId: "yongsan_hbc",
    status: "active",
    title: "혼자 걷는 오후",
    shortCopy: "카페, 전망 산책, 조용한 바를 잇는 덱",
    tags: ["혼자", "차분함"],
    tone: "sunset",
    displayOrder: 1,
  },
  {
    id: "yongsan-photo-lane",
    regionId: "yongsan_hbc",
    status: "active",
    title: "사진 찍는 골목",
    shortCopy: "빛이 좋은 길과 작은 가게 중심의 덱",
    tags: ["사진", "골목"],
    tone: "lane",
    displayOrder: 2,
  },
  {
    id: "yongsan-night",
    regionId: "yongsan_hbc",
    status: "active",
    title: "저녁의 해방촌",
    shortCopy: "바와 야경으로 마무리하는 짧은 덱",
    tags: ["밤", "음악"],
    tone: "night",
    displayOrder: 3,
  },
];
```

Keep `accessCodes` with `0000`, `0529`, and inactive `9999`. Create at least five ready places tied to `yongsan_hbc`, with IDs:

- `yongsan-001`
- `yongsan-002`
- `yongsan-003`
- `yongsan-004`
- `yongsan-005`

Map all five into `yongsan-solo-afternoon` through `deckPlaces`.

- [ ] **Step 3: Add selector tests**

Create `doripe-mobile/__tests__/domain/decks.test.ts`:

```ts
import { deckPlaces, decks, places, regions } from "../../src/domain/fixtures";
import {
  getActiveDecksByRegionId,
  getDeckPlaces,
  getPlacesForDeck,
  getRegionById,
} from "../../src/domain/selectors";

describe("deck selectors", () => {
  it("resolves the three MVP regions", () => {
    expect(regions.map((region) => region.name)).toEqual([
      "성수",
      "용산·후암·해방촌",
      "연남·망원",
    ]);
    expect(getRegionById(regions, "yongsan_hbc")?.shortName).toBe("용산·후암");
  });

  it("returns active decks for a region in display order", () => {
    const activeDecks = getActiveDecksByRegionId(decks, "yongsan_hbc");
    expect(activeDecks.map((deck) => deck.title)).toEqual([
      "혼자 걷는 오후",
      "사진 찍는 골목",
      "저녁의 해방촌",
    ]);
  });

  it("returns deck places in display order", () => {
    const relations = getDeckPlaces(deckPlaces, "yongsan-solo-afternoon");
    expect(relations.map((relation) => relation.placeId)).toEqual([
      "yongsan-001",
      "yongsan-002",
      "yongsan-003",
      "yongsan-004",
      "yongsan-005",
    ]);
  });

  it("resolves canonical places for a deck", () => {
    const deckPlaceList = getPlacesForDeck(deckPlaces, places, "yongsan-solo-afternoon");
    expect(deckPlaceList[0]?.name).toBe("오월의 커피");
    expect(deckPlaceList.every((place) => place.status === "ready")).toBe(true);
  });
});
```

- [ ] **Step 4: Implement selectors**

Add to `doripe-mobile/src/domain/selectors.ts`:

```ts
import type { Deck, DeckPlace, Place, Region } from "./types";

export function getRegionById(regions: Region[], id: Region["id"]): Region | undefined {
  return regions.find((region) => region.id === id);
}

export function getActiveDecksByRegionId(decks: Deck[], regionId: Region["id"]): Deck[] {
  return decks
    .filter((deck) => deck.regionId === regionId && deck.status === "active")
    .sort((left, right) => left.displayOrder - right.displayOrder);
}

export function getDeckById(decks: Deck[], id: string): Deck | undefined {
  return decks.find((deck) => deck.id === id);
}

export function getDeckPlaces(deckPlaces: DeckPlace[], deckId: string): DeckPlace[] {
  return deckPlaces
    .filter((deckPlace) => deckPlace.deckId === deckId)
    .sort((left, right) => left.displayOrder - right.displayOrder);
}

export function getPlacesForDeck(
  deckPlaces: DeckPlace[],
  places: Place[],
  deckId: string,
): Place[] {
  return getDeckPlaces(deckPlaces, deckId)
    .map((deckPlace) => getPlaceById(places, deckPlace.placeId))
    .filter((place): place is Place => Boolean(place))
    .filter((place) => place.status === "ready" && place.photoQaStatus === "approved");
}
```

If the existing import line conflicts, merge type imports into one line.

- [ ] **Step 5: Update old selector test expectations**

In `doripe-mobile/__tests__/domain/selectors.test.ts`, change corrupted expectations:

```ts
expect(getNeighborhoodById(neighborhoods, "yongsan_hbc")?.name).toBe("용산·후암·해방촌");
expect(getCategoryById(categories, "cafe")?.name).toBe("카페");
const segments = getRouteSegments(["yongsan-001", "yongsan-002", "yongsan-003"], places);
expect(segments).toEqual([
  { fromPlaceId: "yongsan-001", toPlaceId: "yongsan-002" },
  { fromPlaceId: "yongsan-002", toPlaceId: "yongsan-003" },
]);
```

- [ ] **Step 6: Run domain tests**

Run:

```bash
cd doripe-mobile
npm test -- __tests__/domain
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add doripe-mobile/src/domain doripe-mobile/__tests__/domain
git commit -m "feat: add doripe deck domain fixtures"
```

---

## Task 3: Deck Session Storage Service

**Files:**
- Create: `doripe-mobile/src/services/deckSession.ts`
- Test: `doripe-mobile/__tests__/services/deckSession.test.ts`

- [ ] **Step 1: Write deck session tests**

Create `doripe-mobile/__tests__/services/deckSession.test.ts`:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ActiveDeckSession, SavedPlace } from "../../src/domain/types";
import {
  addSelectedPlace,
  addSkippedPlace,
  confirmSelectedPlaces,
  getDeckSession,
  setDeckSession,
} from "../../src/services/deckSession";
import { getSavedPlaceIds } from "../../src/services/savedPlaces";
import { readJson } from "../../src/services/storage";

const SAVED_PLACES_STORAGE_KEY = "doripe.savedPlaces";

describe("deckSession service", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("stores one active session per access code", async () => {
    const session: ActiveDeckSession = {
      accessCodeId: "access-0000",
      regionId: "yongsan_hbc",
      deckId: "yongsan-solo-afternoon",
      seenPlaceIds: [],
      selectedPlaceIds: [],
      skippedPlaceIds: [],
      updatedAt: "2026-05-18T00:00:00+09:00",
    };

    await setDeckSession(session);

    expect(await getDeckSession("access-0000")).toEqual(session);
  });

  it("adds selected and skipped places without duplicates", async () => {
    await setDeckSession({
      accessCodeId: "access-0000",
      regionId: "yongsan_hbc",
      deckId: "yongsan-solo-afternoon",
      seenPlaceIds: [],
      selectedPlaceIds: [],
      skippedPlaceIds: [],
      updatedAt: "2026-05-18T00:00:00+09:00",
    });

    await addSelectedPlace("access-0000", "yongsan-001", "2026-05-18T00:01:00+09:00");
    await addSelectedPlace("access-0000", "yongsan-001", "2026-05-18T00:02:00+09:00");
    await addSkippedPlace("access-0000", "yongsan-002", "2026-05-18T00:03:00+09:00");

    const session = await getDeckSession("access-0000");
    expect(session?.seenPlaceIds).toEqual(["yongsan-001", "yongsan-002"]);
    expect(session?.selectedPlaceIds).toEqual(["yongsan-001"]);
    expect(session?.skippedPlaceIds).toEqual(["yongsan-002"]);
  });

  it("persists final selected places into saved storage", async () => {
    await confirmSelectedPlaces("access-0000", ["yongsan-002", "yongsan-001"], "2026-05-18T00:04:00+09:00");
    const saved = await readJson<SavedPlace[]>(SAVED_PLACES_STORAGE_KEY, []);

    expect(getSavedPlaceIds(saved, "access-0000")).toEqual(["yongsan-002", "yongsan-001"]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd doripe-mobile
npm test -- __tests__/services/deckSession.test.ts
```

Expected: FAIL because `deckSession` module does not exist.

- [ ] **Step 3: Implement `deckSession`**

Create `doripe-mobile/src/services/deckSession.ts`:

```ts
import type { ActiveDeckSession, SavedPlace } from "../domain/types";
import { addSavedPlace } from "./savedPlaces";
import { readJson, writeJson } from "./storage";

const DECK_SESSION_STORAGE_KEY = "doripe.deckSessions";
const SAVED_PLACES_STORAGE_KEY = "doripe.savedPlaces";

type DeckSessionRecord = Record<string, ActiveDeckSession>;

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export async function getDeckSession(accessCodeId: string): Promise<ActiveDeckSession | null> {
  const sessions = await readJson<DeckSessionRecord>(DECK_SESSION_STORAGE_KEY, {});
  return sessions[accessCodeId] ?? null;
}

export async function setDeckSession(session: ActiveDeckSession): Promise<void> {
  const sessions = await readJson<DeckSessionRecord>(DECK_SESSION_STORAGE_KEY, {});
  await writeJson(DECK_SESSION_STORAGE_KEY, {
    ...sessions,
    [session.accessCodeId]: session,
  });
}

export async function addSelectedPlace(
  accessCodeId: string,
  placeId: string,
  updatedAt: string,
): Promise<void> {
  const session = await getDeckSession(accessCodeId);
  if (!session) {
    return;
  }

  await setDeckSession({
    ...session,
    seenPlaceIds: unique([...session.seenPlaceIds, placeId]),
    selectedPlaceIds: unique([...session.selectedPlaceIds, placeId]),
    skippedPlaceIds: session.skippedPlaceIds.filter((id) => id !== placeId),
    updatedAt,
  });
}

export async function addSkippedPlace(
  accessCodeId: string,
  placeId: string,
  updatedAt: string,
): Promise<void> {
  const session = await getDeckSession(accessCodeId);
  if (!session) {
    return;
  }

  await setDeckSession({
    ...session,
    seenPlaceIds: unique([...session.seenPlaceIds, placeId]),
    selectedPlaceIds: session.selectedPlaceIds.filter((id) => id !== placeId),
    skippedPlaceIds: unique([...session.skippedPlaceIds, placeId]),
    updatedAt,
  });
}

export async function setSelectedPlaces(
  accessCodeId: string,
  selectedPlaceIds: string[],
  updatedAt: string,
): Promise<void> {
  const session = await getDeckSession(accessCodeId);
  if (!session) {
    return;
  }

  await setDeckSession({
    ...session,
    selectedPlaceIds: unique(selectedPlaceIds),
    updatedAt,
  });
}

export async function confirmSelectedPlaces(
  accessCodeId: string,
  selectedPlaceIds: string[],
  createdAt: string,
): Promise<void> {
  const existingSavedPlaces = await readJson<SavedPlace[]>(SAVED_PLACES_STORAGE_KEY, []);
  const nextSavedPlaces = selectedPlaceIds.reduce(
    (savedPlaces, placeId) => addSavedPlace(savedPlaces, accessCodeId, placeId, createdAt),
    existingSavedPlaces,
  );

  await writeJson(SAVED_PLACES_STORAGE_KEY, nextSavedPlaces);
}
```

- [ ] **Step 4: Run service tests**

Run:

```bash
cd doripe-mobile
npm test -- __tests__/services/deckSession.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add doripe-mobile/src/services/deckSession.ts doripe-mobile/__tests__/services/deckSession.test.ts
git commit -m "feat: add deck session storage"
```

---

## Task 4: Navigation Flow

**Files:**
- Modify: `doripe-mobile/src/navigation/AppNavigator.tsx`

- [ ] **Step 1: Replace navigation types**

In `doripe-mobile/src/navigation/AppNavigator.tsx`, define these param lists:

```ts
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { Deck, Region } from "../domain/types";

export type MapStackParamList = {
  MapHome: undefined;
  DeckGallery: { regionId: Region["id"] };
  Discover: { regionId: Region["id"]; deckId: Deck["id"] };
  PlaceGallery: { regionId: Region["id"]; deckId: Deck["id"] };
};

type TabParamList = {
  Map: undefined;
  Saved: undefined;
  Route: undefined;
};
```

- [ ] **Step 2: Add Map stack component**

Add:

```tsx
const MapStack = createNativeStackNavigator<MapStackParamList>();

function MapStackNavigator({ accessCodeId }: { accessCodeId: string }) {
  return (
    <MapStack.Navigator screenOptions={{ headerShown: false }}>
      <MapStack.Screen name="MapHome">
        {(props) => <MapScreen {...props} accessCodeId={accessCodeId} />}
      </MapStack.Screen>
      <MapStack.Screen name="DeckGallery">
        {(props) => <DeckGalleryScreen {...props} accessCodeId={accessCodeId} />}
      </MapStack.Screen>
      <MapStack.Screen name="Discover">
        {(props) => <DiscoverScreen {...props} accessCodeId={accessCodeId} />}
      </MapStack.Screen>
      <MapStack.Screen name="PlaceGallery">
        {(props) => <PlaceGalleryScreen {...props} accessCodeId={accessCodeId} />}
      </MapStack.Screen>
    </MapStack.Navigator>
  );
}
```

Add imports for `MapScreen`, `DeckGalleryScreen`, and `PlaceGalleryScreen`.

- [ ] **Step 3: Change tabs to Map/Saved/Route**

Inside `Tab.Navigator`, replace old Discover tab with:

```tsx
<Tab.Screen name="Map" options={{ title: "지도" }}>
  {() => <MapStackNavigator accessCodeId={accessCodeId} />}
</Tab.Screen>
<Tab.Screen name="Saved" options={{ title: "저장함" }}>
  {() => <SavedScreen accessCodeId={accessCodeId} />}
</Tab.Screen>
<Tab.Screen name="Route" options={{ title: "방문 순서" }}>
  {() => <RouteScreen accessCodeId={accessCodeId} />}
</Tab.Screen>
```

- [ ] **Step 4: Run typecheck to see missing screen errors**

Run:

```bash
cd doripe-mobile
npm run typecheck
```

Expected: FAIL until the new screens are created.

Do not commit this task alone. Continue to Task 5.

---

## Task 5: Map And Deck Gallery Screens

**Files:**
- Create: `doripe-mobile/src/screens/MapScreen.tsx`
- Create: `doripe-mobile/src/screens/DeckGalleryScreen.tsx`

- [ ] **Step 1: Create `MapScreen`**

Create `doripe-mobile/src/screens/MapScreen.tsx`:

```tsx
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppScaffold } from "../components/AppScaffold";
import { regions } from "../domain/fixtures";
import type { MapStackParamList } from "../navigation/AppNavigator";
import { recordEvent } from "../services/events";
import { colors, radius, spacing, typography } from "../theme/tokens";

type MapScreenProps = NativeStackScreenProps<MapStackParamList, "MapHome"> & {
  accessCodeId: string;
};

export function MapScreen({ accessCodeId, navigation }: MapScreenProps) {
  async function handleRegionPress(regionId: MapStackParamList["DeckGallery"]["regionId"]) {
    await recordEvent({ accessCodeId, eventName: "region_selected" });
    navigation.navigate("DeckGallery", { regionId });
  }

  return (
    <AppScaffold>
      <Text style={styles.title}>오늘은 어느 동네로{"\n"}가볼까요?</Text>
      <Text style={styles.copy}>서울 지도에서 지금 열려 있는 동네를 선택해요.</Text>

      <View style={styles.mapCard}>
        <View style={styles.river} />
        {regions.map((region) => (
          <Pressable
            key={region.id}
            accessibilityRole="button"
            accessibilityLabel={`${region.name} 덱 보기`}
            onPress={() => handleRegionPress(region.id)}
            style={[styles.pinWrap, { left: region.mapPin.x - 28, top: region.mapPin.y - 206 }]}
          >
            <View style={styles.pinOuter}>
              <View style={styles.pin} />
            </View>
            <Text style={styles.pinLabel}>{region.shortName}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.note}>핀을 누르면 그 동네의 덱을 고를 수 있어요.</Text>
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: "900",
    lineHeight: 33,
    marginTop: spacing.lg,
  },
  copy: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: spacing.md,
  },
  mapCard: {
    backgroundColor: "#E5EBDB",
    borderRadius: 18,
    height: 438,
    marginTop: spacing.xl,
    overflow: "hidden",
    position: "relative",
  },
  river: {
    backgroundColor: "rgba(163, 199, 184, 0.8)",
    height: 44,
    left: 0,
    position: "absolute",
    right: 0,
    top: 249,
  },
  pinWrap: {
    alignItems: "center",
    position: "absolute",
  },
  pinOuter: {
    alignItems: "center",
    backgroundColor: "rgba(33, 240, 115, 0.18)",
    borderRadius: radius.pill,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  pin: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 14,
    width: 14,
  },
  pinLabel: {
    backgroundColor: "rgba(9, 11, 10, 0.88)",
    borderRadius: radius.pill,
    color: colors.white,
    fontSize: 9,
    fontWeight: "900",
    marginTop: 3,
    minWidth: 78,
    overflow: "hidden",
    paddingVertical: 6,
    textAlign: "center",
  },
  note: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: spacing.xl,
    textAlign: "center",
  },
});
```

- [ ] **Step 2: Create `DeckGalleryScreen`**

Create `doripe-mobile/src/screens/DeckGalleryScreen.tsx`:

```tsx
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BackButton } from "../components/BackButton";
import { Chip } from "../components/Chip";
import { GradientCard } from "../components/GradientCard";
import { decks, regions } from "../domain/fixtures";
import { getActiveDecksByRegionId, getRegionById } from "../domain/selectors";
import type { MapStackParamList } from "../navigation/AppNavigator";
import { recordEvent } from "../services/events";
import { setDeckSession } from "../services/deckSession";
import { colors, spacing, typography } from "../theme/tokens";

type DeckGalleryScreenProps = NativeStackScreenProps<MapStackParamList, "DeckGallery"> & {
  accessCodeId: string;
};

export function DeckGalleryScreen({ accessCodeId, navigation, route }: DeckGalleryScreenProps) {
  const region = getRegionById(regions, route.params.regionId);
  const regionDecks = getActiveDecksByRegionId(decks, route.params.regionId);

  async function handleDeckPress(deckId: string) {
    await setDeckSession({
      accessCodeId,
      regionId: route.params.regionId,
      deckId,
      seenPlaceIds: [],
      selectedPlaceIds: [],
      skippedPlaceIds: [],
      updatedAt: new Date().toISOString(),
    });
    await recordEvent({ accessCodeId, eventName: "deck_selected" });
    navigation.navigate("Discover", { regionId: route.params.regionId, deckId });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topRow}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.kicker}>{region?.shortName.toUpperCase() ?? "REGION"}</Text>
      </View>
      <Text style={styles.title}>{region?.name ?? "동네"}</Text>
      <Text style={styles.copy}>원하는 분위기의 덱을 고르면, 그 안에서 장소를 둘러볼 수 있어요.</Text>

      {regionDecks.map((deck) => (
        <Pressable key={deck.id} accessibilityRole="button" onPress={() => handleDeckPress(deck.id)}>
          <GradientCard tone={deck.tone} style={styles.deckCard}>
            <View style={styles.chips}>
              {deck.tags.map((tag, index) => <Chip key={tag} label={tag} active={index === 0} />)}
            </View>
            <Text style={styles.deckTitle}>{deck.title}</Text>
            <Text style={styles.deckCopy}>{deck.shortCopy}</Text>
          </GradientCard>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.md, paddingBottom: spacing.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.xxl },
  topRow: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  kicker: { color: colors.primaryInk, fontSize: 11, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 29, fontWeight: "900", lineHeight: 35, marginTop: spacing.sm },
  copy: { color: colors.muted, fontSize: typography.caption, fontWeight: "700", lineHeight: 19 },
  deckCard: { height: 150, padding: spacing.lg },
  chips: { flexDirection: "row", gap: spacing.sm, marginBottom: "auto" },
  deckTitle: { color: colors.white, fontSize: 23, fontWeight: "900", lineHeight: 28 },
  deckCopy: { color: colors.white, fontSize: 11, fontWeight: "800", lineHeight: 14 },
});
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
cd doripe-mobile
npm run typecheck
```

Expected: FAIL only for missing `PlaceGalleryScreen` or Discover prop shape until later tasks.

Do not commit until Task 6 completes.

---

## Task 6: Discover And Place Gallery

**Files:**
- Modify: `doripe-mobile/src/screens/DiscoverScreen.tsx`
- Create: `doripe-mobile/src/screens/PlaceGalleryScreen.tsx`

- [ ] **Step 1: Replace Discover props and behavior**

Modify `DiscoverScreen` to accept stack props:

```ts
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MapStackParamList } from "../navigation/AppNavigator";

type DiscoverScreenProps = NativeStackScreenProps<MapStackParamList, "Discover"> & {
  accessCodeId: string;
};
```

Use:

```ts
const deckPlaceList = useMemo(
  () => getPlacesForDeck(deckPlaces, places, route.params.deckId),
  [route.params.deckId],
);
```

Save action:

```ts
await addSelectedPlace(accessCodeId, currentPlace.id, new Date().toISOString());
await recordEvent({ accessCodeId, eventName: "place_saved", placeId: currentPlace.id });
advanceCard();
```

Skip action:

```ts
await addSkippedPlace(accessCodeId, currentPlace.id, new Date().toISOString());
await recordEvent({ accessCodeId, eventName: "place_skipped", placeId: currentPlace.id });
advanceCard();
```

Finished state CTA:

```tsx
<PrimaryButton
  label="고른 장소 확인하기"
  onPress={() => navigation.navigate("PlaceGallery", route.params)}
/>
```

- [ ] **Step 2: Create `PlaceGalleryScreen`**

Create `doripe-mobile/src/screens/PlaceGalleryScreen.tsx` with these core behaviors:

```tsx
import { useCallback, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { BackButton } from "../components/BackButton";
import { Chip } from "../components/Chip";
import { GradientCard } from "../components/GradientCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { deckPlaces, places } from "../domain/fixtures";
import { getPlacesForDeck } from "../domain/selectors";
import type { MapStackParamList } from "../navigation/AppNavigator";
import { confirmSelectedPlaces, getDeckSession, setSelectedPlaces } from "../services/deckSession";
import { recordEvent } from "../services/events";
import { colors, spacing, typography } from "../theme/tokens";

type PlaceGalleryScreenProps = NativeStackScreenProps<MapStackParamList, "PlaceGallery"> & {
  accessCodeId: string;
};

export function PlaceGalleryScreen({ accessCodeId, navigation, route }: PlaceGalleryScreenProps) {
  const deckPlaceList = getPlacesForDeck(deckPlaces, places, route.params.deckId);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getDeckSession(accessCodeId).then((session) => {
        if (active) {
          setSelectedPlaceIds(session?.selectedPlaceIds ?? []);
        }
      });
      void recordEvent({ accessCodeId, eventName: "place_gallery_opened" });
      return () => {
        active = false;
      };
    }, [accessCodeId]),
  );

  function togglePlace(placeId: string) {
    setSelectedPlaceIds((current) =>
      current.includes(placeId) ? current.filter((id) => id !== placeId) : [...current, placeId],
    );
  }

  async function confirmSelection() {
    const now = new Date().toISOString();
    await setSelectedPlaces(accessCodeId, selectedPlaceIds, now);
    await confirmSelectedPlaces(accessCodeId, selectedPlaceIds, now);
    await recordEvent({ accessCodeId, eventName: "place_selection_confirmed" });
    navigation.getParent()?.navigate("Saved");
  }

  const canConfirm = selectedPlaceIds.length >= 2;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topRow}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.kicker}>YONGSAN / HBC Deck</Text>
      </View>
      <Text style={styles.title}>이 덱에서{"\n"}갈 곳을 골라요</Text>
      <Text style={styles.copy}>사진 카드를 눌러 선택해요. 선택한 장소만 저장/루트에 반영됩니다.</Text>
      <View style={styles.chips}>
        <Chip label={`${selectedPlaceIds.length}개 선택`} active />
        <Chip label="최소 2곳" />
      </View>

      {deckPlaceList.map((place, index) => (
        <Pressable key={place.id} accessibilityRole="button" onPress={() => togglePlace(place.id)}>
          <GradientCard imageUrl={place.coverImageUrl} tone={index % 2 === 0 ? "sunset" : "lane"} style={index === 0 ? styles.featuredCard : styles.placeCard}>
            <Text style={styles.index}>{String(index + 1).padStart(2, "0")}</Text>
            {selectedPlaceIds.includes(place.id) ? <Text style={styles.check}>●</Text> : null}
            <Text style={styles.placeName}>{place.name}</Text>
            <Text style={styles.placeCopy}>{place.shortCopy}</Text>
          </GradientCard>
        </Pressable>
      ))}

      <PrimaryButton
        label={canConfirm ? "선택한 장소로 보기" : "최소 2곳을 골라주세요"}
        disabled={!canConfirm}
        onPress={confirmSelection}
      />
    </ScrollView>
  );
}
```

Add styles matching the Figma values: background `colors.background`, horizontal padding `spacing.lg`, title `30/36`, featured card height `154`, normal card height `150`, CTA at bottom via scroll content gap.

- [ ] **Step 3: Run typecheck**

Run:

```bash
cd doripe-mobile
npm run typecheck
```

Expected: PASS or only style typing errors. Fix style typing errors by using `StyleProp<ViewStyle>` in `GradientCard` if needed.

- [ ] **Step 4: Commit navigation/screens together**

```bash
git add doripe-mobile/src/navigation/AppNavigator.tsx doripe-mobile/src/screens/MapScreen.tsx doripe-mobile/src/screens/DeckGalleryScreen.tsx doripe-mobile/src/screens/DiscoverScreen.tsx doripe-mobile/src/screens/PlaceGalleryScreen.tsx
git commit -m "feat: add map deck discover flow"
```

---

## Task 7: Access, Saved, Route, And Korean Cleanup

**Files:**
- Modify: `doripe-mobile/src/screens/AccessCodeScreen.tsx`
- Modify: `doripe-mobile/src/screens/SavedScreen.tsx`
- Modify: `doripe-mobile/src/screens/RouteScreen.tsx`
- Modify: `doripe-mobile/src/components/PlaceCard.tsx`
- Update tests touching old strings.

- [ ] **Step 1: Fix Access text**

In `AccessCodeScreen`, replace visible text:

```tsx
setMessage("현재 사용할 수 없는 코드입니다.");
setMessage("코드를 확인해 주세요.");
```

Hero copy:

```tsx
<Text style={styles.eyebrow}>초대받은 사람만 먼저</Text>
<Text style={styles.title}>초대 코드를{"\n"}입력하세요</Text>
<Text style={styles.copy}>이메일로 받은 네 자리 코드를 입력하고 Doripe를 시작하세요.</Text>
```

Button:

```tsx
<Text style={[styles.buttonText, !canSubmit && styles.buttonTextDisabled]}>시작</Text>
```

Accessibility label:

```tsx
accessibilityLabel="초대 코드 입력"
accessibilityLabel="시작"
```

- [ ] **Step 2: Fix PlaceCard Korean**

In `PlaceCard`, change:

```ts
const meta = [place.subArea, categoryName].filter(Boolean).join(" · ");
```

Accessibility labels:

```tsx
accessibilityLabel={`${place.name} 건너뛰기`}
accessibilityLabel={`${place.name} 저장`}
```

Button labels:

```tsx
<Text style={[styles.actionText, styles.skipText, disabled && styles.disabledText]}>×</Text>
<Text style={[styles.actionText, styles.saveText, disabled && styles.disabledText]}>저장</Text>
```

- [ ] **Step 3: Update Saved screen visual direction**

Use bright background and Korean strings:

```tsx
<Text style={styles.kicker}>SAVED</Text>
<Text style={styles.title}>저장함</Text>
```

Empty copy:

```tsx
<Text style={styles.emptyCopy}>마음에 드는 장소를 저장하면 여기에서 다시 볼 수 있어요.</Text>
```

Map link label:

```tsx
<Text style={styles.mapLinkText}>네이버 열기</Text>
```

Accessibility label:

```tsx
accessibilityLabel={`${item.name} 네이버 지도에서 보기`}
```

Set `screen.backgroundColor = colors.background`, cards `colors.surface`, text `colors.ink`.

- [ ] **Step 4: Update Route screen text**

Open `doripe-mobile/src/screens/RouteScreen.tsx`, replace corrupted Korean with:

- Title: `방문 순서`
- Copy: `저장한 장소를 방문하기 좋은 순서로 연결해요.`
- Empty: `저장한 장소가 2곳 이상이면 방문 순서를 볼 수 있어요.`
- Link: `네이버 열기`

Ensure it does not say "optimal route".

- [ ] **Step 5: Run tests likely affected by strings**

Run:

```bash
cd doripe-mobile
npm test -- __tests__/screens __tests__/components
```

Expected: update snapshots/assertions until PASS.

- [ ] **Step 6: Commit**

```bash
git add doripe-mobile/src/screens doripe-mobile/src/components doripe-mobile/__tests__
git commit -m "fix: clean korean copy and bright saved route screens"
```

---

## Task 8: Verification And Preview

**Files:**
- Potentially modify: `doripe-mobile/scripts/validate-content.mjs` if fixture schema changed and validation fails.
- Potentially modify: tests to reflect finalized route.

- [ ] **Step 1: Run full typecheck**

```bash
cd doripe-mobile
npm run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run full tests**

```bash
cd doripe-mobile
npm test
```

Expected: PASS.

- [ ] **Step 3: Run content validation**

```bash
cd doripe-mobile
npm run validate:content
```

Expected: PASS. If it fails because `fixtures.ts` now has IDs like `yongsan-001`, update the validator to use the new canonical fixture shape, then rerun.

- [ ] **Step 4: Start web preview**

```bash
cd doripe-mobile
npm run web -- --port 8082
```

Expected: Expo web server starts on `http://localhost:8082`.

- [ ] **Step 5: Manual flow check**

Use the preview:

- Enter `0000`.
- Confirm Map is first.
- Tap `용산·후암` pin.
- Tap `혼자 걷는 오후`.
- Confirm Discover card appears.
- Save/skip through the deck.
- Confirm finished state goes to Place Gallery.
- Select at least two places.
- Confirm it navigates to Saved.
- Open Route tab and confirm route order appears.

- [ ] **Step 6: Final commit if verification changed files**

```bash
git status --short
git add doripe-mobile
git commit -m "test: verify doripe mvp flow"
```

Only commit if Step 1-5 required additional changes after prior commits.
