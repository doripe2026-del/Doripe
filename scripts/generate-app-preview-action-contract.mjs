import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import measurements from "../public/app-preview/figma/screen-measurements.json" with { type: "json" };

const outputPath = fileURLToPath(new URL("../public/app-preview/figma/action-contract.json", import.meta.url));
const scriptPath = fileURLToPath(import.meta.url);
const actions = [];

const navigate = (destination, selectionKey) => ({
  type: "navigate",
  destination,
  ...(selectionKey ? { selectionKey } : {})
});
const history = () => ({ type: "history" });
const state = (stateKey) => ({ type: "state", stateKey });
const share = (targetType) => ({ type: "share", targetType });
const overlay = (overlayId) => ({ type: "overlay", overlayId });

function add(screenId, actionId, source, kind, effect, options = {}) {
  if (!Object.hasOwn(measurements, screenId)) throw new Error(`Unknown screen: ${screenId}`);
  if (!Object.hasOwn(measurements[screenId].elements, source)) {
    throw new Error(`Unknown measured element: ${screenId}/${source}`);
  }

  actions.push({
    screenId,
    actionId,
    source,
    kind,
    effect,
    evidence: options.evidence || `The ${source} control is visible in the ${screenId.toUpperCase()} reference.`,
    ...(options.payload ? { payload: options.payload } : {})
  });
}

function addSources(screenId, actionId, sources, kind, effect, payloads) {
  sources.forEach((source, index) => add(
    screenId,
    actionId,
    source,
    kind,
    effect,
    payloads?.[index] ? { payload: payloads[index] } : undefined
  ));
}

function measuredKeys(screenId, pattern) {
  return Object.keys(measurements[screenId].elements).filter((key) => pattern.test(key));
}

function onboardingFields(screenId, fields) {
  add(screenId, "go-back", "action/back", "icon-button", history());
  for (const [actionId, source, stateKey] of fields) add(screenId, actionId, source, "input", state(stateKey));
}

add("a1", "start", "action/start", "button", navigate("a9"));
add("a1", "login", "action/login", "text-button", navigate("a3"));

for (const screenId of ["a3", "a4"]) {
  add(screenId, "update-email", "field/email/bg", "input", state("form.email"));
  add(screenId, "update-password", "field/password/bg", "input", state("form.password"));
  add(screenId, "create-account", "action/primary/bg#2", "button", navigate("a9"));
  add(screenId, "submit-login", "action/primary/bg", "button", navigate("b1"));
  add(screenId, "forgot-password", "action/forgot-password", "text-button", navigate("a5"));
}

onboardingFields("a5", [["update-email", "field/email/bg", "form.email"]]);
add("a5", "send-reset-email", "action/next", "button", navigate("a6"));
add("a6", "go-back", "action/back", "icon-button", history());
add("a6", "return-to-login", "action/primary", "button", navigate("a3"));

for (const screenId of ["a7", "a8"]) {
  onboardingFields(screenId, [
    ["update-new-password", "field/new-password/bg", "form.newPassword"],
    ["update-password-confirmation", "field/password-confirm/bg", "form.passwordConfirmation"]
  ]);
  add(screenId, "save-password", "action/save", "button", navigate("a3"));
}

for (const screenId of ["a9", "a10", "a11"]) {
  onboardingFields(screenId, [["update-email", "field/email/bg", "form.email"]]);
  add(screenId, "continue-sign-up", "action/next", "button", navigate("a12"));
}

for (const screenId of ["a12", "a13"]) {
  onboardingFields(screenId, [["update-password", "field/password/bg", "form.password"]]);
  add(screenId, "continue-sign-up", "action/next", "button", navigate("a14"));
}

add("a14", "go-back", "action/back", "icon-button", history());
add("a14", "select-birth-year", "field/year-picker/container", "picker", state("selections.birthYear"));
add("a14", "continue-sign-up", "action/next", "button", navigate("a15"));

add("a15", "go-back", "action/back", "icon-button", history());
addSources(
  "a15",
  "select-gender",
  ["gender radio/여성", "gender radio/남성", "gender radio/선택하지 않음"],
  "radio",
  state("selections.gender"),
  [{ value: "female" }, { value: "male" }, { value: "unspecified" }]
);
add("a15", "continue-sign-up", "action/next", "button", navigate("a16"));

