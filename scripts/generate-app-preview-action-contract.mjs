import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import measurements from "../public/app-preview/figma/screen-measurements.json" with { type: "json" };

const outputPath = fileURLToPath(new URL("../public/app-preview/figma/action-contract.json", import.meta.url));
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

add("c4", "show-saved-places", "toggle / place route", "tab", navigate("c6"), {
  evidence: "The two saved-view tabs are flattened into the measured place/route toggle composite."
});
add("c4", "show-saved-routes", "toggle / place route", "tab", state("selections.savedTab"), {
  evidence: "The two saved-view tabs are flattened into the measured place/route toggle composite."
});
addSources("c4", "select-filter-tag", measuredKeys("c4", /^chip(?:#\d+)?$/), "chip", state("selections.savedFilter"));
addSources("c4", "open-route-map", ["button", "button#3", "button#5"], "button", navigate("d9", "selectedRouteId"));
addSources("c4", "open-route", ["button#2", "button#4", "button#6"], "button", navigate("d10", "selectedRouteId"));

add("c5", "go-back", "button / back floating", "icon-button", history());
add("c5", "close-place-card", "button / close place card", "icon-button", state("selections.selectedPlaceId"));
add("c5", "locate-user", "button / locate floating", "icon-button", state("mapViewport"));
add("c5", "open-place", "place card / selected saved place", "place-card", navigate("b4", "selectedPlaceId"));

add("c6", "show-saved-places", "toggle / place route", "tab", state("selections.savedTab"));
add("c6", "show-saved-routes", "toggle / place route", "tab", navigate("c4"));
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
add("e1", "edit-profile", "action/primary", "button", navigate("e2"));
add("e1", "toggle-follow", "action/primary", "button", state("followedUserIds"), {
  evidence: "The measured E1 primary profile button is reused for owner edit and viewed-user follow states; the Task 4 brief requires the follow state contract."
});
addSources("e1", "open-media", measuredKeys("e1", /^media\/photo\/crop-asset(?:#\d+)?$/), "media", navigate("b7", "selectedMediaId"));

add("e2", "go-back", "action/back", "icon-button", history());
add("e2", "update-nickname", "field/nickname/bg", "input", state("form.nickname"));
add("e2", "update-bio", "field/value/bg", "input", state("form.bio"));
add("e2", "show-profile-places", "segment place icon", "tab", state("selections.profileTab"));
add("e2", "show-profile-routes", "segment route", "tab", state("selections.profileTab"));
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

const actionSources = new Set(actions.map((record) => `${record.screenId}\0${record.source}`));
const nonInteractive = [];

for (const [screenId, measurement] of Object.entries(measurements)) {
  for (const source of Object.keys(measurement.elements)) {
    if (!visibleControlPatterns.some((pattern) => pattern.test(source))) continue;
    if (actionSources.has(`${screenId}\0${source}`)) continue;

    nonInteractive.push({
      screenId,
      source,
      kind: "measured-control-layer",
      reason: /(?:bg|label|icon|composite|control|sheet|grid)$/i.test(source)
        ? "This measured layer is a visual child or containing composite of separately contracted controls and has no independent hit target."
        : "The reference and 59-screen inventory show no separate destination or state for this control-shaped layer."
    });
  }
}

const contract = {
  version: 1,
  generatedFrom: "screen-measurements.json and reviewed 393x852 reference PNGs",
  actions,
  nonInteractive
};

await writeFile(outputPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
console.log(`Wrote ${actions.length} action records and ${nonInteractive.length} classifications to ${outputPath}`);
