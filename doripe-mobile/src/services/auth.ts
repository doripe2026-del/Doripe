import * as WebBrowser from "expo-web-browser";
import type { Session } from "@supabase/supabase-js";
import { readJson, removeJson, writeJson } from "./storage";
import { isSupabaseConfigured, supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

export const AUTH_ACCOUNTS_STORAGE_KEY = "doripe.auth.accounts";
export const AUTH_SESSION_STORAGE_KEY = "doripe.auth.session";

const AUTH_REDIRECT_URI = "doripe://auth/callback";
const KAKAO_OAUTH_PROVIDER = "custom:kakao";
const TEST_AUTH_ENABLED = process.env?.NODE_ENV === "test";
const AUTH_BOOT_TIMEOUT_MS = 4_000;
const OAUTH_TIMEOUT_MS = 120_000;

export type AuthProvider = "email" | "kakao";

export type AuthAccount = {
  id: string;
  accessCodeId: string;
  email: string;
  provider: AuthProvider;
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  accountId: string;
  accessCodeId: string;
  email: string;
  provider: AuthProvider;
  updatedAt: string;
};

export type AuthResult =
  | { ok: true; session: AuthSession }
  | { ok: false; message: string };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashText(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function hashPassword(email: string, password: string): string {
  return `local-v1-${hashText(`${normalizeEmail(email)}:${password}:doripe`)}`;
}

function createEmailAccessCodeId(email: string): string {
  return `access-email-${hashText(normalizeEmail(email))}`;
}

function createSession(account: AuthAccount): AuthSession {
  return {
    accountId: account.id,
    accessCodeId: account.accessCodeId,
    email: account.email,
    provider: account.provider,
    updatedAt: new Date().toISOString(),
  };
}

function inferProvider(session: Session): AuthProvider {
  const providers = session.user.app_metadata?.providers;
  const primaryProvider = Array.isArray(providers) && providers[0] ? String(providers[0]) : "";
  return primaryProvider.includes("kakao") ? "kakao" : "email";
}

function createRemoteSession(session: Session, provider: AuthProvider): AuthSession {
  const email = session.user.email ?? `${provider}-${session.user.id}@doripe.local`;
  return {
    accountId: session.user.id,
    accessCodeId: session.user.id,
    email,
    provider,
    updatedAt: new Date().toISOString(),
  };
}

function setupRequiredMessage(): string {
  if (!isSupabaseConfigured) {
    return "Supabase 연결값이 없어요. doripe-mobile/.env에 EXPO_PUBLIC_SUPABASE_URL과 EXPO_PUBLIC_SUPABASE_ANON_KEY를 넣어야 실제 로그인이 됩니다.";
  }

  return "Supabase 연결을 확인하지 못했어요. 앱을 다시 시작한 뒤 한 번 더 시도해 주세요.";
}

function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return "이메일 또는 비밀번호가 맞지 않아요.";
  }
  if (/email not confirmed/i.test(message)) {
    return "이메일 인증이 아직 끝나지 않았어요. 메일함에서 인증 링크를 눌러 주세요.";
  }
  if (/user already registered|already registered/i.test(message)) {
    return "이미 가입된 이메일이에요. 로그인으로 들어가 주세요.";
  }
  if (/weak password|password/i.test(message)) {
    return "비밀번호 조건을 확인해 주세요. 8자 이상으로 입력하는 것을 권장해요.";
  }

  return message;
}

function getRedirectParam(url: string, name: string): string | null {
  const normalizedUrl = url.replace("#", "?");
  const match = new RegExp(`[?&]${name}=([^&#]*)`).exec(normalizedUrl);
  return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : null;
}

