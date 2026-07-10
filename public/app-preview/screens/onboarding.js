const ASSET_ROOT = "/app-preview/assets/onboarding";
const SCREEN_TEARDOWN_EVENT = "app-preview:screen-teardown";
const SCREEN_NAVIGATE_EVENT = "app-preview:screen-navigate";
const NEIGHBORHOODS = Object.freeze([
  ["yeonnam", "연남", "region"],
  ["seongsu", "성수", "region#2"],
  ["yongsan", "용산", "region#3"]
]);
const NEIGHBORHOOD_LABELS = new Map(NEIGHBORHOODS.map(([id, label]) => [id, label]));

function createScreen(id, figmaNodeId, className) {
  const screen = document.createElement("section");
  screen.className = `onboarding-screen ${className}`;
  screen.dataset.screenId = id;
  screen.dataset.figmaNode = figmaNodeId;
  screen.dataset.renderMode = "semantic";
  return screen;
}

function enableWhenInputIsValid(screen, inputSelector, buttonSelector, validator) {
  const input = screen.querySelector(inputSelector);
  const button = screen.querySelector(buttonSelector);
  const sync = () => {
    button.disabled = !validator(input.value);
    button.setAttribute("aria-disabled", String(button.disabled));
  };
  input.addEventListener("input", sync);
  sync();
}

function passwordRuleResults(value) {
  return [value.length >= 8, /[A-Za-z]/.test(value), /\d/.test(value)];
}

function storedFormValue(key, fallback) {
  try {
    const stored = JSON.parse(globalThis.localStorage?.getItem("doripe_app_preview_v1") || "null");
    return typeof stored?.form?.[key] === "string" ? stored.form[key] : fallback;
  } catch {
    return fallback;
  }
}

function loadingNeighborhoodLabel(screenId) {
  const staticFrame = new URLSearchParams(globalThis.location?.search || "").get("static") === "1";
  const staticFallback = screenId === "a21" ? "yeonnam" : "seongsu";
  const fallback = staticFrame ? staticFallback : "seongsu";
  return NEIGHBORHOOD_LABELS.get(storedFormValue("neighborhoodId", fallback))
    || NEIGHBORHOOD_LABELS.get(fallback);
}

function directionLabel(label) {
  const finalConsonant = (label.codePointAt(label.length - 1) - 0xac00) % 28;
  const particle = finalConsonant === 0 || finalConsonant === 8 ? "로" : "으로";
  return `${label}${particle}`;
}

function replaceScreenAfter(screen, screenId, delay) {
  if (new URLSearchParams(globalThis.location?.search || "").get("static") === "1") return;
  let active = true;
  const handle = globalThis.setTimeout(() => {
    active = false;
    if (!screen.isConnected) return;
    screen.dispatchEvent(new CustomEvent(SCREEN_NAVIGATE_EVENT, {
      bubbles: true,
      detail: { screenId, replace: true }
    }));
  }, delay);
  screen.addEventListener(SCREEN_TEARDOWN_EVENT, () => {
    if (!active) return;
    active = false;
    globalThis.clearTimeout(handle);
  }, { once: true });
}

function startLoadingProgress(screen, { fillSelector, destination }) {
  if (new URLSearchParams(globalThis.location?.search || "").get("static") === "1") return;
  const fill = screen.querySelector(fillSelector);
  let value = Number(fill.getAttribute("aria-valuenow"));
  let active = true;
  const stop = () => {
    if (!active) return;
    active = false;
    globalThis.clearInterval(interval);
  };
  const interval = globalThis.setInterval(() => {
    if (!screen.isConnected) {
      stop();
      return;
    }
    value = Math.min(100, value + 8);
    const width = 58 + ((183 - 58) * (value - 32)) / (100 - 32);
    fill.style.width = `${width}px`;
    fill.style.left = `${105 + (183 - width) / 2}px`;
    fill.setAttribute("aria-valuenow", String(value));
    if (value === 100) {
      stop();
      replaceScreenAfter(screen, destination, 180);
    }
  }, 100);
  screen.addEventListener(SCREEN_TEARDOWN_EVENT, stop, { once: true });
}

function bindPasswordConfirmation(screen, { requireMatch = false } = {}) {
  const password = screen.querySelector('[data-action="update-new-password"]');
  const confirmation = screen.querySelector('[data-action="update-password-confirmation"]');
  const save = screen.querySelector('[data-action="save-password"]');
  const rules = [...screen.querySelectorAll("[data-password-rule]")];
  const sync = () => {
    const results = passwordRuleResults(password.value);
    rules.forEach((rule, index) => rule.dataset.passed = String(results[index]));
    const matches = password.value === confirmation.value && confirmation.value.length > 0;
    screen.dataset.passwordMatch = String(matches);
    save.disabled = !results.every(Boolean)
      || confirmation.value.length === 0
      || (requireMatch && !matches);
    save.setAttribute("aria-disabled", String(save.disabled));
  };
  password.addEventListener("input", sync);
  confirmation.addEventListener("input", sync);
  sync();
}

function bindSignupEmail(screen, { requireFormat = true } = {}) {
  const input = screen.querySelector('[data-action="update-email"]');
  const next = screen.querySelector('[data-action="continue-sign-up"]');
  const sync = () => {
    const valid = requireFormat
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)
      : input.value.trim().length > 0;
    screen.dataset.emailValid = String(valid);
    next.disabled = !valid;
    next.setAttribute("aria-disabled", String(next.disabled));
  };
  input.addEventListener("input", sync);
  sync();
}

function bindAvailableEmail(screen) {
  const input = screen.querySelector('[data-action="update-email"]');
  const next = screen.querySelector('[data-action="continue-sign-up"]');
  const sync = () => {
    const value = input.value.trim().toLowerCase();
    const available = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      && value !== "doripe@example.com";
    screen.dataset.emailValid = String(available);
    next.disabled = !available;
    next.setAttribute("aria-disabled", String(next.disabled));
  };
  input.addEventListener("input", sync);
  sync();
}

function bindSignupPassword(screen) {
  const input = screen.querySelector('[data-action="update-password"]');
  const next = screen.querySelector('[data-action="continue-sign-up"]');
  const rules = [...screen.querySelectorAll("[data-password-rule]")];
  const sync = () => {
    const results = passwordRuleResults(input.value);
    const valid = results.every(Boolean);
    screen.dataset.passwordValid = String(valid);
    rules.forEach((rule, index) => rule.dataset.passed = String(results[index]));
    next.disabled = !valid;
    next.setAttribute("aria-disabled", String(next.disabled));
  };
  input.addEventListener("input", sync);
  sync();
}

