declare const require: (moduleName: string) => {
  default?: AsyncStorageLike;
  getItem?: AsyncStorageLike["getItem"];
  setItem?: AsyncStorageLike["setItem"];
};

type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>;
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