async function withTimeout<T>(work: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), timeoutMs);
  });

  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function openOAuthSession(url: string): Promise<Awaited<ReturnType<typeof WebBrowser.openAuthSessionAsync>>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<Awaited<ReturnType<typeof WebBrowser.openAuthSessionAsync>>>((resolve) => {
    timeoutId = setTimeout(() => {
      void WebBrowser.dismissBrowser();
      resolve({ type: WebBrowser.WebBrowserResultType.CANCEL });
    }, OAUTH_TIMEOUT_MS);
  });

  try {
    return await Promise.race([WebBrowser.openAuthSessionAsync(url, AUTH_REDIRECT_URI), timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function upsertProfile(session: Session, provider: AuthProvider): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from("profiles").upsert({
    id: session.user.id,
    email: session.user.email ?? "",
    display_name:
      typeof session.user.user_metadata?.name === "string"
        ? session.user.user_metadata.name
        : "",
    provider,
    updated_at: new Date().toISOString(),
  });

  if (error && __DEV__) {
    console.warn("Failed to upsert auth profile", error.message);
  }
}

async function saveRemoteSession(session: Session, provider: AuthProvider): Promise<AuthSession> {
  await upsertProfile(session, provider);
  const authSession = createRemoteSession(session, provider);
  await writeJson(AUTH_SESSION_STORAGE_KEY, authSession);
  return authSession;
}

async function saveLocalTestSession(account: AuthAccount): Promise<AuthSession> {
  const session = createSession(account);
  await writeJson(AUTH_SESSION_STORAGE_KEY, session);
  return session;
}

export async function getStoredAuthSession(): Promise<AuthSession | null> {
  if (supabase) {
    const sessionResult = await withTimeout(supabase.auth.getSession(), AUTH_BOOT_TIMEOUT_MS, null);
    if (!sessionResult) {
      return null;
    }

    const { data } = sessionResult;
    if (data.session) {
      return saveRemoteSession(data.session, inferProvider(data.session));
    }

    await removeJson(AUTH_SESSION_STORAGE_KEY);
    return null;
  }

  if (TEST_AUTH_ENABLED) {
    return readJson<AuthSession | null>(AUTH_SESSION_STORAGE_KEY, null);
  }

  return null;
}

export async function signOut(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut();
  }

  await removeJson(AUTH_SESSION_STORAGE_KEY);
}

export async function signInWithProvider(provider: Exclude<AuthProvider, "email">): Promise<AuthResult> {
  if (provider !== "kakao") {
    return { ok: false, message: "지금 MVP에서는 카카오 로그인만 먼저 연결합니다." };
  }

  if (supabase) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: KAKAO_OAUTH_PROVIDER,
      options: {
        redirectTo: AUTH_REDIRECT_URI,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      return { ok: false, message: friendlyAuthError(error.message) };
    }

    if (!data.url) {
      return { ok: false, message: "카카오 로그인 주소를 만들지 못했어요. Supabase Kakao provider 설정을 확인해 주세요." };
    }

    const result = await openOAuthSession(data.url);
    if (result.type !== "success") {
      return { ok: false, message: "카카오 로그인이 취소되었어요." };
    }

    const oauthError = getRedirectParam(result.url, "error_description") ?? getRedirectParam(result.url, "error");
    if (oauthError) {
      return { ok: false, message: friendlyAuthError(oauthError) };
    }

    const code = getRedirectParam(result.url, "code");
    if (!code) {
      return { ok: false, message: "카카오 인증 코드를 받지 못했어요. Redirect URL 설정을 확인해 주세요." };
    }

    const exchange = await supabase.auth.exchangeCodeForSession(code);
    if (exchange.error) {
      return { ok: false, message: friendlyAuthError(exchange.error.message) };
    }

    const session = exchange.data.session;
    if (!session) {
      return { ok: false, message: "로그인 세션을 확인하지 못했어요. 다시 시도해 주세요." };
    }

    return { ok: true, session: await saveRemoteSession(session, "kakao") };
  }

  if (!TEST_AUTH_ENABLED) {
    return { ok: false, message: setupRequiredMessage() };
  }

  const now = new Date().toISOString();
  const account: AuthAccount = {
    id: "auth-kakao",
    accessCodeId: "access-social-kakao",
    email: "kakao@doripe.local",
    provider: "kakao",
    createdAt: now,
    updatedAt: now,
  };

  return { ok: true, session: await saveLocalTestSession(account) };
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = normalizeEmail(email);

  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: AUTH_REDIRECT_URI,
      },
    });

    if (error) {
      return { ok: false, message: friendlyAuthError(error.message) };
    }

    if (!data.session) {
      return {
        ok: false,
        message: "가입 확인 메일을 보냈어요. 메일 인증을 마친 뒤 로그인해 주세요. MVP 테스트를 바로 하려면 Supabase에서 이메일 확인을 꺼야 합니다.",
      };
    }

    return { ok: true, session: await saveRemoteSession(data.session, "email") };
  }

  if (!TEST_AUTH_ENABLED) {
    return { ok: false, message: setupRequiredMessage() };
  }

  const existing = await readJson<AuthAccount[]>(AUTH_ACCOUNTS_STORAGE_KEY, []);

  if (existing.some((account) => account.provider === "email" && account.email === normalizedEmail)) {
    return { ok: false, message: "이미 가입된 이메일이에요. 로그인으로 들어가 주세요." };
  }

  const now = new Date().toISOString();
  const account: AuthAccount = {
    id: `auth-email-${hashText(normalizedEmail)}`,
    accessCodeId: createEmailAccessCodeId(normalizedEmail),
    email: normalizedEmail,
    provider: "email",
    passwordHash: hashPassword(normalizedEmail, password),
    createdAt: now,
    updatedAt: now,
  };

  await writeJson(AUTH_ACCOUNTS_STORAGE_KEY, [...existing, account]);
  return { ok: true, session: await saveLocalTestSession(account) };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = normalizeEmail(email);

  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      return { ok: false, message: friendlyAuthError(error.message) };
    }

    if (!data.session) {
      return { ok: false, message: "로그인 세션을 확인하지 못했어요. 다시 시도해 주세요." };
    }

    return { ok: true, session: await saveRemoteSession(data.session, "email") };
  }

  if (!TEST_AUTH_ENABLED) {
    return { ok: false, message: setupRequiredMessage() };
  }

  const existing = await readJson<AuthAccount[]>(AUTH_ACCOUNTS_STORAGE_KEY, []);
  const account = existing.find((item) => item.provider === "email" && item.email === normalizedEmail);

  if (!account) {
    return { ok: false, message: "가입된 이메일이 아니에요. 회원가입을 먼저 해 주세요." };
  }

  if (account.passwordHash !== hashPassword(normalizedEmail, password)) {
    return { ok: false, message: "비밀번호가 맞지 않아요." };
  }

  return { ok: true, session: await saveLocalTestSession({ ...account, updatedAt: new Date().toISOString() }) };
}
