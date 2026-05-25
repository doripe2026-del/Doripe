import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import type { Session } from "@supabase/supabase-js";
import { readJson, writeJson } from "./storage";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

export const AUTH_ACCOUNTS_STORAGE_KEY = "doripe.auth.accounts";
export const AUTH_SESSION_STORAGE_KEY = "doripe.auth.session";

export type AuthProvider = "email" | "apple" | "kakao" | "naver";

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

function createRemoteSession(session: Session, provider: AuthProvider): AuthSession {
  const email = session.user.email ?? `${provider}@doripe.local`;
  return {
    accountId: session.user.id,
    accessCodeId: session.user.id,
    email,
    provider,
    updatedAt: new Date().toISOString(),
  };
}

async function upsertProfile(session: Session, provider: AuthProvider): Promise<void> {
  if (!supabase) return;

  await supabase.from("profiles").upsert({
    id: session.user.id,
    email: session.user.email ?? "",
    display_name:
      typeof session.user.user_metadata?.name === "string"
        ? session.user.user_metadata.name
        : "",
    provider,
    updated_at: new Date().toISOString(),
  });
}

async function saveRemoteSession(session: Session, provider: AuthProvider): Promise<AuthSession> {
  await upsertProfile(session, provider);
  const authSession = createRemoteSession(session, provider);
  await writeJson(AUTH_SESSION_STORAGE_KEY, authSession);
  return authSession;
}

async function saveSession(account: AuthAccount): Promise<AuthSession> {
  const session = createSession(account);
  await writeJson(AUTH_SESSION_STORAGE_KEY, session);
  return session;
}

export async function getStoredAuthSession(): Promise<AuthSession | null> {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (session) {
      const providers = session.user.app_metadata?.providers;
      const provider = Array.isArray(providers) && providers[0] ? String(providers[0]) : "email";
      return saveRemoteSession(session, provider.includes("kakao") ? "kakao" : provider.includes("naver") ? "naver" : provider.includes("apple") ? "apple" : "email");
    }
  }

  return readJson<AuthSession | null>(AUTH_SESSION_STORAGE_KEY, null);
}

export async function signInWithProvider(provider: Exclude<AuthProvider, "email">): Promise<AuthResult> {
  if (supabase) {
    const redirectTo = Linking.createURL("auth/callback");
    const providerId = provider === "naver" ? "custom:naver" : provider;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: providerId as never,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    if (!data.url) {
      return { ok: false, message: "OAuth URL을 만들지 못했어요. Supabase provider 설정을 확인해 주세요." };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") {
      return { ok: false, message: "로그인이 취소되었어요." };
    }

    const code = extractCode(result.url);
    if (code) {
      const exchange = await supabase.auth.exchangeCodeForSession(code);
      if (exchange.error) {
        return { ok: false, message: exchange.error.message };
      }
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return { ok: false, message: "로그인 세션을 확인하지 못했어요." };
    }

    return { ok: true, session: await saveRemoteSession(sessionData.session, provider) };
  }

  const now = new Date().toISOString();
  const existing = await readJson<AuthAccount[]>(AUTH_ACCOUNTS_STORAGE_KEY, []);
  const accountId = `auth-${provider}`;
  const current = existing.find((account) => account.id === accountId);
  const account: AuthAccount = {
    id: accountId,
    accessCodeId: `access-social-${provider}`,
    email: `${provider}@doripe.local`,
    provider,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
  const nextAccounts = current
    ? existing.map((item) => (item.id === accountId ? account : item))
    : [...existing, account];

  await writeJson(AUTH_ACCOUNTS_STORAGE_KEY, nextAccounts);
  return { ok: true, session: await saveSession(account) };
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = normalizeEmail(email);

  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    if (!data.session) {
      return { ok: false, message: "가입 확인 메일이 발송되었어요. Supabase에서 email confirmation 설정을 확인해 주세요." };
    }

    return { ok: true, session: await saveRemoteSession(data.session, "email") };
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
  return { ok: true, session: await saveSession(account) };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = normalizeEmail(email);

  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    if (!data.session) {
      return { ok: false, message: "로그인 세션을 확인하지 못했어요." };
    }

    return { ok: true, session: await saveRemoteSession(data.session, "email") };
  }

  const existing = await readJson<AuthAccount[]>(AUTH_ACCOUNTS_STORAGE_KEY, []);
  const account = existing.find((item) => item.provider === "email" && item.email === normalizedEmail);

  if (!account) {
    return { ok: false, message: "가입된 이메일이 아니에요. 회원가입을 먼저 해주세요." };
  }

  if (account.passwordHash !== hashPassword(normalizedEmail, password)) {
    return { ok: false, message: "비밀번호가 맞지 않아요." };
  }

  return { ok: true, session: await saveSession({ ...account, updatedAt: new Date().toISOString() }) };
}

function extractCode(url: string): string | null {
  const match = /[?#&]code=([^&#]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}
