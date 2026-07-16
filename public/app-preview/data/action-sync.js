const MUTATION_ERROR_MESSAGE = "변경사항을 저장하지 못했어요. 다시 시도해 주세요.";
const UNSUPPORTED_LIKE_MESSAGE = "이 좋아요는 아직 서버 저장을 지원하지 않아요.";

function includes(items, id) {
  return Array.isArray(items) && items.includes(id);
}

function courseFor(payload, routeId) {
  return payload?.data?.courses?.find((course) => course.id === routeId) || null;
}

function routesMatch(first, second) {
  return first?.name === second?.name
    && first?.placeIds?.length === second?.placeIds?.length
    && first.placeIds.every((placeId, index) => placeId === second.placeIds[index]);
}

function mutationKey({ actionId, payload = {}, previousState = {} }) {
  if (actionId === "save-place") return `place-save:${payload.placeId || payload.id || "unknown"}`;
  if (actionId === "toggle-follow") return `profile-follow:${payload.userId || payload.id || "unknown"}`;
  if (actionId === "toggle-comment-like") return `comment-like:${payload.commentId || payload.id || "unknown"}`;
  if (actionId === "toggle-media-like") return `media-like:${payload.mediaId || payload.id || "unknown"}`;
  if (actionId === "toggle-place-like") return `place-like:${payload.placeId || payload.id || "unknown"}`;
  if (["submit-comment", "submit-course-comment"].includes(actionId)) {
    return `comment-create:${payload.contentId || previousState.selections?.selectedContentId || "unknown"}`;
  }
  if (actionId === "save-shared-route") return `course-save:${payload.routeId || payload.id || "unknown"}`;
  if (actionId === "save-route") {
    const selectedId = previousState.selections?.selectedRouteId;
    const draft = previousState.routeDraft || {};
    return `course-write:${selectedId || `${draft.startPlaceId || "unknown"}:${(draft.placeIds || []).join(",")}`}`;
  }
  return null;
}

function requireMethod(repository, name) {
  if (typeof repository?.[name] === "function") return repository[name].bind(repository);
  throw Object.assign(new Error(`Repository mutation is unavailable: ${name}`), {
    code: "MUTATION_UNAVAILABLE"
  });
}

function replaceOptimisticComment(optimisticState, previousState, comment) {
  const previousIds = new Set((previousState.submittedComments || []).map((item) => item.id));
  let replaced = false;
  const submittedComments = (optimisticState.submittedComments || []).map((item) => {
    if (replaced || previousIds.has(item.id)) return item;
    replaced = true;
    return { ...item, ...comment };
  });
  return { ...optimisticState, submittedComments };
}

function replaceOptimisticCourse(optimisticState, course) {
  const optimisticId = optimisticState.selections?.selectedRouteId;
  return {
    ...optimisticState,
    savedRoutes: (optimisticState.savedRoutes || []).map((item) => (
      item.id === optimisticId ? { ...item, ...course } : item
    )),
    selections: {
      ...(optimisticState.selections || {}),
      selectedRouteId: course.id
    }
  };
}

function operationFor(repository, input) {
  const { actionId, payload = {}, previousState, optimisticState } = input;

  if (actionId === "save-place") {
    const id = payload.placeId || payload.id;
    const method = includes(previousState.savedPlaceIds, id) ? "unsavePlace" : "savePlace";
    return { execute: () => requireMethod(repository, method)(id), changedKeys: ["savedPlaceIds"] };
  }

  if (actionId === "toggle-follow") {
    const id = payload.userId || payload.id;
    const method = includes(previousState.followedUserIds, id) ? "unfollowProfile" : "followProfile";
    return { execute: () => requireMethod(repository, method)(id), changedKeys: ["followedUserIds"] };
  }

  if (actionId === "toggle-comment-like") {
    const id = payload.commentId || payload.id;
    const method = includes(previousState.likedCommentIds, id) ? "unlikeComment" : "likeComment";
    return { execute: () => requireMethod(repository, method)(id), changedKeys: ["likedCommentIds"] };
  }

  if (["toggle-media-like", "toggle-place-like"].includes(actionId)) {
    return {
      changedKeys: [actionId === "toggle-media-like" ? "likedMediaIds" : "likedPlaceIds"],
      execute: async () => {
        throw Object.assign(new Error(UNSUPPORTED_LIKE_MESSAGE), { code: "UNSUPPORTED_MUTATION" });
      }
    };
  }

  if (["submit-comment", "submit-course-comment"].includes(actionId)) {
    const field = actionId === "submit-course-comment" ? "courseComment" : "comment";
    const contentId = payload.contentId || previousState.selections?.selectedContentId;
    const body = previousState.form?.[field]?.trim();
    return {
      changedKeys: ["submittedComments", "form"],
      execute: () => requireMethod(repository, "createComment")(contentId, body),
      onSuccess: (comment) => replaceOptimisticComment(optimisticState, previousState, comment)
    };
  }

  if (actionId === "save-shared-route") {
    const routeId = payload.routeId || payload.id;
    const sourceRoute = courseFor(payload, routeId);
    const alreadySaved = sourceRoute
      ? (previousState.savedRoutes || []).some((route) => routesMatch(route, sourceRoute))
      : (previousState.savedRoutes || []).some((route) => route.id === routeId);
    const method = alreadySaved ? "unsaveCourse" : "saveCourse";
    return { execute: () => requireMethod(repository, method)(routeId), changedKeys: ["savedRoutes"] };
  }

  if (actionId === "save-route") {
    const draft = previousState.routeDraft || {};
    const name = previousState.form?.routeName?.trim();
    const selectedId = previousState.selections?.selectedRouteId;
    const existing = (previousState.savedRoutes || []).find((route) => route.id === selectedId)
      || courseFor(payload, selectedId);
    const isServerCourse = existing && Number.isInteger(existing.version) && existing.version > 0;
    const createInput = {
      name,
      visibility: existing?.visibility || "private",
      startPlaceId: draft.startPlaceId,
      placeIds: [...(draft.placeIds || [])]
    };
    return {
      changedKeys: ["savedRoutes", "selections"],
      execute: () => isServerCourse
        ? requireMethod(repository, "updateCourse")(existing.id, {
            name: createInput.name,
            visibility: createInput.visibility,
            placeIds: createInput.placeIds,
            expectedVersion: existing.version
          })
        : requireMethod(repository, "createCourse")(createInput),
      onSuccess: (course) => replaceOptimisticCourse(optimisticState, course)
    };
  }

  return null;
}

