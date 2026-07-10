import { PLACES, ROUTES, TAGS, USERS } from "./fixtures.js";

function clone(value) {
  return structuredClone(value);
}

function fixtureNotFound(resource, id) {
  const error = new Error(`Unknown fixture ${resource}: ${id}`);
  error.code = "FIXTURE_NOT_FOUND";
  error.resource = resource;
  error.resourceId = id;
  return error;
}

function fixtureOperationError(operation) {
  const error = new Error(`Deterministic fixture failure: ${operation}`);
  error.code = "FIXTURE_OPERATION_FAILED";
  error.operation = operation;
  return error;
}

export function createFixtureAdapter() {
  return Object.freeze({
    mode: "fixture",
    async getPlaces() {
      return clone(PLACES);
    },
    async getUsers() {
      return clone(USERS);
    },
    async getTags() {
      return clone(TAGS);
    },
    async getRoutes() {
      return clone(ROUTES);
    },
    async savePlace(placeId) {
      if (!PLACES.some((place) => place.id === placeId)) throw fixtureNotFound("place", placeId);
      return { placeId, saved: true };
    },
    async followUser(userId) {
      if (!USERS.some((user) => user.id === userId)) throw fixtureNotFound("user", userId);
      return { userId, followed: true };
    }
  });
}

export function createFailingFixtureAdapter() {
  const fixture = createFixtureAdapter();

  return Object.freeze({
    ...fixture,
    mode: "fixture-error",
    async savePlace() {
      throw fixtureOperationError("savePlace");
    },
    async followUser() {
      throw fixtureOperationError("followUser");
    }
  });
}

export function getAdapter(mode = "fixture") {
  if (mode === "fixture-error") return createFailingFixtureAdapter();
  if (mode !== "fixture") throw new Error(`Unsupported preview adapter: ${mode}`);
  return createFixtureAdapter();
}
