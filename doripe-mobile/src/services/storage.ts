declare const require: (moduleName: string) => {
  default?: AsyncStorageLike;
  getItem?: AsyncStorageLike["getItem"];
  removeItem?: AsyncStorageLike["removeItem"];
  setItem?: AsyncStorageLike["setItem"];
};

type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

function getAsyncStorage(): AsyncStorageLike {
  const module = require("@react-native-async-storage/async-storage");
  return (module.default ?? module) as AsyncStorageLike;
}

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  const AsyncStorage = getAsyncStorage();
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
  const AsyncStorage = getAsyncStorage();
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeJson(key: string): Promise<void> {
  const AsyncStorage = getAsyncStorage();
  await AsyncStorage.removeItem(key);
}
