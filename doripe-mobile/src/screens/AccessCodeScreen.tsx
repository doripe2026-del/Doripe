import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { BackCircle, DesignCanvas, HomeIndicator, StatusBarReference, TextBox } from "../components/DesignCanvas";
import { recordEvent } from "../services/events";
import { signInWithEmail, signInWithProvider, signUpWithEmail } from "../services/auth";
import type { AuthResult } from "../services/auth";

type AccessCodeScreenProps = {
  onAccepted: (accessCodeId: string) => void;
};

type AuthMode = "landing" | "login" | "signup" | "welcome";

export function AccessCodeScreen({ onAccepted }: AccessCodeScreenProps) {
  const [mode, setMode] = useState<AuthMode>("landing");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [welcomeAccessCodeId, setWelcomeAccessCodeId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function go(nextMode: AuthMode) {
    setMessage(null);
    setMode(nextMode);
  }

  async function completeAuth(result: AuthResult) {
    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    await recordEvent({ accessCodeId: result.session.accessCodeId, eventName: "code_verified" });
    onAccepted(result.session.accessCodeId);
  }

  async function submitWithGuard(action: () => Promise<void>) {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setMessage(null);
    try {
      await action();
    } catch {
      setMessage("로그인을 완료하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function isEmailValid(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  function submitKakao() {
    void submitWithGuard(async () => {
      await completeAuth(await signInWithProvider("kakao"));
    });
  }

  function submitLogin() {
    if (!isEmailValid(email)) {
      setMessage("이메일 주소를 확인해 주세요.");
      return;
    }
    if (!password) {
      setMessage("비밀번호를 입력해 주세요.");
      return;
    }

    void submitWithGuard(async () => {
      await completeAuth(await signInWithEmail(email, password));
    });
  }

  function submitSignup() {
    if (!isEmailValid(email)) {
      setMessage("이메일 주소를 확인해 주세요.");
      return;
    }
    if (password.length < 8) {
      setMessage("비밀번호는 8자 이상으로 만들어 주세요.");
      return;
    }
    if (password !== passwordConfirm) {
      setMessage("비밀번호가 서로 달라요.");
      return;
    }

    void submitWithGuard(async () => {
      const result = await signUpWithEmail(email, password);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      setWelcomeAccessCodeId(result.session.accessCodeId);
      go("welcome");
    });
  }

  if (mode === "login") {
    return (
      <EmailLoginScreen
        email={email}
        isSubmitting={isSubmitting}
        message={message}
        password={password}
        onBack={() => go("landing")}
        onEmailChange={(value) => {
          setEmail(value);
          setMessage(null);
        }}
        onPasswordChange={(value) => {
          setPassword(value);
          setMessage(null);
        }}
        onForgotPassword={() => setMessage("비밀번호 재설정은 다음 단계에서 붙일게요. 지금은 회원가입 또는 카카오 로그인을 사용해 주세요.")}
        onSignup={() => go("signup")}
        onSubmit={submitLogin}
      />
    );
  }

  if (mode === "signup") {
    return (
      <EmailSignupScreen
        email={email}
        isSubmitting={isSubmitting}
        message={message}
        password={password}
        passwordConfirm={passwordConfirm}
        onBack={() => go("landing")}
        onEmailChange={(value) => {
          setEmail(value);
          setMessage(null);
        }}
        onLogin={() => go("login")}
        onPasswordChange={(value) => {
          setPassword(value);
          setMessage(null);
        }}
        onPasswordConfirmChange={(value) => {
          setPasswordConfirm(value);
          setMessage(null);
        }}
        onSubmit={submitSignup}
      />
    );
  }

  if (mode === "welcome") {
    return (
      <WelcomeScreen
        isSubmitting={isSubmitting}
        onStart={() => {
          if (!welcomeAccessCodeId) {
            setMessage("가입 정보를 다시 확인해 주세요.");
            go("signup");
            return;
          }

          void submitWithGuard(async () => {
            await recordEvent({ accessCodeId: welcomeAccessCodeId, eventName: "code_verified" });
            onAccepted(welcomeAccessCodeId);
          });
        }}
      />
    );
  }

  return (
    <DesignCanvas backgroundColor="#F6F3EB">
      <StatusBarReference subtle={false} />
      <View style={styles.logoBg}>
        <View style={styles.logoDot} />
      </View>
      <TextBox style={styles.landingTitle}>로그인</TextBox>
      <TextBox style={styles.landingCopy}>저장한 장소와 루트를 계정으로 이어서 볼 수 있어요.</TextBox>

      <Pressable
        accessibilityLabel="카카오로 계속하기"
        accessibilityRole="button"
        disabled={isSubmitting}
        onPress={submitKakao}
        style={({ pressed }) => [
          styles.loginButton,
          styles.kakaoButton,
          pressed && styles.pressed,
          isSubmitting && styles.disabled,
        ]}
      >
        <View style={styles.loginMark}>
          <TextBox style={styles.loginMarkText}>K</TextBox>
        </View>
        <TextBox style={styles.kakaoLabel}>{isSubmitting ? "연결 중..." : "카카오로 계속하기"}</TextBox>
      </Pressable>

      <Pressable
        accessibilityLabel="이메일로 로그인"
        accessibilityRole="button"
        disabled={isSubmitting}
        onPress={() => go("login")}
        style={({ pressed }) => [styles.emailButton, pressed && styles.pressed, isSubmitting && styles.disabled]}
      >
        <View style={styles.emailMark}>
          <TextBox style={styles.emailMarkText}>@</TextBox>
        </View>
        <TextBox style={styles.emailLabel}>이메일로 로그인</TextBox>
      </Pressable>

      <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={() => go("signup")} style={styles.signupLinkHit}>
        <TextBox style={styles.signupLink}>처음이라면 이메일로 회원가입</TextBox>
      </Pressable>
      <TextBox style={styles.legal}>계속하면 Doripe 서비스 이용약관과 개인정보 처리방침에 동의하게 됩니다.</TextBox>
      {message ? <TextBox style={styles.error}>{message}</TextBox> : null}
      <HomeIndicator color="#474A45" height={4} />
    </DesignCanvas>
  );
}

function EmailLoginScreen({
  email,
  isSubmitting,
  message,
  password,
  onBack,
  onEmailChange,
  onPasswordChange,
  onForgotPassword,
  onSignup,
  onSubmit,
}: {
  email: string;
  isSubmitting: boolean;
  message: string | null;
  password: string;
  onBack: () => void;
  onEmailChange: (value: string) => void;
  onForgotPassword: () => void;
  onPasswordChange: (value: string) => void;
  onSignup: () => void;
  onSubmit: () => void;
}) {
  const forgotTop = message ? 574 : 552;
  const signupTop = message ? 616 : 590;

  return (
    <DesignCanvas>
      <StatusBarReference />
      <BackCircle onPress={onBack} />
      <TextBox style={styles.formTitle}>이메일 로그인</TextBox>
      <TextBox style={styles.formCopy}>가입한 이메일과 비밀번호를 입력해 주세요.</TextBox>
      <TextBox style={[styles.fieldLabel, { top: 244 }]}>이메일</TextBox>
      <AuthInput
        accessibilityLabel="로그인 이메일 입력"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="name@example.com"
        top={272}
        value={email}
        onChangeText={onEmailChange}
      />
      <TextBox style={[styles.fieldLabel, { top: 350 }]}>비밀번호</TextBox>
      <AuthInput
        accessibilityLabel="로그인 비밀번호 입력"
        placeholder="비밀번호"
        secureTextEntry
        top={378}
        value={password}
        onChangeText={onPasswordChange}
      />
      <Pressable
        accessibilityLabel="이메일 로그인 완료"
        accessibilityRole="button"
        disabled={isSubmitting}
        onPress={onSubmit}
        style={({ pressed }) => [styles.primaryButton, { top: 482 }, pressed && styles.pressed, isSubmitting && styles.disabled]}
      >
        <TextBox style={styles.primaryButtonText}>{isSubmitting ? "확인 중..." : "로그인"}</TextBox>
      </Pressable>
      {message ? <TextBox style={[styles.formError, { top: 540 }]}>{message}</TextBox> : null}
      <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={onForgotPassword} style={[styles.forgotHit, { top: forgotTop - 10 }]}>
        <TextBox style={[styles.formLinkMuted, { top: forgotTop }]}>비밀번호를 잊었어요</TextBox>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={onSignup} style={[styles.formSignupHit, { top: signupTop - 12 }]}>
        <TextBox style={[styles.formLinkStrong, { top: signupTop }]}>처음이라면 이메일 회원가입</TextBox>
      </Pressable>
      <HomeIndicator color="#73756D" />
    </DesignCanvas>
  );
}

function EmailSignupScreen({
  email,
  isSubmitting,
  message,
  password,
  passwordConfirm,
  onBack,
  onEmailChange,
  onLogin,
  onPasswordChange,
  onPasswordConfirmChange,
  onSubmit,
}: {
  email: string;
  isSubmitting: boolean;
  message: string | null;
  password: string;
  passwordConfirm: string;
  onBack: () => void;
  onEmailChange: (value: string) => void;
  onLogin: () => void;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <DesignCanvas>
      <StatusBarReference />
      <BackCircle onPress={onBack} />
      <View style={styles.progressBase} />
      <View style={styles.progressActive} />
      <TextBox style={[styles.formTitle, { top: 132 }]}>이메일 회원가입</TextBox>
      <TextBox style={[styles.formCopy, { top: 178 }]}>이메일과 비밀번호를 정하면 저장함과 루트를 이어서 볼 수 있어요.</TextBox>
      <TextBox style={[styles.fieldLabel, { top: 252 }]}>이메일</TextBox>
      <AuthInput
        accessibilityLabel="회원가입 이메일 입력"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="name@example.com"
        top={280}
        value={email}
        onChangeText={onEmailChange}
      />
      <TextBox style={[styles.fieldLabel, { top: 358 }]}>비밀번호 만들기</TextBox>
      <AuthInput
        accessibilityLabel="회원가입 비밀번호 입력"
        placeholder="8자 이상"
        secureTextEntry
        top={386}
        value={password}
        onChangeText={onPasswordChange}
      />
      <TextBox style={[styles.fieldLabel, { top: 464 }]}>비밀번호 확인</TextBox>
      <AuthInput
        accessibilityLabel="회원가입 비밀번호 확인 입력"
        placeholder="한 번 더 입력"
        secureTextEntry
        top={492}
        value={passwordConfirm}
        onChangeText={onPasswordConfirmChange}
      />
      <TextBox style={styles.passwordHint}>영문과 숫자를 섞어 8자 이상으로 만드는 걸 권장해요.</TextBox>
      <Pressable
        accessibilityLabel="이메일 회원가입 완료"
        accessibilityRole="button"
        disabled={isSubmitting}
        onPress={onSubmit}
        style={({ pressed }) => [styles.primaryButton, { top: 604 }, pressed && styles.pressed, isSubmitting && styles.disabled]}
      >
        <TextBox style={styles.primaryButtonText}>{isSubmitting ? "가입 중..." : "회원가입"}</TextBox>
      </Pressable>
      {message ? <TextBox style={[styles.formError, { top: 566 }]}>{message}</TextBox> : null}
      <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={onLogin} style={styles.formLoginHit}>
        <TextBox style={[styles.formLinkStrong, { top: 676 }]}>이미 계정이 있다면 로그인</TextBox>
      </Pressable>
      <HomeIndicator color="#73756D" />
    </DesignCanvas>
  );
}

function WelcomeScreen({ isSubmitting, onStart }: { isSubmitting: boolean; onStart: () => void }) {
  return (
    <DesignCanvas>
      <StatusBarReference />
      <View style={styles.welcomeGlow} />
      <View style={styles.welcomeCircle}>
        <TextBox style={styles.welcomeCheck}>✓</TextBox>
      </View>
      <TextBox style={styles.welcomeTitle}>환영합니다!</TextBox>
      <TextBox style={styles.welcomeCopy}>이제 저장한 장소와 루트를 Doripe 계정으로 이어서 볼 수 있어요.</TextBox>
      <Pressable
        accessibilityRole="button"
        disabled={isSubmitting}
        onPress={onStart}
        style={({ pressed }) => [styles.welcomeButton, pressed && styles.pressed, isSubmitting && styles.disabled]}
      >
        <TextBox style={styles.primaryButtonText}>{isSubmitting ? "준비 중..." : "Doripe 시작하기"}</TextBox>
      </Pressable>
      <HomeIndicator color="#73756D" />
    </DesignCanvas>
  );
}

function AuthInput({
  accessibilityLabel,
  autoComplete,
  keyboardType,
  placeholder,
  secureTextEntry = false,
  top,
  value,
  onChangeText,
}: {
  accessibilityLabel: string;
  autoComplete?: "email";
  keyboardType?: "email-address";
  placeholder: string;
  secureTextEntry?: boolean;
  top: number;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      allowFontScaling={false}
      autoCapitalize="none"
      autoComplete={autoComplete}
      autoCorrect={false}
      editable
      keyboardType={keyboardType}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9B9D94"
      secureTextEntry={secureTextEntry}
      style={[styles.input, { top }, webNoOutline]}
      textContentType={autoComplete === "email" ? "emailAddress" : secureTextEntry ? "password" : "none"}
      underlineColorAndroid="transparent"
      value={value}
    />
  );
}

const styles = StyleSheet.create({
  logoBg: {
    alignItems: "center",
    backgroundColor: "#1FE56B",
    borderRadius: 18,
    height: 65,
    justifyContent: "center",
    left: 164,
    position: "absolute",
    top: 112,
    width: 65,
  },
  logoDot: {
    backgroundColor: "#FEFDF6",
    borderRadius: 16,
    height: 31,
    width: 31,
  },
  landingTitle: {
    color: "#090A09",
    fontSize: 36,
    fontWeight: "800",
    left: 24,
    lineHeight: 42,
    position: "absolute",
    textAlign: "center",
    top: 215,
    width: 345,
  },
  landingCopy: {
    color: "#5C5E57",
    fontSize: 13,
    fontWeight: "400",
    left: 44,
    lineHeight: 20,
    position: "absolute",
    textAlign: "center",
    top: 272,
    width: 305,
  },
  loginButton: {
    borderRadius: 16,
    height: 54,
    left: 24,
    position: "absolute",
    top: 344,
    width: 345,
  },
  kakaoButton: {
    backgroundColor: "#FEE500",
  },
  loginMark: {
    alignItems: "center",
    backgroundColor: "rgba(9,10,9,0.08)",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    left: 20,
    position: "absolute",
    top: 13,
    width: 28,
  },
  loginMarkText: {
    color: "#090A09",
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 14,
    textAlign: "center",
  },
  kakaoLabel: {
    color: "#090A09",
    fontSize: 15,
    fontWeight: "800",
    left: 0,
    lineHeight: 18,
    position: "absolute",
    textAlign: "center",
    top: 18,
    width: 345,
  },
  emailButton: {
    backgroundColor: "#FEFDF6",
    borderColor: "#C7C4B5",
    borderRadius: 16,
    borderWidth: 1,
    height: 54,
    left: 24,
    position: "absolute",
    top: 412,
    width: 345,
  },
  emailMark: {
    alignItems: "center",
    backgroundColor: "#EEEDE5",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    left: 20,
    position: "absolute",
    top: 13,
    width: 28,
  },
  emailMarkText: {
    color: "#090A09",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 16,
    textAlign: "center",
  },
  emailLabel: {
    color: "#090A09",
    fontSize: 15,
    fontWeight: "800",
    left: 0,
    lineHeight: 18,
    position: "absolute",
    textAlign: "center",
    top: 18,
    width: 345,
  },
  signupLinkHit: {
    height: 42,
    left: 24,
    position: "absolute",
    top: 494,
    width: 345,
  },
  signupLink: {
    color: "#090A09",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
    position: "absolute",
    textAlign: "center",
    top: 10,
    width: 345,
  },
  legal: {
    color: "#5C5E57",
    fontSize: 11,
    fontWeight: "400",
    left: 44,
    lineHeight: 17,
    position: "absolute",
    textAlign: "center",
    top: 618,
    width: 305,
  },
  error: {
    color: "#B3261E",
    fontSize: 12,
    fontWeight: "700",
    left: 44,
    lineHeight: 16,
    position: "absolute",
    textAlign: "center",
    top: 672,
    width: 305,
  },
  formTitle: {
    color: "#090B0A",
    fontSize: 32,
    fontWeight: "800",
    left: 24,
    lineHeight: 38,
    position: "absolute",
    top: 120,
    width: 345,
  },
  formCopy: {
    color: "#5C6159",
    fontSize: 14,
    fontWeight: "400",
    left: 24,
    lineHeight: 20,
    position: "absolute",
    top: 166,
    width: 330,
  },
  fieldLabel: {
    color: "#5C6159",
    fontSize: 13,
    fontWeight: "700",
    left: 24,
    lineHeight: 18,
    position: "absolute",
    width: 180,
  },
  input: {
    backgroundColor: "#FFFFF9",
    borderColor: "#D1D1C5",
    borderRadius: 18,
    borderWidth: 1,
    color: "#090B0A",
    fontSize: 15,
    height: 58,
    left: 24,
    lineHeight: 20,
    paddingHorizontal: 20,
    position: "absolute",
    width: 345,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#21F073",
    borderRadius: 18,
    height: 52,
    justifyContent: "center",
    left: 24,
    position: "absolute",
    width: 345,
  },
  primaryButtonText: {
    color: "#052E14",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "center",
  },
  formLinkMuted: {
    color: "#5C6159",
    fontSize: 13,
    fontWeight: "700",
    left: 24,
    lineHeight: 18,
    position: "absolute",
    textAlign: "center",
    width: 345,
  },
  formLinkStrong: {
    color: "#090B0A",
    fontSize: 13,
    fontWeight: "800",
    left: 24,
    lineHeight: 18,
    position: "absolute",
    textAlign: "center",
    width: 345,
  },
  formSignupHit: {
    height: 44,
    left: 24,
    position: "absolute",
    width: 345,
  },
  forgotHit: {
    height: 36,
    left: 24,
    position: "absolute",
    width: 345,
  },
  formLoginHit: {
    height: 44,
    left: 24,
    position: "absolute",
    top: 664,
    width: 345,
  },
  formError: {
    color: "#B3261E",
    fontSize: 12,
    fontWeight: "700",
    left: 44,
    lineHeight: 16,
    position: "absolute",
    textAlign: "center",
    width: 305,
  },
  progressBase: {
    backgroundColor: "#EEECE3",
    borderRadius: 3,
    height: 5,
    left: 24,
    position: "absolute",
    top: 106,
    width: 345,
  },
  progressActive: {
    backgroundColor: "#21F073",
    borderRadius: 3,
    height: 5,
    left: 24,
    position: "absolute",
    top: 106,
    width: 172,
  },
  passwordHint: {
    color: "#5C6159",
    fontSize: 12,
    fontWeight: "400",
    left: 44,
    lineHeight: 18,
    position: "absolute",
    top: 550,
    width: 305,
  },
  welcomeGlow: {
    backgroundColor: "rgba(33,240,115,0.16)",
    borderRadius: 80,
    height: 160,
    left: 117,
    position: "absolute",
    top: 132,
    width: 160,
  },
  welcomeCircle: {
    alignItems: "center",
    backgroundColor: "#21F073",
    borderRadius: 52,
    height: 104,
    justifyContent: "center",
    left: 145,
    position: "absolute",
    top: 160,
    width: 104,
  },
  welcomeCheck: {
    color: "#052E14",
    fontSize: 40,
    fontWeight: "800",
    lineHeight: 48,
    textAlign: "center",
  },
  welcomeTitle: {
    color: "#090B0A",
    fontSize: 34,
    fontWeight: "800",
    left: 24,
    lineHeight: 40,
    position: "absolute",
    textAlign: "center",
    top: 314,
    width: 345,
  },
  welcomeCopy: {
    color: "#5C6159",
    fontSize: 14,
    fontWeight: "400",
    left: 48,
    lineHeight: 21,
    position: "absolute",
    textAlign: "center",
    top: 368,
    width: 297,
  },
  welcomeButton: {
    alignItems: "center",
    backgroundColor: "#21F073",
    borderRadius: 18,
    height: 52,
    justifyContent: "center",
    left: 24,
    position: "absolute",
    top: 646,
    width: 345,
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.56,
  },
});

const webNoOutline = { outlineStyle: "none" } as never;
