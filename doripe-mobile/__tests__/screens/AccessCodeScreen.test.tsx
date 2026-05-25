import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AccessCodeScreen } from "../../src/screens/AccessCodeScreen";
import { recordEvent } from "../../src/services/events";

jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("../../src/services/events", () => ({
  recordEvent: jest.fn(() => Promise.resolve()),
}));

const mockRecordEvent = recordEvent as jest.Mock;

describe("AccessCodeScreen", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockRecordEvent.mockClear();
    mockRecordEvent.mockResolvedValue(undefined);
  });

  it("accepts Kakao login after recording a verification event", async () => {
    const onAccepted = jest.fn();
    render(<AccessCodeScreen onAccepted={onAccepted} />);

    fireEvent.press(screen.getByText("카카오로 계속하기"));

    await waitFor(() => {
      expect(mockRecordEvent).toHaveBeenCalledWith({
        accessCodeId: "access-social-kakao",
        eventName: "code_verified",
      });
      expect(onAccepted).toHaveBeenCalledWith("access-social-kakao");
    });
  });

  it("validates email login fields", () => {
    render(<AccessCodeScreen onAccepted={jest.fn()} />);

    fireEvent.press(screen.getByText("이메일로 로그인"));
    fireEvent.changeText(screen.getByLabelText("로그인 이메일 입력"), "wrong-email");
    fireEvent.press(screen.getByLabelText("이메일 로그인 완료"));

    expect(screen.getByText("이메일 주소를 확인해 주세요.")).toBeTruthy();
  });

  it("signs up with email, shows welcome, and enters the app", async () => {
    const onAccepted = jest.fn();
    render(<AccessCodeScreen onAccepted={onAccepted} />);

    fireEvent.press(screen.getByText("처음이라면 이메일로 회원가입"));
    fireEvent.changeText(screen.getByLabelText("회원가입 이메일 입력"), "founder@doripe.kr");
    fireEvent.changeText(screen.getByLabelText("회원가입 비밀번호 입력"), "doripe123");
    fireEvent.changeText(screen.getByLabelText("회원가입 비밀번호 확인 입력"), "doripe123");
    fireEvent.press(screen.getByLabelText("이메일 회원가입 완료"));

    await waitFor(() => {
      expect(screen.getByText("환영합니다!")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Doripe 시작하기"));

    await waitFor(() => {
      expect(onAccepted).toHaveBeenCalledWith(expect.stringMatching(/^access-email-/));
    });
  });
});
