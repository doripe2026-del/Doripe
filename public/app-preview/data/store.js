import { createEmptyDataSnapshot, normalizeDataSnapshot } from "./contracts.js";

export function createAppDataStore({ repository }) {
  let current = Object.freeze({ status: "idle", data: createEmptyDataSnapshot(), error: null });

  return Object.freeze({
    getState: () => current,
    getSnapshot: () => current.data,
    async load() {
      current = Object.freeze({ ...current, status: "loading", error: null });
      try {
        const data = normalizeDataSnapshot(await repository.getBootstrap());
        current = Object.freeze({ status: "ready", data, error: null });
        return data;
      } catch (cause) {
        const error = Object.assign(new Error(`App data bootstrap failed: ${cause.message}`, { cause }), {
          code: "DATA_BOOTSTRAP_FAILED"
        });
        current = Object.freeze({ ...current, status: "error", error });
        throw error;
      }
    }
  });
}
