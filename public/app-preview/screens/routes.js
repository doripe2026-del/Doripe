import { PLACES, ROUTES } from "../fixtures.js";

const NODE_IDS = Object.freeze({ d7: "446:2166" });
const DEFAULT_ROUTE_PLACE_IDS = Object.freeze([...ROUTES[0].placeIds]);

function element(tag, className = "", text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function routeIcon(name, className = "") {
  const image = element("img", className);
  image.src = `/app-preview/assets/routes/${name}.svg`;
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  image.draggable = false;
  return image;
}

function actionButton(label, action, className, iconName) {
  const button = element("button", className);
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.dataset.action = action;
  if (iconName) button.append(routeIcon(iconName));
  return button;
}

function selectedPlaces(state) {
  const requested = state?.routePlaceIds?.length ? state.routePlaceIds : DEFAULT_ROUTE_PLACE_IDS;
  const uniqueIds = [...new Set(requested)];
  const places = uniqueIds.map((id) => PLACES.find((place) => place.id === id)).filter(Boolean);
  return places.length ? places : DEFAULT_ROUTE_PLACE_IDS.map((id) => PLACES.find((place) => place.id === id));
}

function renderBottomNav() {
  const nav = element("nav", "route-confirm-nav");
  nav.setAttribute("aria-label", "주요 메뉴");
  const specs = [
    ["발견", "open-discover", "nav-discover"],
    ["저장", "open-saved", "nav-saved"],
    ["코스", "open-routes", "nav-course-active"],
    ["설정", "open-settings", "nav-settings"]
  ];
  specs.forEach(([label, action, iconName], index) => {
    const item = actionButton(label, action, `route-confirm-nav__item ${index === 2 ? "is-active" : ""}`, iconName);
    item.setAttribute("aria-current", index === 2 ? "page" : "false");
    nav.append(item);
  });
  return nav;
}

export function renderRouteConfirmation(state) {
  const places = selectedPlaces(state);
  const count = places.length;
  const screen = element("section", "route-screen route-screen--d7");
  screen.dataset.screenId = "d7";
  screen.dataset.figmaNode = NODE_IDS.d7;
  screen.dataset.renderMode = "semantic";

  screen.append(element("div", "route-confirm-haze"));

  const back = actionButton("뒤로 가기", "go-back", "route-confirm-back", "chevron-left");
  const countPill = element("div", "route-confirm-count");
  countPill.append(routeIcon("check-selected"), element("strong", "", `선택한 장소 ${count}개`));
  const region = element("div", "route-confirm-region");
  region.append(routeIcon("region-pin"), element("strong", "", "연남"));
  screen.append(back, countPill, region);

  const summary = element("article", "route-confirm-summary");
  const summaryIcon = element("span", "route-confirm-summary__icon");
  summaryIcon.append(routeIcon("course-summary"));
  const copy = element("div", "route-confirm-summary__copy");
  copy.append(
    element("h1", "", `코스 후보 ${count}개 추가됨`),
    element("p", "", places.map((place) => place.name).join(" · "))
  );
  const change = actionButton("장소 바꾸기", "change-places", "route-confirm-action route-confirm-action--change", "change-place");
  change.append(element("span", "", "장소 바꾸기"));
  const create = actionButton("코스 만들기", "create-route", "route-confirm-action route-confirm-action--create", "create-course");
  create.append(element("span", "", "코스 만들기"));
  summary.append(summaryIcon, copy, change, create);
  screen.append(summary, renderBottomNav());
  return screen;
}

export const ROUTE_RENDERERS = Object.freeze({ d7: renderRouteConfirmation });
