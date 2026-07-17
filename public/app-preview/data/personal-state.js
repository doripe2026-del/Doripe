const clone = (value) => structuredClone(value);

export function mergePersonalSnapshotIntoState(state = {}, snapshot = {}) {
  if (snapshot.personalDataLoaded !== true) return clone(state);

  const viewer = (snapshot.profiles || []).find((profile) => profile.id === snapshot.viewerProfileId) || null;
  const savedCourseIds = new Set(snapshot.savedCourseIds || []);
  const savedRoutes = (snapshot.courses || [])
    .filter((course) => savedCourseIds.has(course.id))
    .map((course) => ({
      id: course.id,
      name: course.name,
      placeIds: [...(course.placeIds || [])]
    }));

  return {
    ...clone(state),
    savedPlaceIds: [...(snapshot.savedPlaceIds || [])],
    savedRoutes,
    profile: viewer ? {
      id: viewer.id,
      nickname: viewer.name || viewer.handle || "",
      bio: viewer.bio || "",
      avatarUrl: viewer.avatarUrl || ""
    } : undefined
  };
}
