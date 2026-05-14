import { fireEvent, render, screen } from "@testing-library/react-native";
import { AccessCodeScreen } from "../../src/screens/AccessCodeScreen";

describe("AccessCodeScreen", () => {
  it("submits four-digit codes", () => {
    const onAccepted = jest.fn();

    render(<AccessCodeScreen onAccepted={onAccepted} />);

    fireEvent.changeText(screen.getByLabelText("실행코드 입력"), "0529");
    fireEvent.press(screen.getByText("시작하기"));

    expect(onAccepted).toHaveBeenCalledWith("access-0529");
  });

  it("shows inactive code message", () => {
    render(<AccessCodeScreen onAccepted={jest.fn()} />);

    fireEvent.changeText(screen.getByLabelText("실행코드 입력"), "9999");
    fireEvent.press(screen.getByText("시작하기"));

    expect(screen.getByText("현재 사용할 수 없는 코드입니다.")).toBeTruthy();
  });
});
