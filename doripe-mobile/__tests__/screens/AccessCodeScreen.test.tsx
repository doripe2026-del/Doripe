import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { recordEvent } from "../../src/services/events";
import { AccessCodeScreen } from "../../src/screens/AccessCodeScreen";

jest.mock("../../src/services/events", () => ({
  recordEvent: jest.fn(() => Promise.resolve()),
}));

const mockRecordEvent = recordEvent as jest.Mock;

describe("AccessCodeScreen", () => {
  beforeEach(() => {
    mockRecordEvent.mockClear();
    mockRecordEvent.mockResolvedValue(undefined);
  });

  it("submits four-digit codes after recording verification event", async () => {
    const onAccepted = jest.fn();
    let resolveRecordEvent: () => void = () => undefined;
    mockRecordEvent.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRecordEvent = () => resolve(undefined);
        }),
    );

    render(<AccessCodeScreen onAccepted={onAccepted} />);

    fireEvent.changeText(screen.getByLabelText("실행코드 입력"), "0529");
    await waitFor(() => {
      expect(screen.getByLabelText("실행코드 입력")).toHaveProp("value", "0529");
    });
    fireEvent.press(screen.getByText("시작하기"));

    expect(mockRecordEvent).toHaveBeenCalledWith({
      accessCodeId: "access-0529",
      eventName: "code_verified",
    });
    expect(onAccepted).not.toHaveBeenCalled();

    resolveRecordEvent();

    await waitFor(() => {
      expect(onAccepted).toHaveBeenCalledWith("access-0529");
    });
  });

  it("shows inactive code message", () => {
    render(<AccessCodeScreen onAccepted={jest.fn()} />);

    fireEvent.changeText(screen.getByLabelText("실행코드 입력"), "9999");
    fireEvent.press(screen.getByText("시작하기"));

    expect(screen.getByText("현재 사용할 수 없는 코드입니다.")).toBeTruthy();
  });
});
