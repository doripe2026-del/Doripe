import { MEDIA, PLACES, ROUTES, USERS } from "../fixtures.js";

const SCREEN_NAVIGATE_EVENT = "app-preview:screen-navigate";
const OVERLAY_DISMISS_EVENT = "app-preview:overlay-dismiss";
const SELECTION_CLEAR_EVENT = "app-preview:selection-clear";
const NODE_IDS = Object.freeze({ e1: "446:2912", e2: "446:2850", e3: "446:2952", e4: "446:2984", e5: "446:3031" });

function element(tag, className = "", text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name, className = "") {
  const image = element("img", className);
  image.src = `/app-preview/assets/settings/${name}.svg`;
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  image.draggable = false;
  return image;
}

function root(screenId) {
  const screen = element("section", `settings-screen settings-screen--${screenId}`);
  screen.dataset.screenId = screenId;
  screen.dataset.figmaNode = NODE_IDS[screenId];
  screen.dataset.renderMode = "semantic";
  return screen;
}

function button(label, action, className = "", values = {}) {
  const node = element("button", className);
  node.type = "button";
  node.setAttribute("aria-label", label);
  node.dataset.action = action;
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) node.dataset[key] = String(value);
  }
  if (values.value !== undefined) node.value = String(values.value);
  return node;
}

function navigateButton(label, screenId, className = "", iconName) {
  const node = element("button", className);
  node.type = "button";
  node.setAttribute("aria-label", label);
  if (iconName) node.append(icon(iconName));
  node.addEventListener("click", () => document.dispatchEvent(new CustomEvent(SCREEN_NAVIGATE_EVENT, { detail: { screenId } })));
  return node;
}

function backButton() {
  const back = button("뒤로 가기", "go-back", "settings-back");
  back.append(icon("back"));
  return back;
}

function titleBar(title) {
  const bar = element("header", "settings-titlebar");
  bar.append(backButton(), element("h1", "", title));
  return bar;
}

function toast(state) {
  if (!state?.toast?.message) return null;
  const output = element("output", `settings-toast settings-toast--${state.toast.kind}`, state.toast.message);
  output.setAttribute("role", "status");
  output.setAttribute("aria-live", "polite");
  return output;
}

function bottomNav() {
  const nav = element("nav", "settings-bottom-nav");
  nav.setAttribute("aria-label", "주요 메뉴");
  const specs = [
    ["발견", "b2", "nav-discover"],
    ["저장", "c1", "nav-saved"],
    ["코스", "d1", "nav-route"],
    ["설정", "e1", "nav-settings"]
  ];
  specs.forEach(([label, target, iconName], index) => {
    const item = navigateButton(label, target, `settings-bottom-nav__item ${index === 3 ? "is-active" : ""}`, iconName);
    item.setAttribute("aria-current", index === 3 ? "page" : "false");
    nav.append(item);
  });
  return nav;
}

function settingsRow(label, action, iconName, values = {}) {
  const row = button(label, action, "settings-row", values);
  row.append(icon(iconName, "settings-row__icon"), element("strong", "", label), icon("chevron", "settings-row__chevron"));
  return row;
}

function renderTermsSheet() {
  const backdrop = element("div", "settings-modal-backdrop");
  const sheet = element("section", "settings-terms-sheet");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.append(element("h2", "", "약관 및 개인정보"));
  const content = element("p", "settings-terms-sheet__content", "Doripe 서비스를 이용할 때 필요한 기본 약관을 확인할 수 있어요.");
  const terms = element("button", "", "서비스 이용약관");
  terms.type = "button";
  terms.addEventListener("click", () => {
    content.textContent = "서비스 이용약관: 계정, 콘텐츠, 저장 및 코스 기능의 이용 기준과 사용자의 책임을 안내합니다.";
  });
  const privacy = element("button", "", "개인정보 처리방침");
  privacy.type = "button";
  privacy.addEventListener("click", () => {
    content.textContent = "개인정보 처리방침: 계정 정보와 서비스 이용 기록의 수집 목적, 보관 기간, 삭제 방법을 안내합니다.";
  });
  const close = element("button", "", "닫기");
  close.type = "button";
  close.addEventListener("click", () => document.dispatchEvent(new CustomEvent(SELECTION_CLEAR_EVENT, { detail: { keys: ["settingsSection"] } })));
  sheet.append(terms, privacy, content, close);
  backdrop.append(sheet);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) document.dispatchEvent(new CustomEvent(SELECTION_CLEAR_EVENT, { detail: { keys: ["settingsSection"] } }));
  });
  return backdrop;
}