export function renderA1() {
  const screen = createScreen("a1", "446:34", "onboarding-a1");
  screen.innerHTML = `
    <div class="a1-photo a1-photo--one" data-measure-key="media/photo/crop-asset" aria-hidden="true">
      <img src="${ASSET_ROOT}/a1-photo-1.png" alt="" draggable="false">
    </div>
    <div class="a1-photo a1-photo--two" data-measure-key="media/photo/crop-asset#2" aria-hidden="true">
      <img src="${ASSET_ROOT}/a1-photo-2.png" alt="" draggable="false">
    </div>
    <div class="a1-photo a1-photo--three" data-measure-key="media/photo/crop-asset#3" aria-hidden="true">
      <img src="${ASSET_ROOT}/a1-photo-3.png" alt="" draggable="false">
    </div>
    <div class="a1-photo a1-photo--four" data-measure-key="media/photo/crop-asset#4" aria-hidden="true">
      <img src="${ASSET_ROOT}/a1-photo-4.png" alt="" draggable="false">
    </div>
    <div class="a1-brand" aria-label="Doripe">
      <img class="a1-brand__mark" src="${ASSET_ROOT}/doripe-mark.png" alt="" data-measure-key="Header-/-brand/logo/image" draggable="false">
      <span class="a1-brand__name">Doripe</span>
    </div>
    <h1 class="a1-title" data-measure-key="screen/title">오늘 갈 곳,<br>1분 안에 정해요</h1>
    <p class="a1-subtitle" data-measure-key="screen/subtitle">취향에 맞는 장소를 발견하고<br>바로 루트로 이어보세요</p>
    <button class="a1-start" type="button" data-action="start" data-measure-key="action/start">시작하기</button>
    <button class="a1-login" type="button" data-action="login" data-measure-key="action/login">로그인</button>
  `;
  return screen;
}

export function renderA1Splash() {
  const screen = createScreen("a1-splash", "579:698", "onboarding-a1-splash");
  screen.innerHTML = `
    <h1 class="loading-logo-title" aria-label="Doripe"></h1>
    <img class="loading-logo" src="${ASSET_ROOT}/doripe-mark.png" alt="" data-measure-key="Header-/-brand/logo/image" draggable="false">
    <div class="loading-track" data-measure-key="ui/loading/track" aria-hidden="true"></div>
    <div class="loading-fill" role="progressbar" aria-label="Doripe 시작 중" aria-valuemin="0" aria-valuemax="100" aria-valuenow="32" data-measure-key="ui/loading/fill"></div>
  `;
  startLoadingProgress(screen, { fillSelector: ".loading-fill", destination: "a1" });
  return screen;
}

export function renderA3() {
  const screen = createScreen("a3", "579:929", "onboarding-a3");
  screen.innerHTML = `
    <div class="a3-brand" aria-label="Doripe">
      <img src="${ASSET_ROOT}/doripe-mark.png" alt="" data-measure-key="Header-/-brand/logo/image" draggable="false">
      <span>Doripe</span>
    </div>
    <h1 data-measure-key="screen/title">다시 만나서 반가워요</h1>
    <label class="a3-field a3-field--email">
      <span class="a3-field__label">이메일</span>
      <input type="email" inputmode="email" autocomplete="email" aria-label="이메일" placeholder="이메일" data-action="update-email" data-measure-key="field/email/bg">
      <img src="${ASSET_ROOT}/email.svg" alt="" aria-hidden="true" draggable="false">
    </label>
    <label class="a3-field a3-field--password">
      <span class="a3-field__label">비밀번호</span>
      <input type="password" autocomplete="current-password" aria-label="비밀번호" placeholder="비밀번호" data-action="update-password" data-measure-key="field/password/bg">
      <img src="${ASSET_ROOT}/lock.svg" alt="" aria-hidden="true" draggable="false">
    </label>
    <button class="a3-forgot" type="button" data-action="forgot-password" data-measure-key="action/forgot-password">비밀번호를 잊으셨나요?</button>
    <div class="a3-primary-measure" data-measure-key="action/primary" aria-hidden="true"></div>
    <button class="a3-create" type="button" data-action="create-account" data-measure-key="action/primary/bg#2">새 계정 만들기</button>
    <button class="a3-login" type="button" data-action="submit-login" data-measure-key="action/primary/bg">로그인</button>
  `;
  screen.querySelector('[data-action="update-email"]').value = storedFormValue("email", "");
  screen.querySelector('[data-action="update-password"]').value = storedFormValue("password", "");
  return screen;
}

export function renderA4() {
  const screen = createScreen("a4", "579:991", "onboarding-a3 onboarding-a4");
  screen.innerHTML = `
    <div class="a3-brand" aria-label="Doripe">
      <img src="${ASSET_ROOT}/doripe-mark.png" alt="" data-measure-key="Header-/-brand/logo/image" draggable="false">
      <span>Doripe</span>
    </div>
    <h1 data-measure-key="screen/title">다시 로그인해 주세요</h1>
    <label class="a3-field a3-field--email">
      <span class="a3-field__label">이메일</span>
      <input type="email" inputmode="email" autocomplete="email" aria-label="이메일" data-action="update-email" data-measure-key="field/email/bg">
      <img src="${ASSET_ROOT}/email.svg" alt="" aria-hidden="true" draggable="false">
    </label>
    <label class="a3-field a3-field--password">
      <span class="a3-field__label">비밀번호</span>
      <input type="password" autocomplete="current-password" aria-label="비밀번호" data-action="update-password" data-measure-key="field/password/bg">
      <img src="${ASSET_ROOT}/lock.svg" alt="" aria-hidden="true" draggable="false">
    </label>
    <p class="a4-error" data-measure-key="state/helper-text">이메일 또는 비밀번호가 맞지 않아요.</p>
    <button class="a3-forgot" type="button" data-action="forgot-password" data-measure-key="action/forgot-password">비밀번호를 잊으셨나요?</button>
    <div class="a3-primary-measure" data-measure-key="action/primary" aria-hidden="true"></div>
    <button class="a3-create" type="button" data-action="submit-login" data-measure-key="action/primary/bg#2">로그인</button>
    <button class="a3-login" type="button" data-action="create-account" data-measure-key="action/primary/bg">회원가입으로 가기</button>
  `;
  screen.querySelector('[data-action="update-email"]').value = storedFormValue("email", "doripe@example.com");
  screen.querySelector('[data-action="update-password"]').value = storedFormValue("password", "password");
  return screen;
}

