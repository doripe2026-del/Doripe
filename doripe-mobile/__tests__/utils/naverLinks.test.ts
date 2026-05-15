import { buildNaverPlaceUrl, buildNaverDirectionsUrl } from "../../src/utils/naverLinks";

describe("naver link helpers", () => {
  it("returns place url when present", () => {
    expect(buildNaverPlaceUrl("https://map.naver.com/p/example")).toBe("https://map.naver.com/p/example");
  });

  it("builds a segment directions url", () => {
    const url = buildNaverDirectionsUrl({
      fromName: "A",
      fromLat: 37.1,
      fromLng: 127.1,
      toName: "B",
      toLat: 37.2,
      toLng: 127.2,
    });

    expect(url).toContain("https://map.naver.com/");
    expect(url).toContain("A");
    expect(url).toContain("B");
  });
});