function renderMy(state) {
  const screen = root("e1");
  const user = USERS[0];
  screen.append(element("h1", "settings-main-title", "설정"));
  const profile = button(`${user.name} 프로필 보기`, "open-profile", "settings-profile", { userId: user.id });
  const avatar = element("span", "settings-profile__avatar");
  avatar.append(icon("profile"));
  const copy = element("span", "settings-profile__copy");
  copy.append(element("strong", "", state?.form?.nickname || user.handle), element("small", "", "프로필 보기"));
  profile.append(avatar, copy, icon("chevron", "settings-row__chevron"));
  screen.append(profile);
  const rows = element("div", "settings-rows");
  rows.append(
    settingsRow("계정", "open-account-settings", "account"),
    settingsRow("알림", "open-notification-settings", "bell"),
    settingsRow("문의", "open-contact", "contact"),
    settingsRow("약관 및 개인정보", "open-terms", "privacy", { value: "terms" })
  );
  screen.append(rows, bottomNav());
  if (state?.selections?.settingsSection === "terms") screen.append(renderTermsSheet());
  return screen;
}

function profileTab(state) {
  return state?.selections?.profileTab === "routes" ? "routes" : "places";
}

function renderProfilePanel(state, tab) {
  const panel = element("div", "settings-profile-panel");
  panel.setAttribute("role", "tabpanel");
  if (tab === "routes") {
    ROUTES.forEach((route) => {
      const card = element("article", "settings-profile-route");
      card.append(element("strong", "", route.name.replace("루트", "코스")), element("small", "", `${route.placeIds.length}곳 · ${route.walkingMinutes}분`));
      panel.append(card);
    });
    return panel;
  }
  MEDIA.slice(0, 6).forEach((media, index) => {
    const card = button(`${media.alt} 편집`, "edit-media", "settings-profile-media", { mediaId: media.id });
    const image = element("img");
    image.src = media.src;
    image.alt = media.alt;
    card.append(image, element("span", "", media.kind === "video" ? "▶" : "▧"));
    card.style.setProperty("--profile-media-index", index);
    panel.append(card);
  });
  return panel;
}

function renderMediaEditor(state) {
  const backdrop = element("div", "settings-modal-backdrop");
  const dialog = element("section", "settings-media-editor");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  const media = MEDIA.find((item) => item.id === state?.selections?.selectedMediaId) || MEDIA[0];
  const image = element("img");
  image.src = media.src;
  image.alt = media.alt;
  dialog.append(element("h2", "", "사진 편집"), image, element("p", "", "이 사진의 장소 연결과 공개 상태를 관리할 수 있어요."));
  const close = element("button", "", "완료");
  close.type = "button";
  close.addEventListener("click", () => document.dispatchEvent(new CustomEvent(OVERLAY_DISMISS_EVENT, { detail: { overlayId: "media-editor" } })));
  dialog.append(close);
  backdrop.append(dialog);
  return backdrop;
}

function renderProfileEdit(state) {
  const screen = root("e2");
  const user = USERS[0];
  screen.append(titleBar("프로필 수정"));
  const avatar = element("div", "settings-edit-avatar");
  const avatarImage = element("img");
  avatarImage.src = mediaForUser(user).src;
  avatarImage.alt = `${user.name} 프로필`;
  avatar.append(avatarImage, element("span", "", "▣"));
  screen.append(avatar);
  const form = element("div", "settings-profile-form");
  const nicknameLabel = element("label", "settings-field-label", "닉네임");
  const nickname = element("input", "settings-input");
  nickname.setAttribute("aria-label", "닉네임");
  nickname.value = state?.form?.nickname ?? user.handle;
  nickname.dataset.action = "update-nickname";
  const bioLabel = element("label", "settings-field-label", "소개");
  const bio = element("input", "settings-input");
  bio.setAttribute("aria-label", "소개");
  bio.value = state?.form?.bio ?? user.bio;
  bio.dataset.action = "update-bio";
  form.append(nicknameLabel, nickname, bioLabel, bio);
  screen.append(form);
  const tab = profileTab(state);
  const tabs = element("div", "settings-profile-tabs");
  tabs.setAttribute("role", "tablist");
  const places = button("장소", "show-profile-places", `settings-profile-tab ${tab === "places" ? "is-active" : ""}`, { value: "places" });
  const routes = button("코스", "show-profile-routes", `settings-profile-tab ${tab === "routes" ? "is-active" : ""}`, { value: "routes" });
  places.setAttribute("role", "tab"); routes.setAttribute("role", "tab");
  places.setAttribute("aria-selected", String(tab === "places")); routes.setAttribute("aria-selected", String(tab === "routes"));
  places.append(icon("bookmark"), element("span", "", "장소")); routes.append(icon("route"), element("span", "", "코스"));
  tabs.append(places, routes);
  screen.append(tabs);
  const heading = element("div", "settings-profile-heading");
  heading.append(element("h2", "", tab === "places" ? "내가 올린 사진" : "내가 만든 코스"));
  if (tab === "places") {
    const edit = button("사진 편집", "edit-media", "settings-profile-edit", { mediaId: MEDIA[0].id });
    edit.textContent = "편집";
    heading.append(edit);
  }
  screen.append(heading, renderProfilePanel(state, tab));
  const save = button("저장하기", "save-profile", "settings-save");
  save.textContent = "저장하기";
  screen.append(save);
  if (state?.overlays?.includes("media-editor")) screen.append(renderMediaEditor(state));
  return screen;
}

