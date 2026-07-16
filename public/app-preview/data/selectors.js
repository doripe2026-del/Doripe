export const byId = (items, id) => items.find((item) => item.id === id) || null;
export const placeById = (data, id) => byId(data.places, id);
export const mediaById = (data, id) => byId(data.media, id);
export const profileById = (data, id) => byId(data.profiles, id);
export const tagById = (data, id) => byId(data.tags, id);
export const courseById = (data, id) => byId(data.courses, id);
export const contentById = (data, id) => byId(data.contents, id);
export const viewerProfile = (data) => profileById(data, data.viewerProfileId);

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
  const mediaIds = new Set(data.media.map((item) => item.id));
  const profileIds = new Set(data.profiles.map((item) => item.id));
  const contentIds = new Set(data.contents.map((item) => item.id));
  const commentIds = new Set(data.comments.map((item) => item.id));
  const courseIds = new Set(data.courses.map((item) => item.id));
  return Object.freeze({
    isKnownPlaceId: (id) => placeIds.has(id),
    isKnownMediaId: (id) => mediaIds.has(id),
    isKnownProfileId: (id) => profileIds.has(id),
    isKnownContentId: (id) => contentIds.has(id),
    isKnownCommentId: (id) => commentIds.has(id),
    isKnownCourseId: (id) => courseIds.has(id)
  });
}