function failureMessage(error) {
  if (error?.code === "UNSUPPORTED_MUTATION" || error?.code === "AUTH_REQUIRED") return error.message;
  return MUTATION_ERROR_MESSAGE;
}

function prepareCommentState({ actionId, payload = {}, previousState, transitionState }) {
  if (!["submit-comment", "submit-course-comment"].includes(actionId)) return transitionState;
  if ((transitionState.submittedComments || []).length > (previousState.submittedComments || []).length) {
    return transitionState;
  }

  const field = actionId === "submit-course-comment" ? "courseComment" : "comment";
  const body = previousState.form?.[field]?.trim();
  const contentId = payload.contentId || previousState.selections?.selectedContentId;
  if (!body || !contentId) return transitionState;

  const submittedComments = previousState.submittedComments || [];
  return {
    ...transitionState,
    submittedComments: [...submittedComments, {
      id: `local-comment-${submittedComments.length + 1}`,
      contentId,
      ...(actionId === "submit-course-comment"
        ? { courseId: payload.routeId || previousState.selections?.selectedRouteId || null }
        : { placeId: payload.placeId || previousState.selections?.selectedPlaceId || null }),
      userId: payload.data?.viewerProfileId || null,
      body,
      likeCount: 0,
      createdAt: "local"
    }],
    form: { ...(transitionState.form || {}), [field]: "" },
    toast: { kind: "success", message: "댓글을 등록했어요", duration: 2500 }
  };
}

function hasOptimisticChange(operation, previousState, optimisticState) {
  return operation.changedKeys.some((key) => (
    JSON.stringify(previousState[key]) !== JSON.stringify(optimisticState[key])
  ));
}

export function createActionSync({ repository, enabled = true }) {
  const pending = new Map();

  return Object.freeze({
    prepare(input) {
      return enabled ? prepareCommentState(input) : input.transitionState;
    },
    isPending(input) {
      const key = mutationKey(input);
      return key ? pending.has(key) : false;
    },
    async run(input) {
      if (!enabled) return { ok: true, status: "local", state: input.optimisticState, changedKeys: [] };
      const key = mutationKey(input);
      if (!key) return { ok: true, status: "local", state: input.optimisticState, changedKeys: [] };
      if (pending.has(key)) return pending.get(key);

      const operation = operationFor(repository, input);
      if (!operation || !hasOptimisticChange(operation, input.previousState, input.optimisticState)) {
        return { ok: true, status: "local", state: input.optimisticState, changedKeys: [] };
      }
      const task = (async () => {
        try {
          const result = await operation.execute();
          return {
            ok: true,
            status: "synced",
            state: operation.onSuccess ? operation.onSuccess(result) : input.optimisticState,
            changedKeys: operation.changedKeys
          };
        } catch (error) {
          return {
            ok: false,
            status: "failed",
            error,
            changedKeys: operation.changedKeys,
            state: {
              ...input.previousState,
              toast: { kind: "error", message: failureMessage(error), duration: 4000 }
            }
          };
        } finally {
          pending.delete(key);
        }
      })();
      pending.set(key, task);
      return task;
    }
  });
}