function mediaForUser(user) {
  return MEDIA.find((media) => media.userId === user.id) || MEDIA[0];
}

function passwordField(label, action, value) {
  const wrap = element("label", "settings-account-field", label);
  const input = element("input");
  input.type = "password";
  input.value = value || "";
  input.dataset.action = action;
  input.setAttribute("aria-label", label);
  wrap.append(input);
  return wrap;
}

function renderAccount(state) {
  const screen = root("e3");
  screen.append(titleBar("계정"));
  const content = element("div", "settings-account-content");
  content.append(element("h2", "", "이메일 로그인"), element("strong", "settings-account-label", "이메일"));
  const email = element("div", "settings-account-email", "dori@example.com");
  const verified = element("span", "settings-account-verified", "✓ 인증 완료");
  content.append(email, verified, element("h2", "settings-password-title", "비밀번호 변경"));
  content.append(
    passwordField("현재 비밀번호", "update-current-password", state?.form?.currentPassword),
    passwordField("새 비밀번호", "update-new-password", state?.form?.newPassword),
    passwordField("새 비밀번호 확인", "update-password-confirmation", state?.form?.passwordConfirmation)
  );
  const save = button("비밀번호 저장", "save-password", "settings-account-save");
  save.textContent = "비밀번호 저장";
  const forgot = button("비밀번호를 잊으셨나요? 재설정 메일 받기", "forgot-password", "settings-account-forgot");
  forgot.textContent = "비밀번호를 잊으셨나요? 재설정 메일 받기";
  content.append(save, forgot, element("h2", "settings-management-title", "계정 관리"));
  const logout = button("로그아웃", "logout", "settings-logout");
  logout.textContent = "로그아웃";
  const remove = button("회원 탈퇴", "delete-account", "settings-delete-account");
  remove.textContent = "회원 탈퇴";
  content.append(logout, remove);
  screen.append(content);
  const currentToast = toast(state);
  if (currentToast) screen.append(currentToast);
  return screen;
}

const NOTIFICATIONS = Object.freeze([
  ["전체 알림", "모든 알림을 한 번에 관리해요.", "toggle-all-notifications", "all", "bell"],
  ["저장한 장소 리마인드", "저장한 장소를 다시 보도록 알려드려요.", "toggle-saved-place-updates", "savedPlaceUpdates", "bookmark"],
  ["코스 추천 알림", "저장한 코스와 추천 코스를 알려드려요.", "toggle-route-recommendations", "routeRecommendations", "route"],
  ["댓글 및 좋아요", "댓글과 좋아요 알림을 받아요.", "toggle-comment-likes", "commentLikes", "comment"],
  ["마케팅 정보 수신", "이벤트, 혜택, 서비스 소식을 받아요.", "toggle-marketing", "marketing", "marketing"]
]);

function notificationValue(state, key) {
  const values = state?.selections?.notifications || {};
  if (Object.hasOwn(values, key)) return values[key] === true;
  return ["savedPlaceUpdates", "routeRecommendations"].includes(key);
}

function renderNotifications(state) {
  const screen = root("e4");
  screen.append(titleBar("알림"));
  const list = element("div", "settings-notification-list");
  NOTIFICATIONS.forEach(([label, description, action, key, iconName]) => {
    const row = element("label", "settings-notification-row");
    row.append(icon(iconName), element("strong", "", label), element("small", "", description));
    const input = element("input", "settings-toggle");
    input.type = "checkbox";
    input.role = "switch";
    input.checked = notificationValue(state, key);
    input.dataset.action = action;
    input.setAttribute("aria-label", label);
    row.append(input);
    list.append(row);
  });
  screen.append(list);
  return screen;
}

function renderContact(state) {
  const screen = root("e5");
  screen.append(titleBar("문의"));
  const textarea = element("textarea", "settings-contact-message");
  textarea.dataset.action = "update-message";
  textarea.setAttribute("aria-label", "문의 내용");
  textarea.placeholder = "문의 내용을 입력해주세요.";
  textarea.value = state?.form?.message || "";
  textarea.maxLength = 1000;
  const counter = element("small", "settings-contact-counter", `${textarea.value.length}/1000`);
  textarea.addEventListener("input", () => { counter.textContent = `${textarea.value.length}/1000`; });
  const send = button("보내기", "send-message", "settings-contact-send");
  send.textContent = "보내기";
  screen.append(textarea, counter, send);
  const currentToast = toast(state);
  if (currentToast) screen.append(currentToast);
  return screen;
}

export const SETTINGS_RENDERERS = Object.freeze({
  e1: renderMy,
  e2: renderProfileEdit,
  e3: renderAccount,
  e4: renderNotifications,
  e5: renderContact
});
