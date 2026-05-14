import { accessCodes } from "../../src/domain/fixtures";
import { verifyAccessCode } from "../../src/services/accessCodes";

describe("verifyAccessCode", () => {
  it("accepts active four-digit codes", () => {
    expect(verifyAccessCode("0529", accessCodes)).toEqual({
      status: "accepted",
      accessCodeId: "access-0529",
    });
  });

  it("rejects inactive codes distinctly", () => {
    expect(verifyAccessCode("9999", accessCodes)).toEqual({
      status: "inactive",
    });
  });

  it("rejects unknown codes", () => {
    expect(verifyAccessCode("1234", accessCodes)).toEqual({
      status: "unknown",
    });
  });

  it("rejects malformed values", () => {
    expect(verifyAccessCode("52a9", accessCodes)).toEqual({
      status: "invalid_format",
    });
  });
});
