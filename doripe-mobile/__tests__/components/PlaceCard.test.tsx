import { fireEvent, render, screen } from "@testing-library/react-native";
import { places } from "../../src/domain/fixtures";
import { PlaceCard } from "../../src/components/PlaceCard";

describe("PlaceCard", () => {
  it("renders place content and calls actions", () => {
    const onSave = jest.fn();
    const onSkip = jest.fn();

    render(<PlaceCard place={places[0]} categoryName="카페" onSave={onSave} onSkip={onSkip} />);

    expect(screen.getByText("오월의 커피")).toBeTruthy();
    expect(screen.getByText("후암동 언덕 산책 전에 들르기 좋은 조용한 카페")).toBeTruthy();

    fireEvent.press(screen.getByText("저장"));
    fireEvent.press(screen.getByText("스킵"));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("does not call actions while disabled", () => {
    const onSave = jest.fn();
    const onSkip = jest.fn();

    render(
      <PlaceCard
        place={places[0]}
        categoryName="카페"
        onSave={onSave}
        onSkip={onSkip}
        disabled
      />,
    );

    fireEvent.press(screen.getByText("저장"));
    fireEvent.press(screen.getByText("스킵"));

    expect(screen.getByLabelText("오월의 커피 저장")).toHaveProp("accessibilityState", {
      disabled: true,
    });
    expect(screen.getByLabelText("오월의 커피 스킵")).toHaveProp("accessibilityState", {
      disabled: true,
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
  });
});
