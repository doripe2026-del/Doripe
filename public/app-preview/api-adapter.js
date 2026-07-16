import { createApiRepository } from "./data/api-repository.js";
import {
  createFailingFixtureRepository,
  createFixtureRepository
} from "./data/fixture-repository.js";

export {
  createFixtureRepository as createFixtureAdapter,
  createFailingFixtureRepository as createFailingFixtureAdapter
} from "./data/fixture-repository.js";
export { createApiRepository as createApiAdapter } from "./data/api-repository.js";

export function getAdapter(mode = "api", options = {}) {
  if (mode === "api") return createApiRepository(options);
  if (mode === "fixture") return createFixtureRepository();
  if (mode === "fixture-error") return createFailingFixtureRepository();
  throw new Error(`Unsupported preview repository: ${mode}`);
}
