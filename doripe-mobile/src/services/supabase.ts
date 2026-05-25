import "react-native-url-polyfill/auto";

import { AppState } from "react-native";
import { createClient, processLock } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

declare const process: {
  env?: Record<string, string | undefined>;
};
declare const require: (moduleName: string) => { default: unknown };

const supabaseUrl = process.env?.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function createSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;

  const AsyncStorage = require("@react-native-async-storage/async-storage").default;
  return createClient(supabaseUrl as string, supabaseAnonKey as string, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      lock: processLock,
      persistSession: true,
      storage: AsyncStorage as never,
    },
  });
}

export const supabase = createSupabaseClient();

if (supabase) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void supabase.auth.startAutoRefresh();
      return;
    }

    void supabase.auth.stopAutoRefresh();
  });
}

export async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}