for (const screenId of ["a16", "a17"]) {
  onboardingFields(screenId, [["update-nickname", "field/nickname/bg", "form.nickname"]]);
  add(screenId, "continue-sign-up", "action/next", "button", navigate("a18"));
}

add("a18", "go-back", "action/back", "icon-button", history());
addSources(
  "a18",
  "select-place-source",
  measuredKeys("a18", /^slot\/option-card\/bg(?:#\d+)?$/),
  "option-card",
  state("selections.placeSource")
);
add("a18", "choose-location", "action/choose-location", "button", navigate("a20"));
add("a18", "skip-question", "action/skip", "text-button", navigate("a19"));

add("a19", "go-back", "action/back", "icon-button", history());
addSources(
  "a19",
  "select-referral-source",
  measuredKeys("a19", /^slot\/option-card\/bg(?:#\d+)?$/),
  "option-card",
  state("selections.referralSource")
);
add("a19", "continue-sign-up", "action/next", "button", navigate("a20"));
add("a19", "skip-question", "action/skip", "text-button", navigate("a20"));

add("a20", "go-back", "action/back", "icon-button", history());
addSources(
  "a20",
  "select-neighborhood",
  ["region", "region#2", "region#3"],
  "map-chip",
  state("selections.neighborhood")
);
add("a20", "confirm-neighborhood", "action/primary", "button", navigate("a21"));

add("b1", "show-following", "segment label", "tab", state("selections.feedTab"), { payload: { value: "following" } });
add("b1", "show-discover", "segment label / Discover", "tab", navigate("b2"));
add("b1", "open-filter", "Header / filter pill", "button", state("selections.feedFilter"));
add("b1", "open-following-list", "Following / list CTA", "button", navigate("e7"));
addSources("b1", "open-place", measuredKeys("b1", /^Feed \/ media tile \d+(?:#\d+)?$/), "media-card", navigate("b4", "selectedPlaceId"));
add("b1", "save-place", "Feed / masonry grid", "gesture-target", state("savedPlaceIds"), {
  evidence: "B1's dynamic feed is flattened and masked in the reference; the measured masonry composite is the only retained source for the brief-required save-place state action."
});
add("b1", "create-route", "Floating / add route CTA", "button", navigate("d1"));
add("b1", "scroll-to-top", "Floating / scroll to top", "icon-button", state("scrollTop"));

add("b2", "show-following", "segment label", "tab", navigate("b1"));
add("b2", "show-discover", "segment label / Discover", "tab", state("selections.feedTab"), { payload: { value: "discover" } });
add("b2", "open-filter", "Header / filter pill", "button", state("selections.feedFilter"));
addSources("b2", "open-place", measuredKeys("b2", /^Feed \/ media tile \d+$/), "media-card", navigate("b4", "selectedPlaceId"));

add("b3", "go-back", "Navigation / back button 03", "icon-button", history());
addSources("b3", "open-place", measuredKeys("b3", /^Feed \/ media tile \d+$/), "media-card", navigate("b4", "selectedPlaceId"));

function placeDetailActions(screenId, {
  mediaSource,
  handleSource,
  hoursSource = "Info / hours row",
  addressSource = "Info / address row",
  menuSource = "Info / menu row",
  related = false,
  route = false
}) {
  add(screenId, "close-place", handleSource, "sheet-handle", history(), {
    evidence: `The ${screenId.toUpperCase()} reference shows a dismissible bottom sheet handle; no separate back control is measured.`
  });
  add(screenId, "open-photo", mediaSource, "media", navigate("b7", "selectedMediaId"));
  add(screenId, "toggle-media-like", "hero-action/like", "icon-button", state("likedMediaIds"));
  add(screenId, "open-comments", "hero-action/comment", "icon-button", navigate("b8"));
  add(screenId, "open-business-hours", hoursSource, "row", navigate("b9"));
  add(screenId, "open-place-map", addressSource, "row", navigate("c5", "selectedPlaceId"));
  add(screenId, "open-menu", menuSource, "row", overlay("place-menu"));
  add(screenId, "open-share", "CTA / share button bg", "button", share("place"));
  add(screenId, "save-place", "CTA / save button bg", "button", state("savedPlaceIds"));
  if (related) {
    addSources(screenId, "open-related-place", measuredKeys(screenId, /^Related places \/ card \d+$/), "place-card", navigate("b4", "selectedPlaceId"));
    addSources(screenId, "toggle-comment-like", measuredKeys(screenId, /^slot\/comment-item\/like-icon(?:#\d+)?$/), "icon-button", state("likedCommentIds"));
  }
  if (route) add(screenId, "create-route", "Floating route CTA / text", "button", navigate("d1"));
}

placeDetailActions("b4", { mediaSource: "Hero / photo crop slot", handleSource: "Sheet / drag handle", related: true });
placeDetailActions("b5", { mediaSource: "Hero / photo and floating controls crop slot", handleSource: "Sheet / handle" });
placeDetailActions("b6", { mediaSource: "Hero / photo and floating controls crop slot", handleSource: "Sheet / handle", related: true, route: true });
placeDetailActions("b10", {
  mediaSource: "Hero / photo crop slot",
  handleSource: "Sheet / handle",
  hoursSource: "slot/info-row/opening-hours",
  addressSource: "slot/info-row/address",
  menuSource: "slot/info-row/menu",
  related: true,
  route: true
});

add("b7", "close-photo", "button / close photo viewer", "icon-button", history());
add("b8", "close-comments", "button / back circle", "icon-button", history());
add("b8", "update-comment", "bottom sheet / comments editable", "input", state("form.comment"), {
  evidence: "The B8 comment input is flattened into the measured editable comments sheet composite."
});
add("b8", "submit-comment", "button / submit comment", "icon-button", state("comments"));
addSources("b8", "toggle-comment-like", measuredKeys("b8", /^icon \/ heart \/ /), "icon-button", state("likedCommentIds"));
add("b9", "close-business-hours", "button / back", "icon-button", history());

function filterSheetActions(screenId) {
  const buttons = measuredKeys(screenId, /^button(?:#\d+)?$/);
  addSources(screenId, "select-situation", buttons.slice(0, 4), "option-button", state("selections.situation"));
  addSources(screenId, "select-time", buttons.slice(4, 8), "option-button", state("selections.time"));
  addSources(screenId, "select-mood", buttons.slice(8, 14), "option-button", state("selections.mood"));
  add(screenId, "apply-filters", "CTA", "button", navigate("c3"));
  add(screenId, "reset-filters", "button#15", "text-button", state("filterSelections"));
}

filterSheetActions("c1");
filterSheetActions("c2");

add("c3", "go-back", "button / back", "icon-button", history());
addSources("c3", "select-filter-tag", measuredKeys("c3", /^filter(?:#\d+)?$/), "chip", state("selections.savedFilter"));
add("c3", "select-place", "status / selected", "icon-button", state("routePlaceIds"));
addSources("c3", "toggle-place-like", measuredKeys("c3", /^status \/ like(?:#\d+)?$/), "icon-button", state("likedPlaceIds"));
addSources("c3", "replace-place", measuredKeys("c3", /^button(?:#\d+)?$/), "button", state("selections.replacementPlaceId"));
add("c3", "confirm-place-selection", "CTA", "button", navigate("c4"));

add("c4", "show-saved-places", "icon / bookmark", "tab", navigate("c6"), {
  evidence: "The measured bookmark icon is the distinct place-tab affordance in C4."
});
add("c4", "show-saved-routes", "icon / route", "tab", state("selections.savedTab"), {
  evidence: "The measured route icon is the distinct route-tab affordance in C4."
});
addSources("c4", "select-filter-tag", measuredKeys("c4", /^chip(?:#\d+)?$/), "chip", state("selections.savedFilter"));
addSources("c4", "open-route-map", ["button", "button#3", "button#5"], "button", navigate("d9", "selectedRouteId"));
addSources("c4", "open-route", ["button#2", "button#4", "button#6"], "button", navigate("d10", "selectedRouteId"));

add("c5", "go-back", "button / back floating", "icon-button", history());
add("c5", "close-place-card", "button / close place card", "icon-button", state("selections.selectedPlaceId"));
add("c5", "locate-user", "button / locate floating", "icon-button", state("mapViewport"));
add("c5", "open-place", "place card / selected saved place", "place-card", navigate("b4", "selectedPlaceId"));

add("c6", "show-saved-places", "icon / bookmark", "tab", state("selections.savedTab"));
add("c6", "show-saved-routes", "icon / route", "tab", navigate("c4"));
addSources("c6", "select-filter-tag", measuredKeys("c6", /^chip(?:#\d+)?$/), "chip", state("selections.savedFilter"));
addSources("c6", "open-place", measuredKeys("c6", /^(?:list row|recommend card)(?:#\d+)?$/), "place-card", navigate("b4", "selectedPlaceId"));
addSources("c6", "add-place-to-route", measuredKeys("c6", /^icon \/ add route(?:#\d+)?$/), "icon-button", state("routePlaceIds"));

add("d1", "go-back", "Back button / bg", "icon-button", history());
add("d1", "locate-user", "Locate button / bg", "icon-button", state("mapViewport"));
add("d1", "start-nearby", "Start CTA / bg", "button", navigate("d2"));

function routeCandidateActions(screenId, savedSource, discoverSource, addSourcesForScreen) {
  add(screenId, "go-back", "Back button / bg", "icon-button", history());
  add(screenId, "show-saved-places", savedSource, "tab", screenId === "d2" ? state("selections.routeSourceTab") : navigate("d2"));
  add(screenId, "show-discover", discoverSource, "tab", screenId === "d3" ? state("selections.routeSourceTab") : navigate("d3"));
  add(screenId, "change-filter", "Filter / change bg", "button", state("selections.routeFilter"));
  addSources(screenId, "select-filter-tag", measuredKeys(screenId, /^Chip\/bg(?:#\d+)?$/), "chip", state("selections.routeFilter"));
  addSources(screenId, "add-place", addSourcesForScreen, "icon-button", state("routePlaceIds"));
  add(screenId, "confirm-route-places", "CTA / route add bg", "button", navigate("d4"));
}

routeCandidateActions(
  "d2",
  "Segmented / saved active",
  "Segmented / discover text",
  ["icon/lucide#5", "icon/lucide#6", "icon/lucide#7"]
);
routeCandidateActions(
  "d3",
  "Segmented / saved text",
  "Segmented / discover active",
  measuredKeys("d3", /^Discover card\/action bg(?:#\d+)?$/)
);

function bottomNav(screenId) {
  add(screenId, "open-discover", "Icon / nav discover", "nav-button", navigate("b2"));
  add(screenId, "open-saved", "Icon / nav saved", "nav-button", navigate("c6"));
  add(screenId, "open-routes", "Icon / nav route active", "nav-button", navigate("d1"));
  add(screenId, "open-settings", "Icon / nav settings", "nav-button", navigate("e3"));
}

add("d4", "go-back", "Top / back button bg", "icon-button", history());
add("d4", "change-places", "Button / change place bg", "button", navigate("d2"));
add("d4", "create-route", "Button / create route bg", "button", navigate("d5"));
bottomNav("d4");

add("d5", "go-back", "Top / back button bg", "icon-button", history());
add("d5", "update-route-name", "Input / route name bg", "input", state("form.routeName"));
add("d5", "clear-route-name", "Icon / clear input", "icon-button", state("form.routeName"));
add("d5", "save-route", "Button / save route bg", "button", navigate("d6"));
bottomNav("d5");

add("d6", "go-back", "Icon / back", "icon-button", history());
add("d6", "open-share", "Button / share bg", "button", share("route"));
add("d6", "open-share", "Icon / share top", "icon-button", share("route"));
add("d6", "start-navigation", "Button / navigation bg", "button", navigate("d7"));
addSources("d6", "open-place", ["Icon / chevron right 1", "Icon / chevron right 2", "Icon / chevron right 3"], "row", navigate("b4", "selectedPlaceId"));
bottomNav("d6");

add("d7", "go-back", "Top / back bg", "icon-button", history());
add("d7", "open-route-list", "Button / route list bg", "button", navigate("d8"));
add("d7", "stop-navigation", "Button / stop bg", "button", history());

function routeDetailActions(screenId, backSource) {
  add(screenId, "go-back", backSource, "icon-button", history());
  add(screenId, "open-share", "Button / share bg", "button", share("route"));
  add(screenId, "open-share", "Icon / share-2 / header", "icon-button", share("route"));
  add(screenId, "start-navigation", "Button / navigate bg", "button", navigate("d7"));
  addSources(screenId, "replace-route-place", ["Change place bg 1", "Change place bg 2", "Change place bg 3"], "icon-button", state("selections.replacementPlaceId"));
  addSources(screenId, "open-place", ["Place photo crop 1", "Place photo crop 2", "Place photo crop 3"], "place-card", navigate("b4", "selectedPlaceId"));
}

routeDetailActions("d8", "Icon / back sheet");
routeDetailActions("d9", "Icon / back sheet");

add("d10", "close-route", "Sheet handle", "sheet-handle", history(), {
  evidence: "D10 has no measured back button; the visible measured sheet handle is the route-detail dismiss control."
});
add("d10", "open-share", "Button / share route bg", "button", share("route"));
addSources("d10", "open-place", ["Place photo crop 1", "Place photo crop 2", "Place photo crop 3"], "place-card", navigate("b4", "selectedPlaceId"));

add("d11", "go-back", "Back button", "icon-button", history());
add("d11", "close-place-card", "Close icon", "icon-button", state("selections.selectedPlaceId"));
add("d11", "locate-user", "Target button", "icon-button", state("mapViewport"));
add("d11", "start-nearby", "Floating CTA / start here", "button", navigate("d2"));

add("d12", "open-photo-grid", "Bottom sheet / selected place photos", "sheet", navigate("d13"));
addSources("d13", "open-photo", measuredKeys("d13", /^Candidate photo slot \d+$/), "media", navigate("b7", "selectedMediaId"));
addSources("d13", "open-photo-menu", measuredKeys("d13", /^Photo menu(?:#\d+)?$/), "icon-button", overlay("photo-menu"));

add("d14", "go-back", "Back button", "icon-button", history());
addSources("d14", "open-place", measuredKeys("d14", /^UGC card \d+$/), "place-card", navigate("b4", "selectedPlaceId"));
addSources("d14", "toggle-place-like", measuredKeys("d14", /^Heart icon(?:#\d+)?$/), "icon-button", state("likedPlaceIds"));

add("e1", "go-back", "action/back", "icon-button", history());
add("e1", "toggle-follow", "action/primary", "button", state("followedUserIds"), {
  evidence: "The E1 reference visibly labels the measured primary button 팔로우; no edit-profile variant is present in this static frame."
});
addSources("e1", "open-media", measuredKeys("e1", /^media\/photo\/crop-asset(?:#\d+)?$/), "media", navigate("b7", "selectedMediaId"));

add("e2", "go-back", "action/back", "icon-button", history());
add("e2", "update-nickname", "field/nickname/bg", "input", state("form.nickname"));
add("e2", "update-bio", "field/value/bg", "input", state("form.bio"));
add("e2", "show-profile-places", "segment place", "tab", state("selections.profileTab"));
add("e2", "show-profile-routes", "segment route", "tab", state("selections.profileTab"));
add("e2", "edit-media", "action/primary", "button", overlay("media-editor"));
add("e2", "save-profile", "action/save", "button", navigate("e1"));
addSources("e2", "open-media", measuredKeys("e2", /^media\/photo\/crop-asset(?:#\d+)?$/), "media", navigate("b7", "selectedMediaId"));

add("e3", "open-profile", "profile/avatar", "row", navigate("e1", "selectedUserId"));
add("e3", "open-account-settings", "slot/settings-row/chevron", "row", navigate("e4"));
add("e3", "open-notification-settings", "slot/settings-row/chevron#2", "row", navigate("e5"));
add("e3", "open-contact", "slot/settings-row/chevron#3", "row", navigate("e6"));
add("e3", "open-terms", "slot/settings-row/chevron#4", "row", state("selections.settingsSection"));

add("e4", "go-back", "action/back", "icon-button", history());
add("e4", "update-current-password", "field/current-password/bg", "input", state("form.currentPassword"));
add("e4", "update-new-password", "field/new-password/bg", "input", state("form.newPassword"));
add("e4", "update-password-confirmation", "field/new-password-confirm/bg", "input", state("form.passwordConfirmation"));
add("e4", "save-password", "action/save-password", "button", state("toast"));
add("e4", "forgot-password", "action/forgot-password", "text-button", navigate("a5"));
add("e4", "logout", "action/logout", "button", navigate("a3"));
add("e4", "delete-account", "action/delete-account", "text-button", navigate("a1"));

add("e5", "go-back", "action/back", "icon-button", history());
const notificationActions = [
  "toggle-all-notifications",
  "toggle-saved-place-updates",
  "toggle-route-recommendations",
  "toggle-comment-likes",
  "toggle-marketing"
];
notificationActions.forEach((actionId, index) => add(
  "e5",
  actionId,
  index === 0 ? "ui/toggle/bg" : `ui/toggle/bg#${index + 1}`,
  "toggle",
  state(`selections.notifications.${actionId}`)
));

add("e6", "go-back", "action/back", "icon-button", history());
add("e6", "update-message", "field/message/bg", "textarea", state("form.message"));
add("e6", "send-message", "action/send", "button", state("toast"));

add("e7", "go-back", "icon/lucide", "icon-button", history(), {
  evidence: "The E7 back arrow is retained as the measured icon/lucide element inside the flattened editable screen composite."
});
add("e7", "toggle-follow", "action/primary", "button", state("followedUserIds"));
addSources("e7", "open-profile", measuredKeys("e7", /^media\/avatar\/crop-asset(?:#\d+)?$/), "avatar", navigate("e1", "selectedUserId"));
addSources("e7", "open-media", measuredKeys("e7", /^slot\/user-photo\/media(?:#\d+)?$/), "media", navigate("b7", "selectedMediaId"));

const visibleControlPatterns = [
  /^action\/[^/]+$/i,
  /^field\/[^/]+\/(?:bg|container)$/i,
  /^(?:button|Button)(?:#\d+)?(?: \/.*)?$/,
  /CTA/i,
  /^hero-action\/[^/]+$/,
  /(?:^|\/)(?:toggle|tab|filter)(?:\b| \/)/i,
  /^chip(?:#\d+)?$/i,
  /^Photo menu(?:#\d+)?$/,
  /^Candidate photo slot \d+$/,
  /^Navigation \/ back button/,
  /^Back button/,
  /^Locate button/,
  /^Target button/,
  /^Following \/ list CTA$/,
  /^Header \/ filter pill$/,
  /^Header \/ segmented control$/,
  /^Floating \/ (?:add route CTA|scroll to top)$/,
  /^Info \/ (?:address|hours|menu) row$/,
  /^Related places \/ card/,
  /^slot\/comment-item\/like-icon/,
  /^bottom sheet \/ (?:comments editable|business hours|filter only)$/i,
  /^Discover card\/action bg/,
  /^Segmented \//,
  /^segment (?:place|route)$/,
  /^ui\/toggle\/bg/,
  /^slot\/settings-row\/bg/,
  /^Photo grid sheet$/,
  /^Bottom sheet \/ selected place photos$/,
  /^Floating CTA \/ start here$/,
  /^Start CTA \/ bg$/,
  /^Filter \/ change bg$/,
  /^Top \/ back button bg$/,
  /^route card(?:#\d+)?$/,
  /^Feed \/ media tile \d+(?:#\d+)?$/,
  /^media\/(?:photo|avatar)\/crop-asset(?:#\d+)?$/,
  /^slot\/option-card\/bg(?:#\d+)?$/,
  /^gender radio(?:#\d+|\/[^/]+)?$/,
  /^region(?:#\d+)?$/,
  /^slot\/user-photo\/media(?:#\d+)?$/,
  /^UGC card \d+$/,
  /^Heart icon(?:#\d+)?$/
];

export const ALLOWED_NONINTERACTIVE_REASONS = new Set([
  "composite-container",
  "decorative-media",
  "read-only-status",
  "static-validation-status",
  "visual-child"
]);

const reviewedOverrides = {};

function reviewNoninteractive(screenId, sources, reason, evidence) {
  for (const source of sources) {
    reviewedOverrides[`${screenId}\0${source}`] = Object.freeze({
      reason,
      evidence: evidence(source)
    });
  }
}

reviewNoninteractive(
  "a1",
  ["media/photo/crop-asset", "media/photo/crop-asset#2", "media/photo/crop-asset#3", "media/photo/crop-asset#4"],
  "decorative-media",
  (source) => `A1 ${source} is one of the four onboarding collage images and has no button, link, or destination affordance in the reference.`
);
for (const screenId of ["a3", "a4"]) {
  reviewNoninteractive(
    screenId,
    ["action/primary"],
    "composite-container",
    (source) => `${screenId.toUpperCase()} ${source} bounds the separately measured create-account and login button backgrounds; the composite itself is not a third control.`
  );
}
for (const screenId of ["a7", "a8", "a13"]) {
  reviewNoninteractive(
    screenId,
    ["field/password-rules/container"],
    "static-validation-status",
    (source) => `${screenId.toUpperCase()} ${source} displays password requirements and check states only; the reference shows no editable or clickable affordance.`
  );
}
reviewNoninteractive(
  "a15",
  ["gender radio", "gender radio#2", "gender radio#3"],
  "visual-child",
  (source) => `A15 ${source} is the radio-circle artwork inside a separately contracted named gender row.`
);
for (const screenId of ["b1", "b2"]) {
  reviewNoninteractive(
    screenId,
    ["Header / segmented control"],
    "composite-container",
    (source) => `${screenId.toUpperCase()} ${source} contains the separately contracted Following and Discover tab labels.`
  );
  reviewNoninteractive(
    screenId,
    ["filter label"],
    "visual-child",
    (source) => `${screenId.toUpperCase()} ${source} is text inside the separately contracted Header / filter pill hit target.`
  );
}
for (const screenId of ["b4", "b5", "b6"]) {
  reviewNoninteractive(
    screenId,
    ["Icon / CTA / share", "CTA / share text", "Icon / CTA / save", "CTA / save text"],
    "visual-child",
    (source) => `${screenId.toUpperCase()} ${source} is icon or text artwork inside its separately contracted share/save button background.`
  );
}
reviewNoninteractive(
  "b6",
  ["Floating route CTA / blur bg", "Floating route CTA / icon"],
  "visual-child",
  (source) => `B6 ${source} is presentation artwork inside the separately contracted Floating route CTA / text control.`
);
reviewNoninteractive(
  "b9",
  ["bottom sheet / business hours"],
  "composite-container",
  (source) => `B9 ${source} is the hours-sheet surface; its measured back button is the independent dismiss control.`
);
reviewNoninteractive(
  "b10",
  ["CTA / share icon", "CTA / share text", "CTA / save icon", "CTA / save text"],
  "visual-child",
  (source) => `B10 ${source} is icon or text artwork inside its separately contracted share/save button background.`
);
reviewNoninteractive(
  "b10",
  ["Floating route CTA / glass bg", "Floating route CTA / icon"],
  "visual-child",
  (source) => `B10 ${source} is presentation artwork inside the separately contracted Floating route CTA / text control.`
);
for (const screenId of ["c1", "c2"]) {
  reviewNoninteractive(
    screenId,
    ["bottom sheet / filter only"],
    "composite-container",
    (source) => `${screenId.toUpperCase()} ${source} is the filter-sheet surface containing separately measured option buttons, apply CTA, and reset text.`
  );
}
reviewNoninteractive(
  "c3",
  ["bottom fixed CTA area"],
  "composite-container",
  (source) => `C3 ${source} is the fixed footer surface around the separately measured confirmation CTA.`
);
reviewNoninteractive(
  "c4",
  ["toggle / place route"],
  "composite-container",
  (source) => `C4 ${source} is the shared tab track; icon / bookmark and icon / route are the two distinct contracted tab sources.`
);
reviewNoninteractive(
  "c4",
  ["route card", "route card#2", "route card#3"],
  "composite-container",
  (source) => `C4 ${source} groups one route summary with separately measured 경로 보기 and 상세 보기 buttons; the card has no additional whole-card action.`
);
reviewNoninteractive(
  "c6",
  ["toggle / place route"],
  "composite-container",
  (source) => `C6 ${source} is the shared tab track; icon / bookmark and icon / route are the two distinct contracted tab sources.`
);
reviewNoninteractive(
  "d1",
  ["Start CTA / icon bg", "Start CTA / text"],
  "visual-child",
  (source) => `D1 ${source} is artwork inside the separately contracted Start CTA / bg button.`
);
for (const [screenId, inactiveTabText] of [["d2", "Segmented / saved text"], ["d3", "Segmented / discover text"]]) {
  reviewNoninteractive(
    screenId,
    ["Segmented / bg"],
    "composite-container",
    (source) => `${screenId.toUpperCase()} ${source} is the shared route-source tab track around separately contracted tab elements.`
  );
  reviewNoninteractive(
    screenId,
    [inactiveTabText, "Filter / change text", "CTA / route label"],
    "visual-child",
    (source) => `${screenId.toUpperCase()} ${source} is label artwork inside a separately contracted tab, filter button, or route CTA source.`
  );
}
reviewNoninteractive(
  "d11",
  ["CTA text"],
  "visual-child",
  (source) => `D11 ${source} is the label inside the separately contracted Floating CTA / start here button.`
);
reviewNoninteractive(
  "d13",
  ["Photo grid sheet"],
  "composite-container",
  (source) => `D13 ${source} is the sheet surface containing ten photo slots and nine separately contracted photo-menu buttons.`
);
reviewNoninteractive(
  "e4",
  ["field/email/bg"],
  "read-only-status",
  (source) => `E4 ${source} displays the verified account email as read-only; the reference provides no email edit affordance.`
);
reviewNoninteractive(
  "e5",
  ["ui/toggle/knob", "ui/toggle/knob#2", "ui/toggle/knob#3", "ui/toggle/knob#4", "ui/toggle/knob#5"],
  "visual-child",
  (source) => `E5 ${source} is the moving knob artwork inside its separately contracted toggle background.`
);

export const NONINTERACTIVE_OVERRIDES = Object.freeze(reviewedOverrides);

function isControlShaped(source) {
  return visibleControlPatterns.some((pattern) => pattern.test(source));
}

export function validateActionSources(actionRecords) {
  const recordsBySource = new Map();
  for (const record of actionRecords) {
    const key = `${record.screenId}\0${record.source}`;
    const records = recordsBySource.get(key) || [];
    records.push(record);
    recordsBySource.set(key, records);
  }

  for (const [key, records] of recordsBySource) {
    if (new Set(records.map((record) => record.actionId)).size <= 1) continue;
    const variantsAreProven = records.every((record) => (
      record.variant?.condition && record.variant?.figmaNodeId
    ));
    const variantNodeIdsAreUnique = new Set(records.map((record) => record.variant?.figmaNodeId)).size === records.length;
    if (!variantsAreProven || !variantNodeIdsAreUnique) {
      throw new Error(`Duplicate measured action source without proven variants: ${key.replace("\0", "/")}`);
    }
  }
}

export function classifyNonInteractive({ measurementRegistry, actionRecords, overrides }) {
  const actionSources = new Set(actionRecords.map((record) => `${record.screenId}\0${record.source}`));
  const classifications = [];
  const usedOverrides = new Set();

  for (const [screenId, measurement] of Object.entries(measurementRegistry)) {
    for (const source of Object.keys(measurement.elements)) {
      if (!isControlShaped(source) || actionSources.has(`${screenId}\0${source}`)) continue;
      const key = `${screenId}\0${source}`;
      if (!Object.hasOwn(overrides, key)) {
        throw new Error(`Unreviewed control-shaped element: ${screenId}/${source}`);
      }

      const override = overrides[key];
      if (!ALLOWED_NONINTERACTIVE_REASONS.has(override.reason)) {
        throw new Error(`Unsupported noninteractive reason: ${screenId}/${source}`);
      }
      if (!override.evidence || /reference and 59-screen inventory|visual child or containing composite/i.test(override.evidence)) {
        throw new Error(`Missing specific noninteractive evidence: ${screenId}/${source}`);
      }

      classifications.push({
        screenId,
        source,
        kind: "measured-control-layer",
        reason: override.reason,
        evidence: override.evidence
      });
      usedOverrides.add(key);
    }
  }

  for (const key of Object.keys(overrides)) {
    if (!usedOverrides.has(key)) throw new Error(`Stale noninteractive override: ${key.replace("\0", "/")}`);
  }
  return classifications;
}

export function buildActionContract() {
  validateActionSources(actions);
  return {
    version: 1,
    generatedFrom: "screen-measurements.json and reviewed 393x852 reference PNGs",
    actions,
    nonInteractive: classifyNonInteractive({
      measurementRegistry: measurements,
      actionRecords: actions,
      overrides: NONINTERACTIVE_OVERRIDES
    })
  };
}

if (process.argv[1] === scriptPath) {
  const contract = buildActionContract();
  await writeFile(outputPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
  console.log(`Wrote ${contract.actions.length} action records and ${contract.nonInteractive.length} classifications to ${outputPath}`);
}
