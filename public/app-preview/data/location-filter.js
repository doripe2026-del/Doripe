const EARTH_RADIUS_KM = 6371.0088;

const radians = (degrees) => degrees * Math.PI / 180;

function validCoordinate(point) {
  return Number.isFinite(point?.latitude)
    && Number.isFinite(point?.longitude)
    && point.latitude >= -90
    && point.latitude <= 90
    && point.longitude >= -180
    && point.longitude <= 180;
}

export function distanceInKilometers(first, second) {
  if (!validCoordinate(first) || !validCoordinate(second)) return Number.POSITIVE_INFINITY;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const firstLatitude = radians(first.latitude);
  const secondLatitude = radians(second.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function placeMatchesLocationFilter(place, selections = {}) {
  if (selections.locationMode !== "pin") return true;
  const radiusKm = Number(selections.locationRadiusKm);
  if (!validCoordinate(selections.locationCenter) || !Number.isFinite(radiusKm) || radiusKm <= 0) return true;
  return distanceInKilometers(place, selections.locationCenter) <= radiusKm;
}
