import type { AccessCode } from "../domain/types";

export type AccessCodeVerification =
  | { status: "accepted"; accessCodeId: string }
  | { status: "inactive" }
  | { status: "unknown" }
  | { status: "invalid_format" };

export function verifyAccessCode(code: string, accessCodes: AccessCode[]): AccessCodeVerification {
  const normalizedCode = code.trim();

  if (!/^\d{4}$/.test(normalizedCode)) {
    return { status: "invalid_format" };
  }

  const accessCode = accessCodes.find((item) => item.code === normalizedCode);

  if (!accessCode) {
    return { status: "unknown" };
  }

  if (accessCode.status !== "active") {
    return { status: "inactive" };
  }

  return { status: "accepted", accessCodeId: accessCode.id };
}
