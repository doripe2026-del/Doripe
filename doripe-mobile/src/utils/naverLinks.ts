type DirectionsInput = {
  fromName: string;
  fromLat: number;
  fromLng: number;
  toName: string;
  toLat: number;
  toLng: number;
};

export function buildNaverPlaceUrl(naverPlaceUrl: string): string {
  return naverPlaceUrl;
}

export function buildNaverDirectionsUrl(input: DirectionsInput): string {
  const params = new URLSearchParams({
    slat: String(input.fromLat),
    slng: String(input.fromLng),
    sname: input.fromName,
    dlat: String(input.toLat),
    dlng: String(input.toLng),
    dname: input.toName,
    appname: "com.doripe.app",
  });

  return `https://map.naver.com/v5/directions?${params.toString()}`;
}
