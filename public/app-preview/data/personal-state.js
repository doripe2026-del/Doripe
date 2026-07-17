const clone = (value) => structuredClone(value);

function mergeUniqueIds(primary = [], secondary = []) {
  return [...new Set([...primary, ...secondary])];
}

function mergeRoutes(serverRoutes, localRoutes) {
  const serverIds = new Set(serverRoutes.map((route) => route.id));
  return [
    ...serverRoutes,
    ...localRoutes.filter((route) => !serverIds.has(route.id))
  ];
}

export function mergePersonalSnapshotIntoState(state = {}, snapshot = {}, { preserveGuestData = false } = {}) {
  if (snapshot.personalDataLoaded !== true) return clone(state);

  const viewer = (snapshot.profiles || []).find((profile) => profile.id === snapshot.viewerProfileId) || null;
  const savedCourseIds = new Set([
    ...(snapshot.savedCourseIds || []),
    ...(snapshot.ownedCourseIds || [])
  ]);
  const savedRoutes = (snapshot.courses || [])
    .filter((course) => savedCourseIds.has(course.id))
    .map((course) => ({
      id: course.id,
      name: course.name,
      placeIds: [...(course.placeIds || [])]
    }));

  const localSavedPlaceIds = preserveGuestData ? state.savedPlaceIds || [] : [];
  const localSavedRoutes = preserveGuestData ? state.savedRoutes || [] : [];

  return {
    ...clone(state),
    savedPlaceIds: mergeUniqueIds(snapshot.savedPlaceIds || [], localSavedPlaceIds),
    savedRoutes: mergeRoutes(savedRoutes, localSavedRoutes),
    profile: viewer ? {
      id: viewer.id,
      nickname: viewer.name || viewer.handle || "",
      bio: viewer.bio || "",
      avatarUrl: viewer.avatarUrl || ""
    } : undefined
  };
}