export function renderA5() {
  const screen = createScreen("a5", "579:833", "onboarding-a5");
  screen.innerHTML = `
    <button class="setup-back" type="button" data-action="go-back" data-measure-key="action/back" aria-label="뒤로 가기">
      <img src="/app-preview/assets/icons/back.svg" alt="" aria-hidden="true" draggable="false">
    </button>
    <h1 data-measure-key="screen/title">이메일을 입력해주세요</h1>
    <p class="a5-subtitle" data-measure-key="screen/subtitle">가입할 이메일을 입력해주세요</p>
    <label class="a5-email-field">
      <span>이메일 주소</span>
      <input type="email" inputmode="email" autocomplete="email" aria-label="이메일 주소" placeholder="이메일 주소" data-action="update-email" data-measure-key="field/email/bg">
      <img src="${ASSET_ROOT}/email.svg" alt="" aria-hidden="true" draggable="false">
    </label>
    <button class="a5-next" type="button" data-action="send-reset-email" data-measure-key="action/next" disabled aria-disabled="true">다음</button>
  `;
  enableWhenInputIsValid(
    screen,
    ".a5-email-field input",
    ".a5-next",
    (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
  return screen;
}

export function renderA6() {
  const screen = createScreen("a6", "579:848", "onboarding-a6");
  screen.innerHTML = `
    <button class="setup-back" type="button" data-action="go-back" data-measure-key="action/back" aria-label="뒤로 가기">
      <img src="/app-preview/assets/icons/back.svg" alt="" aria-hidden="true" draggable="false">
    </button>
    <img class="a6-halo" src="${ASSET_ROOT}/check-halo.svg" alt="" data-measure-key="complete hero / check halo" draggable="false">
    <div class="a6-badge" data-measure-key="codex generated / polished check badge" aria-hidden="true">
      <img src="${ASSET_ROOT}/check-badge.svg" alt="" draggable="false">
    </div>
    <h1 data-measure-key="screen/title">재설정 메일을 보냈어요</h1>
    <p class="a6-subtitle" data-measure-key="screen/subtitle">이메일을 확인하고 새 비밀번호를 만들어주세요</p>
    <button class="a6-return" type="button" data-action="return-to-login" data-measure-key="action/primary">로그인으로 돌아가기</button>
    <button class="a6-resend" type="button" data-action="resend-reset-email" data-measure-key="resend">메일을 못 받았어요</button>
  `;
  return screen;
}

export function renderA7() {
  const screen = createScreen("a7", "579:702", "onboarding-a7");
  screen.innerHTML = `
    <button class="setup-back" type="button" data-action="go-back" data-measure-key="action/back" aria-label="뒤로 가기">
      <img src="/app-preview/assets/icons/back.svg" alt="" aria-hidden="true" draggable="false">
    </button>
    <h1 data-measure-key="screen/title">새 비밀번호 설정</h1>
    <p class="a7-subtitle" data-measure-key="screen/subtitle">다시 로그인할 비밀번호를 입력해주세요</p>
    <label class="a7-field a7-field--password">
      <span>새 비밀번호</span>
      <input type="password" autocomplete="new-password" aria-label="새 비밀번호" value="Doripe12" data-action="update-new-password" data-measure-key="field/new-password/bg">
      <img src="${ASSET_ROOT}/lock.svg" alt="" aria-hidden="true" draggable="false">
    </label>
    <ul class="a7-rules" data-measure-key="field/password-rules/container" aria-label="안전한 암호 조건">
      <li data-password-rule="length" data-passed="true"><img src="${ASSET_ROOT}/check.svg" alt="" aria-hidden="true"><span>8자 이상</span></li>
      <li data-password-rule="letter" data-passed="true"><img src="${ASSET_ROOT}/check.svg" alt="" aria-hidden="true"><span>문자 포함</span></li>
      <li data-password-rule="number" data-passed="true"><img src="${ASSET_ROOT}/check.svg" alt="" aria-hidden="true"><span>숫자 포함</span></li>
    </ul>
    <label class="a7-field a7-field--confirmation">
      <span>비밀번호 확인</span>
      <input type="password" autocomplete="new-password" aria-label="비밀번호 확인" placeholder="비밀번호 확인" data-action="update-password-confirmation" data-measure-key="field/password-confirm/bg">
      <img src="${ASSET_ROOT}/lock.svg" alt="" aria-hidden="true" draggable="false">
    </label>
    <button class="a7-save" type="button" data-action="save-password" data-measure-key="action/save" disabled aria-disabled="true">저장하기</button>
  `;
  bindPasswordConfirmation(screen);
  return screen;
}

export function renderA8() {
  const password = storedFormValue("newPassword", "Doripe12");
  const confirmation = storedFormValue("passwordConfirmation", "Doripe13");
  const screen = createScreen("a8", "579:1063", "onboarding-a7 onboarding-a8");
  screen.innerHTML = `
    <button class="setup-back" type="button" data-action="go-back" data-measure-key="action/back" aria-label="뒤로 가기">
      <img src="/app-preview/assets/icons/back.svg" alt="" aria-hidden="true" draggable="false">
    </button>
    <h1 data-measure-key="screen/title">비밀번호를 다시 확인해 주세요</h1>
    <p class="a7-subtitle" data-measure-key="screen/subtitle">다시 로그인할 비밀번호를 입력해주세요</p>
    <label class="a7-field a7-field--password">
      <span>새 비밀번호</span>
      <input type="password" autocomplete="new-password" aria-label="새 비밀번호" data-action="update-new-password" data-measure-key="field/new-password/bg">
      <img src="${ASSET_ROOT}/lock.svg" alt="" aria-hidden="true" draggable="false">
    </label>
    <ul class="a7-rules" data-measure-key="field/password-rules/container" aria-label="안전한 암호 조건">
      <li data-password-rule="length" data-passed="true"><img src="${ASSET_ROOT}/check.svg" alt="" aria-hidden="true"><span>8자 이상</span></li>
      <li data-password-rule="letter" data-passed="true"><img src="${ASSET_ROOT}/check.svg" alt="" aria-hidden="true"><span>문자 포함</span></li>
      <li data-password-rule="number" data-passed="true"><img src="${ASSET_ROOT}/check.svg" alt="" aria-hidden="true"><span>숫자 포함</span></li>
    </ul>
    <label class="a7-field a7-field--confirmation">
      <span>비밀번호 확인</span>
      <input type="password" autocomplete="new-password" aria-label="비밀번호 확인" data-action="update-password-confirmation" data-measure-key="field/password-confirm/bg">
      <img src="${ASSET_ROOT}/lock.svg" alt="" aria-hidden="true" draggable="false">
    </label>
    <p class="a8-error" data-measure-key="state/helper-text">비밀번호가 일치하지 않아요.</p>
    <button class="a7-save" type="button" data-action="save-password" data-measure-key="action/save" disabled aria-disabled="true">저장하기</button>
  `;
  screen.querySelector('[data-action="update-new-password"]').value = password;
  screen.querySelector('[data-action="update-password-confirmation"]').value = confirmation;
  bindPasswordConfirmation(screen, { requireMatch: true });
  return screen;
}

export function renderA9() {
  const screen = createScreen("a9", "579:638", "onboarding-a9");
  screen.innerHTML = `
    <button class="setup-back" type="button" data-action="go-back" data-measure-key="action/back" aria-label="뒤로 가기">
      <img src="/app-preview/assets/icons/back.svg" alt="" aria-hidden="true" draggable="false">
    </button>
    <div class="intro-progress" aria-hidden="true">
      <span class="intro-progress__track" data-measure-key="ui/intro-progress/track"></span>
      <span class="intro-progress__fill" data-measure-key="ui/intro-progress/fill"></span>
    </div>
    <h1 data-measure-key="screen/title">이메일을 입력해주세요</h1>
    <label class="a9-email-field">
      <span>이메일</span>
      <input type="email" inputmode="email" autocomplete="email" aria-label="이메일" value="dori@doripe.kr" data-action="update-email" data-measure-key="field/email/bg" data-persist-default="true">
      <img class="a9-email-field__icon" src="${ASSET_ROOT}/email.svg" alt="" aria-hidden="true" draggable="false">
      <img class="a9-email-field__check-bg" src="${ASSET_ROOT}/validation-check-bg.svg" alt="" aria-hidden="true" draggable="false">
      <img class="a9-email-field__check" src="${ASSET_ROOT}/validation-check.svg" alt="" aria-hidden="true" draggable="false">
    </label>
    <button class="a9-next" type="button" data-action="continue-sign-up" data-measure-key="action/next" aria-disabled="false">다음</button>
  `;
  bindSignupEmail(screen, { requireFormat: false });
  return screen;
}

export function renderA10() {
  const screen = createScreen("a10", "579:1015", "onboarding-a9 onboarding-a10");
  screen.innerHTML = `
    <button class="setup-back" type="button" data-action="go-back" data-measure-key="action/back" aria-label="뒤로 가기">
      <img src="/app-preview/assets/icons/back.svg" alt="" aria-hidden="true" draggable="false">
    </button>
    <div class="intro-progress" aria-hidden="true">
      <span class="intro-progress__track" data-measure-key="ui/intro-progress/track"></span>
      <span class="intro-progress__fill" data-measure-key="ui/intro-progress/fill"></span>
    </div>
    <h1 data-measure-key="screen/title">이메일을 입력해 주세요</h1>
    <label class="a9-email-field">
      <span>이메일</span>
      <input type="email" inputmode="email" autocomplete="email" aria-label="이메일" data-action="update-email" data-measure-key="field/email/bg">
      <img class="a9-email-field__icon" src="${ASSET_ROOT}/email.svg" alt="" aria-hidden="true" draggable="false">
    </label>
    <p class="a10-error" data-measure-key="state/helper-text">올바른 이메일 형식이 아니에요.</p>
    <button class="a9-next" type="button" data-action="continue-sign-up" data-measure-key="action/next" disabled aria-disabled="true">다음</button>
  `;
  screen.querySelector('[data-action="update-email"]').value = storedFormValue("email", "doripe@");
  bindSignupEmail(screen);
  return screen;
}

export function renderA11() {
  const screen = createScreen("a11", "579:1039", "onboarding-a9 onboarding-a10 onboarding-a11");
  screen.innerHTML = `
    <button class="setup-back" type="button" data-action="go-back" data-measure-key="action/back" aria-label="뒤로 가기">
      <img src="/app-preview/assets/icons/back.svg" alt="" aria-hidden="true" draggable="false">
    </button>
    <div class="intro-progress" aria-hidden="true">
      <span class="intro-progress__track" data-measure-key="ui/intro-progress/track"></span>
      <span class="intro-progress__fill" data-measure-key="ui/intro-progress/fill"></span>
    </div>
    <h1 data-measure-key="screen/title">이미 가입된 이메일이에요</h1>
    <label class="a9-email-field">
      <span>이메일</span>
      <input type="email" inputmode="email" autocomplete="email" aria-label="이메일" data-action="update-email" data-measure-key="field/email/bg">
      <img class="a9-email-field__icon" src="${ASSET_ROOT}/email.svg" alt="" aria-hidden="true" draggable="false">
    </label>
    <p class="a10-error" data-measure-key="state/helper-text">로그인하거나 비밀번호를 재설정해 주세요.</p>
    <button class="a9-next" type="button" data-action="continue-sign-up" data-measure-key="action/next" disabled aria-disabled="true">다음</button>
  `;
  screen.querySelector('[data-action="update-email"]').value = storedFormValue("email", "doripe@example.com");
  bindAvailableEmail(screen);
  return screen;
}

export function renderA12() {
  const screen = createScreen("a12", "579:621", "onboarding-a12");
  screen.innerHTML = `
    <button class="setup-back" type="button" data-action="go-back" data-measure-key="action/back" aria-label="뒤로 가기">
      <img src="/app-preview/assets/icons/back.svg" alt="" aria-hidden="true" draggable="false">
    </button>
    <div class="intro-progress" aria-hidden="true">
      <span class="intro-progress__track" data-measure-key="ui/intro-progress/track"></span>
      <span class="intro-progress__fill" data-measure-key="ui/intro-progress/fill"></span>
    </div>
    <h1 data-measure-key="screen/title">비밀번호를 만들어주세요</h1>
    <p class="a12-subtitle" data-measure-key="screen/subtitle">안전한 계정 보호를 위해 비밀번호를 설정해주세요</p>
    <label class="a12-password-field">
      <span>비밀번호</span>
      <input type="password" autocomplete="new-password" aria-label="비밀번호" placeholder="비밀번호" data-action="update-password" data-measure-key="field/password/bg">
      <img src="${ASSET_ROOT}/lock.svg" alt="" aria-hidden="true" draggable="false">
    </label>
    <ul class="a12-success-rules" aria-label="안전한 암호 조건">
      <li class="a12-safe"><img src="${ASSET_ROOT}/check.svg" alt="" aria-hidden="true"><span>안전한 비밀번호입니다</span></li>
      <li data-password-rule="length"><img src="${ASSET_ROOT}/check.svg" alt="" aria-hidden="true"><span>8자 이상</span></li>
      <li data-password-rule="letter"><img src="${ASSET_ROOT}/check.svg" alt="" aria-hidden="true"><span>영문 포함</span></li>
      <li data-password-rule="number"><img src="${ASSET_ROOT}/check.svg" alt="" aria-hidden="true"><span>숫자 포함</span></li>
    </ul>
    <button class="a12-next" type="button" data-action="continue-sign-up" data-measure-key="action/next" disabled aria-disabled="true">다음</button>
  `;
  bindSignupPassword(screen);
  return screen;
}

export function renderA13() {
  const screen = createScreen("a13", "579:660", "onboarding-a12 onboarding-a13");
  screen.innerHTML = `
    <button class="setup-back" type="button" data-action="go-back" data-measure-key="action/back" aria-label="뒤로 가기">
      <img src="/app-preview/assets/icons/back.svg" alt="" aria-hidden="true" draggable="false">
    </button>
    <div class="intro-progress" aria-hidden="true">
      <span class="intro-progress__track" data-measure-key="ui/intro-progress/track"></span>
      <span class="intro-progress__fill" data-measure-key="ui/intro-progress/fill"></span>
    </div>
    <h1 data-measure-key="screen/title">비밀번호를 만들어주세요</h1>
    <p class="a12-subtitle" data-measure-key="screen/subtitle">안전한 비밀번호 조건을 보호하세요.</p>
    <label class="a12-password-field">
      <span>비밀번호</span>
      <input type="password" autocomplete="new-password" aria-label="비밀번호" value="Doripe1234" data-action="update-password" data-measure-key="field/password/bg" data-persist-default="true">
      <img src="${ASSET_ROOT}/lock.svg" alt="" aria-hidden="true" draggable="false">
    </label>
    <ul class="a12-success-rules" data-measure-key="field/password-rules/container" aria-label="안전한 암호 조건">
      <li class="a12-safe"><img src="${ASSET_ROOT}/check.svg" alt="" aria-hidden="true"><span>안전한 비밀번호입니다</span></li>
      <li data-password-rule="length"><img src="${ASSET_ROOT}/check.svg" alt="" aria-hidden="true"><span>8자 이상</span></li>
      <li data-password-rule="letter"><img src="${ASSET_ROOT}/check.svg" alt="" aria-hidden="true"><span>영문 포함</span></li>
      <li data-password-rule="number"><img src="${ASSET_ROOT}/check.svg" alt="" aria-hidden="true"><span>숫자 포함</span></li>
    </ul>
    <button class="a12-next" type="button" data-action="continue-sign-up" data-measure-key="action/next" aria-disabled="false">다음</button>
  `;
  bindSignupPassword(screen);
  return screen;
}

export function renderA14() {
  const screen = createScreen("a14", "579:763", "onboarding-a14");
  const yearOptions = Array.from({ length: 61 }, (_, index) => 2025 - index)
    .map((year) => `<option value="${year}"${year === 2000 ? " selected" : ""}>${year}</option>`)
    .join("");
  screen.innerHTML = `
    <button class="setup-back" type="button" data-action="go-back" data-measure-key="action/back" aria-label="뒤로 가기">
      <img src="/app-preview/assets/icons/back.svg" alt="" aria-hidden="true" draggable="false">
    </button>
    <div class="intro-progress" aria-hidden="true">
      <span class="intro-progress__track" data-measure-key="ui/intro-progress/track"></span>
      <span class="intro-progress__fill" data-measure-key="ui/intro-progress/fill"></span>
    </div>
    <h1 data-measure-key="screen/title">태어난 연도를 알려주세요</h1>
    <p class="a14-subtitle" data-measure-key="screen/subtitle">더 잘 맞는 장소를 추천하는 데 사용해요</p>
    <div class="a14-picker" aria-hidden="true">
      <span class="a14-picker__selected"></span>
      <span class="a14-picker__year" data-year-offset="-2">1998</span>
      <span class="a14-picker__year" data-year-offset="-1">1999</span>
      <strong class="a14-picker__year" data-year-offset="0">2000</strong>
      <span class="a14-picker__year" data-year-offset="1">2001</span>
      <span class="a14-picker__year" data-year-offset="2">2002</span>
    </div>
    <select class="a14-select" aria-label="출생연도" data-action="select-birth-year" data-measure-key="field/year-picker/container" data-persist-default="true">${yearOptions}</select>
    <button class="a14-next" type="button" data-action="continue-sign-up" data-measure-key="action/next">다음</button>
  `;
  const select = screen.querySelector(".a14-select");
  const storedYear = storedFormValue("birthYear", "2000");
  if ([...select.options].some((option) => option.value === storedYear)) select.value = storedYear;
  const sync = () => {
    const selectedYear = Number(select.value);
    for (const label of screen.querySelectorAll("[data-year-offset]")) {
      label.textContent = String(selectedYear + Number(label.dataset.yearOffset));
    }
  };
  select.addEventListener("change", sync);
  sync();
  return screen;
}

export function renderA15() {
  const screen = createScreen("a15", "579:951", "onboarding-a15");
  screen.innerHTML = `
    <button class="setup-back" type="button" data-action="go-back" data-measure-key="action/back" aria-label="뒤로 가기">
      <img src="/app-preview/assets/icons/back.svg" alt="" aria-hidden="true" draggable="false">
    </button>
    <div class="intro-progress" aria-hidden="true">
      <span class="intro-progress__track" data-measure-key="ui/intro-progress/track"></span>
      <span class="intro-progress__fill" data-measure-key="ui/intro-progress/fill"></span>
    </div>
    <h1 data-measure-key="screen/title">성별을 선택해주세요</h1>
    <p class="a15-subtitle" data-measure-key="screen/subtitle">추천 품질을 높이는 데만 사용돼요</p>
    <fieldset class="a15-options" aria-label="성별">
      <label class="a15-option a15-option--female" data-measure-key="gender">
        <input type="radio" name="gender" value="female" data-action="select-gender" data-measure-key="gender radio/여성" checked>
        <img class="a15-option__symbol" src="${ASSET_ROOT}/gender-female.svg" alt="" aria-hidden="true">
        <span>여성</span>
        <span class="a15-option__radio-visual" data-measure-key="gender radio" aria-hidden="true">
          <img class="a15-option__radio a15-option__radio--empty" src="${ASSET_ROOT}/radio-empty.svg" alt="">
          <img class="a15-option__radio a15-option__radio--selected" src="${ASSET_ROOT}/radio-selected.svg" alt="">
          <img class="a15-option__check" src="${ASSET_ROOT}/radio-check.svg" alt="">
        </span>
      </label>
      <label class="a15-option a15-option--male" data-measure-key="gender#2">
        <input type="radio" name="gender" value="male" data-action="select-gender" data-measure-key="gender radio/남성">
        <img class="a15-option__symbol" src="${ASSET_ROOT}/gender-male.svg" alt="" aria-hidden="true">
        <span>남성</span>
        <span class="a15-option__radio-visual" data-measure-key="gender radio#2" aria-hidden="true">
          <img class="a15-option__radio a15-option__radio--empty" src="${ASSET_ROOT}/radio-empty.svg" alt="">
          <img class="a15-option__radio a15-option__radio--selected" src="${ASSET_ROOT}/radio-selected.svg" alt="">
          <img class="a15-option__check" src="${ASSET_ROOT}/radio-check.svg" alt="">
        </span>
      </label>
      <label class="a15-option a15-option--unspecified" data-measure-key="gender#3">
        <input type="radio" name="gender" value="unspecified" data-action="select-gender" data-measure-key="gender radio/선택하지 않음">
        <img class="a15-option__symbol" src="${ASSET_ROOT}/gender-unspecified.svg" alt="" aria-hidden="true">
        <span>선택하지 않음</span>
        <span class="a15-option__radio-visual" data-measure-key="gender radio#3" aria-hidden="true">
          <img class="a15-option__radio a15-option__radio--empty" src="${ASSET_ROOT}/radio-empty.svg" alt="">
          <img class="a15-option__radio a15-option__radio--selected" src="${ASSET_ROOT}/radio-selected.svg" alt="">
          <img class="a15-option__check" src="${ASSET_ROOT}/radio-check.svg" alt="">
        </span>
      </label>
    </fieldset>
    <button class="a15-next" type="button" data-action="continue-sign-up" data-measure-key="action/next">다음</button>
  `;
  const storedGender = storedFormValue("gender", "female");
  const storedOption = [...screen.querySelectorAll('input[name="gender"]')]
    .find((option) => option.value === storedGender);
  if (storedOption) {
    storedOption.checked = true;
    storedOption.dataset.persistDefault = "true";
  }
  return screen;
}

export function renderA16() {
  const screen = createScreen("a16", "579:739", "onboarding-a16");
  screen.innerHTML = `
    <button class="setup-back" type="button" data-action="go-back" data-measure-key="action/back" aria-label="뒤로 가기">
      <img src="/app-preview/assets/icons/back.svg" alt="" aria-hidden="true" draggable="false">
    </button>
    <div class="intro-progress" aria-hidden="true">
      <span class="intro-progress__track" data-measure-key="ui/intro-progress/track"></span>
      <span class="intro-progress__fill" data-measure-key="ui/intro-progress/fill"></span>
    </div>
    <h1 data-measure-key="screen/title">어떻게 불러드릴까요?</h1>
    <p class="a16-subtitle" data-measure-key="screen/subtitle">Doripe에서 사용할 이름이에요</p>
    <label class="a16-nickname-field">
      <span>닉네임</span>
      <input type="text" autocomplete="nickname" maxlength="12" aria-label="닉네임" data-action="update-nickname" data-measure-key="field/nickname/bg" data-persist-default="true">
      <img class="a16-nickname-field__icon" src="${ASSET_ROOT}/user.svg" alt="" aria-hidden="true" draggable="false">
      <img class="a16-nickname-field__check-bg" src="${ASSET_ROOT}/validation-check-bg.svg" alt="" aria-hidden="true" draggable="false">
      <img class="a16-nickname-field__check" src="${ASSET_ROOT}/validation-check.svg" alt="" aria-hidden="true" draggable="false">
    </label>
    <p class="a16-note" data-measure-key="legal/privacy-note">나중에 설정에서 바꿀 수 있어요</p>
    <button class="a16-next" type="button" data-action="continue-sign-up" data-measure-key="action/next">다음</button>
  `;
  const input = screen.querySelector('[data-action="update-nickname"]');
  const next = screen.querySelector('[data-action="continue-sign-up"]');
  input.value = storedFormValue("nickname", "dori");
  const sync = () => {
    const valid = input.value.trim().length >= 2;
    screen.dataset.nicknameValid = String(valid);
    next.disabled = !valid;
    next.setAttribute("aria-disabled", String(next.disabled));
  };
  input.addEventListener("input", sync);
  sync();
  return screen;
}

export function renderA17() {
  const screen = createScreen("a17", "579:1102", "onboarding-a16 onboarding-a17");
  screen.innerHTML = `
    <button class="setup-back" type="button" data-action="go-back" data-measure-key="action/back" aria-label="뒤로 가기">
      <img src="/app-preview/assets/icons/back.svg" alt="" aria-hidden="true" draggable="false">
    </button>
    <div class="intro-progress" aria-hidden="true">
      <span class="intro-progress__track" data-measure-key="ui/intro-progress/track"></span>
      <span class="intro-progress__fill" data-measure-key="ui/intro-progress/fill"></span>
    </div>
    <h1 data-measure-key="screen/title">닉네임을 입력해 주세요</h1>
    <p class="a16-subtitle" data-measure-key="screen/subtitle">Doripe에서 사용할 이름이에요</p>
    <label class="a16-nickname-field">
      <span>닉네임</span>
      <input type="text" autocomplete="nickname" maxlength="12" aria-label="닉네임" data-action="update-nickname" data-measure-key="field/nickname/bg">
      <img class="a16-nickname-field__icon" src="${ASSET_ROOT}/user.svg" alt="" aria-hidden="true" draggable="false">
    </label>
    <p class="a16-note" data-measure-key="legal/privacy-note">이미 사용 중인 닉네임이에요.</p>
    <button class="a16-next" type="button" data-action="continue-sign-up" data-measure-key="action/next" disabled aria-disabled="true">다음</button>
  `;
  const input = screen.querySelector('[data-action="update-nickname"]');
  const next = screen.querySelector('[data-action="continue-sign-up"]');
  input.value = storedFormValue("nickname", "도리");
  const sync = () => {
    const value = input.value.trim();
    const valid = value.length >= 2 && value !== "도리";
    screen.dataset.nicknameValid = String(valid);
    next.disabled = !valid;
    next.setAttribute("aria-disabled", String(next.disabled));
  };
  input.addEventListener("input", sync);
  sync();
  return screen;
}

export function renderA18() {
  const screen = createScreen("a18", "579:781", "onboarding-a18");
  const selectedValue = storedFormValue("habit", "instagram-saved");
  const options = [
    ["instagram-saved", "인스타 저장", "source-instagram.svg", "slot/option-card/bg"],
    ["naver-map-saved", "네이버 지도<br>저장", "source-map.svg", "slot/option-card/bg#2"],
    ["blog-search", "블로그 검색", "source-search.svg", "slot/option-card/bg#3"],
    ["friend-recommendation", "지인 추천", "source-friend.svg", "slot/option-card/bg#4"],
    ["search-as-needed", "그때그때<br>검색", "source-search.svg", "slot/option-card/bg#5"],
    ["good-fit", "잘 맞는 편", "source-sparkle.svg", "slot/option-card/bg#6"]
  ];
  screen.innerHTML = `
    <button class="setup-back" type="button" data-action="go-back" data-measure-key="action/back" aria-label="뒤로 가기">
      <img src="/app-preview/assets/icons/back.svg" alt="" aria-hidden="true" draggable="false">
    </button>
    <div class="intro-progress" aria-hidden="true">
      <span class="intro-progress__track" data-measure-key="ui/intro-progress/track"></span>
      <span class="intro-progress__fill" data-measure-key="ui/intro-progress/fill"></span>
    </div>
    <h1 data-measure-key="screen/title">평소 장소를<br>어떻게 찾나요?</h1>
    <p class="a18-subtitle" data-measure-key="screen/subtitle">나에게 맞는 탐색 경험을 준비해드려요</p>
    <div class="a18-options" role="group" aria-label="장소 탐색 습관">
      ${options.map(([value, label, icon, measureKey], index) => `
        <button class="a18-option a18-option--${index + 1}" type="button" value="${value}" data-action="select-place-source" data-measure-key="${measureKey}" aria-pressed="${value === selectedValue ? "true" : "false"}"${value === selectedValue ? " data-persist-default=\"true\"" : ""}>
          <img src="${ASSET_ROOT}/${icon}" alt="" aria-hidden="true" draggable="false">
          <span>${label}</span>
        </button>
      `).join("")}
    </div>
    <button class="a18-location" type="button" data-action="choose-location" data-measure-key="action/choose-location">위치 고르기</button>
    <button class="a18-skip" type="button" data-action="skip-question" data-measure-key="action/skip">모르겠어요</button>
  `;
  screen.querySelector(".a18-options").addEventListener("click", (event) => {
    const selected = event.target.closest('[data-action="select-place-source"]');
    if (!selected) return;
    for (const option of screen.querySelectorAll('[data-action="select-place-source"]')) {
      option.setAttribute("aria-pressed", String(option === selected));
    }
  });
  return screen;
}

export function renderA19() {
  const screen = createScreen("a19", "579:863", "onboarding-a19");
  const selectedValue = storedFormValue("source", "instagram");
  const options = [
    ["friend", "지인 추천", "source-friend.svg", "slot/option-card/bg"],
    ["instagram", "인스타그램", "referral-instagram.svg", "slot/option-card/bg#2"],
    ["tiktok-shorts", "틱톡/쇼츠", "referral-tiktok.svg", "slot/option-card/bg#3"],
    ["blog-search", "블로그/검색", "referral-search.svg", "slot/option-card/bg#4"],
    ["community-cafe", "커뮤니티/카페", "referral-community.svg", "slot/option-card/bg#5"],
    ["creator", "크리에이터", "referral-creator.svg", "slot/option-card/bg#6"],
    ["web-store", "웹스토어", "referral-store.svg", "slot/option-card/bg#7"],
    ["other", "기타", "referral-other.svg", "slot/option-card/bg#8"]
  ];
  screen.innerHTML = `
    <button class="setup-back" type="button" data-action="go-back" data-measure-key="action/back" aria-label="뒤로 가기">
      <img src="/app-preview/assets/icons/back.svg" alt="" aria-hidden="true" draggable="false">
    </button>
    <div class="intro-progress" aria-hidden="true">
      <span class="intro-progress__track" data-measure-key="ui/intro-progress/track"></span>
      <span class="intro-progress__fill" data-measure-key="ui/intro-progress/fill"></span>
    </div>
    <h1 data-measure-key="screen/title">Doripe를<br>어디서 알게 됐나요?</h1>
    <p class="a19-subtitle" data-measure-key="screen/subtitle">알려주시면 더 나은 서비스를 만들 수 있어요</p>
    <div class="a19-options" role="group" aria-label="Doripe를 알게 된 경로">
      ${options.map(([value, label, icon, measureKey], index) => `
        <button class="a19-option a19-option--${index + 1}" type="button" value="${value}" data-action="select-referral-source" data-measure-key="${measureKey}" aria-pressed="${value === selectedValue ? "true" : "false"}"${value === selectedValue ? " data-persist-default=\"true\"" : ""}>
          <img src="${ASSET_ROOT}/${icon}" alt="" aria-hidden="true" draggable="false">
          <span>${label}</span>
        </button>
      `).join("")}
    </div>
    <button class="a19-next" type="button" data-action="continue-sign-up" data-measure-key="action/next">다음</button>
    <button class="a19-skip" type="button" data-action="skip-question" data-measure-key="action/skip">모르겠어요</button>
  `;
  screen.querySelector(".a19-options").addEventListener("click", (event) => {
    const selected = event.target.closest('[data-action="select-referral-source"]');
    if (!selected) return;
    for (const option of screen.querySelectorAll('[data-action="select-referral-source"]')) {
      option.setAttribute("aria-pressed", String(option === selected));
    }
  });
  return screen;
}

export function renderA20() {
  const screen = createScreen("a20", "579:1127", "onboarding-a20");
  const selectedValue = storedFormValue("neighborhoodId", "seongsu");
  screen.innerHTML = `
    <div class="a20-map" data-measure-key="misty map bg" aria-hidden="true"></div>
    <button class="setup-back" type="button" data-action="go-back" data-measure-key="action/back" aria-label="뒤로 가기">
      <img src="/app-preview/assets/icons/back.svg" alt="" aria-hidden="true" draggable="false">
    </button>
    <div class="intro-progress" aria-hidden="true">
      <span class="intro-progress__track" data-measure-key="ui/intro-progress/track"></span>
      <span class="intro-progress__fill" data-measure-key="ui/intro-progress/fill"></span>
    </div>
    <h1 data-measure-key="screen/title">동네를 선택해 주세요</h1>
    <p class="a20-subtitle" data-measure-key="screen/subtitle">처음 둘러볼 동네를 골라주세요.</p>
    <div class="a20-neighborhoods" role="group" aria-label="동네 선택">
      ${NEIGHBORHOODS.map(([value, label, measureKey], index) => `
        <button class="a20-region a20-region--${index + 1}" type="button" value="${value}" data-action="select-neighborhood" data-measure-key="${measureKey}" aria-pressed="${value === selectedValue ? "true" : "false"}"${value === selectedValue ? " data-persist-default=\"true\"" : ""}>
          <img src="${ASSET_ROOT}/neighborhood-pin.svg" alt="" aria-hidden="true" draggable="false">
          <span>${label}</span>
        </button>
      `).join("")}
    </div>
    <div class="a20-summary" data-measure-key="bottom hover">
      <strong class="a20-summary__title" data-measure-key="bottom title">성수에서 시작할게요</strong>
      <span class="a20-summary__subtitle" data-measure-key="bottom sub">선택한 동네의 장소를 보여드릴게요</span>
    </div>
    <button class="a20-start" type="button" data-action="confirm-neighborhood" data-measure-key="action/primary">시작</button>
  `;
  const title = screen.querySelector(".a20-summary__title");
  const initialSelection = screen.querySelector('[data-action="select-neighborhood"][aria-pressed="true"]');
  if (initialSelection) title.textContent = `${initialSelection.textContent.trim()}에서 시작할게요`;
  screen.querySelector(".a20-neighborhoods").addEventListener("click", (event) => {
    const selected = event.target.closest('[data-action="select-neighborhood"]');
    if (!selected) return;
    for (const option of screen.querySelectorAll('[data-action="select-neighborhood"]')) {
      option.setAttribute("aria-pressed", String(option === selected));
    }
    title.textContent = `${selected.textContent.trim()}에서 시작할게요`;
  });
  return screen;
}

export function renderA21() {
  const screen = createScreen("a21", "579:1173", "onboarding-a21");
  const neighborhoodLabel = directionLabel(loadingNeighborhoodLabel("a21"));
  screen.innerHTML = `
    <img class="a21-map-plane" src="${ASSET_ROOT}/a21-map-plane.png" alt="" aria-hidden="true" draggable="false">
    <div class="a21-status" data-measure-key="COMPONENT / floating glass travel status">
      <img class="a21-status__icon-bg" src="${ASSET_ROOT}/travel-icon-bg.svg" alt="" data-measure-key="travel status / icon background" aria-hidden="true" draggable="false">
      <img class="a21-status__plane" src="${ASSET_ROOT}/travel-plane.svg" alt="" data-measure-key="ICON / Send Plane" aria-hidden="true" draggable="false">
      <h1 data-measure-key="Text / TravelTransition / Destination">${neighborhoodLabel} 가는 중</h1>
      <p data-measure-key="Text / travel subtitle">잠깐만요, 장소카드를 준비하고 있어요</p>
    </div>
    <div class="a21-dots" role="progressbar" aria-label="장소 카드 준비 중" aria-valuemin="0" aria-valuemax="100" aria-valuenow="55" data-measure-key="COMPONENT / loading dots">
      <span class="a21-dot a21-dot--1" data-measure-key="Loading / dot 1"></span>
      <span class="a21-dot a21-dot--2" data-measure-key="Loading / dot 2"></span>
      <span class="a21-dot a21-dot--3" data-measure-key="Loading / dot 3"></span>
    </div>
  `;
  replaceScreenAfter(screen, "a22", 700);
  return screen;
}

export function renderA22() {
  const screen = createScreen("a22", "579:1162", "onboarding-a22");
  const neighborhoodLabel = directionLabel(loadingNeighborhoodLabel("a22"));
  screen.innerHTML = `
    <div class="a22-loading__track" data-measure-key="ui/loading/track" aria-hidden="true"></div>
    <div class="a22-loading__fill" role="progressbar" aria-label="취향 장소 준비 중" aria-valuemin="0" aria-valuemax="100" aria-valuenow="32" data-measure-key="ui/loading/fill"></div>
    <img class="a22-mark" src="${ASSET_ROOT}/a22-mark.png" alt="" data-measure-key="Header-/-brand/logo/image" aria-hidden="true" draggable="false">
    <h1 data-measure-key="screen/title">${neighborhoodLabel} 이동 중</h1>
    <p data-measure-key="screen/subtitle">취향에 맞는 장소를 준비하고 있어요.</p>
  `;
  startLoadingProgress(screen, { fillSelector: ".a22-loading__fill", destination: "b1" });
  return screen;
}

export const ONBOARDING_RENDERERS = Object.freeze({
  a1: renderA1,
  "a1-splash": renderA1Splash,
  a3: renderA3,
  a4: renderA4,
  a5: renderA5,
  a6: renderA6,
  a7: renderA7,
  a8: renderA8,
  a9: renderA9,
  a10: renderA10,
  a11: renderA11,
  a12: renderA12,
  a13: renderA13,
  a14: renderA14,
  a15: renderA15,
  a16: renderA16,
  a17: renderA17,
  a18: renderA18,
  a19: renderA19,
  a20: renderA20,
  a21: renderA21,
  a22: renderA22
});
