import { fireEvent, render, screen } from "@testing-library/react-native";
import { places } from "../../src/domain/fixtures";
import { SegmentList } from "../../src/components/SegmentList";

describe("SegmentList", () => {
  it("renders segment rows and handles open presses", () => {
    const onOpenSegment = jest.fn();

    render(
      <SegmentList
        places={[places[0], places[1], places[2]]}
        onOpenSegment={onOpenSegment}
      />,
    );

    expect(screen.getByText("1구간")).toBeTruthy();
    expect(screen.getByText("2구간")).toBeTruthy();

    fireEvent.press(screen.getAllByText("길찾기 열기")[0]);

    expect(onOpenSegment).toHaveBeenCalledWith(places[0], places[1]);
  });
});
