export function createInitialState() {
  return { screen: "welcome", startPlaceId: null, selectedPlaceIds: [] };
}

export const resetState = createInitialState;

export function startDiscovery() {
  return { screen: "feed", startPlaceId: null, selectedPlaceIds: [] };
}

export function openPlace(state, placeId) {
  if (state.screen !== "feed") throw new Error("Place can only open from feed");
  return { ...state, screen: "detail", startPlaceId: placeId, selectedPlaceIds: [] };
}

export function browseNearby(state) {
  if (state.screen !== "detail" || !state.startPlaceId) throw new Error("A starting place is required");
  return { ...state, screen: "builder" };
}

export function toggleAdditionalPlace(state, placeId) {
  if (state.screen !== "builder" || placeId === state.startPlaceId) return state;
  const selected = state.selectedPlaceIds.includes(placeId)
    ? state.selectedPlaceIds.filter((id) => id !== placeId)
    : [...state.selectedPlaceIds, placeId];
  return { ...state, selectedPlaceIds: selected };
}

export function chooseAdditionalPlacePhoto(state, placeId, image, activeImage) {
  if (state.screen !== "builder" || placeId === state.startPlaceId) {
    return { state, image: activeImage };
  }

  const isSelected = state.selectedPlaceIds.includes(placeId);
  if (isSelected && activeImage !== image) return { state, image };

  const nextState = toggleAdditionalPlace(state, placeId);
  return {
    state: nextState,
    image: nextState.selectedPlaceIds.includes(placeId) ? image : null
  };
}

export function completeCourse(state) {
  if (state.screen !== "builder" || state.selectedPlaceIds.length < 1) {
    throw new Error("At least one additional place is required");
  }
  return { ...state, screen: "complete" };
}
