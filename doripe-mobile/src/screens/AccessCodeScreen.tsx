import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { accessCodes } from "../domain/fixtures";
import { recordEvent } from "../services/events";
import { verifyAccessCode } from "../services/accessCodes";
import { colors, radius, spacing, touch, typography } from "../theme/tokens";

type AccessCodeScreenProps = {
  onAccepted: (accessCodeId: string) => void;
};

export function AccessCodeScreen({ onAccepted }: AccessCodeScreenProps) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedCode = code.replace(/\D/g, "").slice(0, 4);
  const canSubmit = normalizedCode.length === 4 && !isSubmitting;

  function handleCodeChange(value: string) {
    setCode(value.replace(/\D/g, "").slice(0, 4));
    setMessage(null);
  }

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    const result = verifyAccessCode(normalizedCode, accessCodes);

    if (result.status === "inactive") {
      setMessage("현재 사용할 수 없는 코드입니다.");
      return;
    }

    if (result.status !== "accepted") {
      setMessage("코드를 확인해 주세요.");
      return;
    }

    const { accessCodeId } = result;
    setIsSubmitting(true);
    try {
      await recordEvent({ accessCodeId, eventName: "code_verified" });
      onAccepted(accessCodeId);
    } catch {
      setMessage("코드를 확인해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <View style={styles.shell}>
        <View style={styles.brandRow}>
          <View accessibilityElementsHidden importantForAccessibility="no" style={styles.brandMark} />
          <Text style={styles.brandText}>DORIPE MVP</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>초대받은 사람만 먼저</Text>
          <Text style={styles.title}>초대 코드를{"\n"}입력하세요</Text>
          <Text style={styles.copy}>이메일로 받은 네 자리 코드를 입력하고 Doripe를 시작하세요.</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            accessibilityLabel="초대 코드 입력"
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="numeric"
            keyboardType="number-pad"
            maxLength={4}
            onChangeText={handleCodeChange}
            onSubmitEditing={handleSubmit}
            placeholder="0000"
            placeholderTextColor="#516151"
            returnKeyType="done"
            style={styles.input}
            textAlign="center"
            textContentType="oneTimeCode"
            value={normalizedCode}
          />

          <View style={styles.messageSlot} accessibilityLiveRegion="polite">
            {message ? <Text style={styles.error}>{message}</Text> : null}
          </View>

          <Pressable
            accessibilityLabel="시작"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
            disabled={!canSubmit}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.button,
              !canSubmit && styles.buttonDisabled,
              pressed && canSubmit && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.buttonText, !canSubmit && styles.buttonTextDisabled]}>시작</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  shell: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.xxl,
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  brandMark: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    height: 18,
    transform: [{ rotate: "-10deg" }],
    width: 18,
  },
  brandText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  hero: {
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: "800",
  },
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: "900",
    lineHeight: 50,
  },
  copy: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  form: {
    gap: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 36,
    fontWeight: "900",
    height: 82,
    letterSpacing: 12,
    paddingHorizontal: spacing.lg,
  },
  messageSlot: {
    minHeight: 24,
  },
  error: {
    color: colors.danger,
    fontSize: typography.caption,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center",
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    justifyContent: "center",
    minHeight: touch.minimum + 12,
    paddingHorizontal: spacing.lg,
  },
  buttonDisabled: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.line,
    borderWidth: 1,
  },
  buttonPressed: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 0.99 }],
  },
  buttonText: {
    color: colors.background,
    fontSize: typography.body,
    fontWeight: "900",
  },
  buttonTextDisabled: {
    color: colors.muted,
  },
});
