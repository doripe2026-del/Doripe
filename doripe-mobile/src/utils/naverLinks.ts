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
  const from = `${input.fromLng},${input.fromLat},${input.fromName}`;
  const to = `${input.toLng},${input.toLat},${input.toName}`;
  return `https://map.naver.com/v5/directions/${encodeURIComponent(from)}/${encodeURIComponent(to)}/-/transit`;
}
