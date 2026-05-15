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
    const parsedUrl = new URL(url);

    expect(`${parsedUrl.origin}${parsedUrl.pathname}`).toBe("https://map.naver.com/v5/directions");
    expect(parsedUrl.searchParams.get("slat")).toBe("37.1");
    expect(parsedUrl.searchParams.get("slng")).toBe("127.1");
    expect(parsedUrl.searchParams.get("sname")).toBe("A");
    expect(parsedUrl.searchParams.get("dlat")).toBe("37.2");
    expect(parsedUrl.searchParams.get("dlng")).toBe("127.2");
    expect(parsedUrl.searchParams.get("dname")).toBe("B");
    expect(parsedUrl.searchParams.get("appname")).toBe("com.doripe.app");
    expect(url).not.toContain("%2C");
  });
});
