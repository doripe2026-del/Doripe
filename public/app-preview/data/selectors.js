export const byId = (items, id) => items.find((item) => item.id === id) || null;
export const placeById = (data, id) => byId(data.places, id);
export const mediaById = (data, id) => byId(data.media, id);
export const profileById = (data, id) => byId(data.profiles, id);
export const tagById = (data, id) => byId(data.tags, id);
export const courseById = (data, id) => byId(data.courses, id);
export const contentById = (data, id) => byId(data.contents, id);

export function mediaForPlace(data, place) {
  return (place?.mediaIds || []).map((id) => mediaById(data, id)).filter(Boolean);
}

export function tagsFor(data, item) {
  return (item?.tagIds || []).map((id) => tagById(data, id)).filter(Boolean);
}

export function commentsForContent(data, contentId) {
  return data.comments.filter((comment) => comment.contentId === contentId);
}

export function createDataCatalog(data) {
  const placeIds = new Set(data.places.map((item) => item.id));
  const courseIds = new Set(data.courses.map((item) => item.id));
  return Object.freeze({
    isKnownPlaceId: (id) => placeIds.has(id),
    isKnownCourseId: (id) => courseIds.has(id)
  });
}
