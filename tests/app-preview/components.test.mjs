import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import measurements from "../../public/app-preview/figma/screen-measurements.json" with { type: "json" };
import {
  avatar,
  backButton,
  bottomNav,
  chip,
  confirmDialog,
  icon,
  primaryButton,
  sheetHandle,
  toast
} from "../../public/app-preview/components.js";

const rootUrl = new URL("../../public/app-preview/", import.meta.url);

function assertLocalSvgMarkup(markup) {
  assert.match(markup, /src="\/app-preview\/assets\/icons\/[a-z0-9-]+\.svg"/);
  assert.doesNotMatch(markup, /<svg\b|<path\b/i);
  assert.doesNotMatch(markup, /(?:src|href)="https?:\/\//i);
}

test("component module exports the complete shared interface", () => {
  for (const component of [
    icon,
    primaryButton,
    backButton,
    bottomNav,
    chip,
    avatar,
    sheetHandle,
    toast,
    confirmDialog
  ]) {
    assert.equal(typeof component, "function");
  }
});

test("icon uses a known local SVG asset and never emits inline paths", () => {
  const informative = icon("share", { label: '공유 <새 창> & "링크"', size: 22 });
  assertLocalSvgMarkup(informative);
  assert.match(informative, /alt="공유 &lt;새 창&gt; &amp; &quot;링크&quot;"/);
  assert.match(informative, /--preview-icon-size: 22px/);

  const decorative = icon("heart", { decorative: true, size: 24 });
  assert.match(decorative, /alt=""/);
  assert.match(decorative, /aria-hidden="true"/);
  assert.throws(() => icon("not-an-export", { decorative: true }), /Unknown icon/);
});

test("all icon assets are local exported SVG files without remote references", async () => {
  const iconsUrl = new URL("assets/icons/", rootUrl);
  const files = await readdir(iconsUrl);
  assert.ok(files.length > 0);
  assert.ok(files.every((file) => file.endsWith(".svg")));

  for (const file of files) {
    const source = await readFile(new URL(file, iconsUrl), "utf8");
    assert.match(source, /^<svg\b/);
    assert.doesNotMatch(source, /(?:src|href)=["']https?:\/\/|url\(https?:\/\//i);
  }
});

test("primary button is semantic, actionable, disabled, and escaped", () => {
  const markup = primaryButton({
    label: "다음 <script>alert(1)</script>",
    action: "onboarding-next",
    disabled: true
  });

  assert.match(markup, /^<button\b/);
  assert.match(markup, /type="button"/);
  assert.match(markup, /data-action="onboarding-next"/);
  assert.match(markup, / disabled/);
  assert.match(markup, /aria-disabled="true"/);
  assert.match(markup, /다음 &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(markup, /<script>/);
});

test("back button is an icon-only control with an accessible name and local icon", () => {
  const markup = backButton({ action: "go-back", label: "이전 화면" });
  assert.match(markup, /^<button\b/);
  assert.match(markup, /data-action="go-back"/);
  assert.match(markup, /aria-label="이전 화면"/);
  assertLocalSvgMarkup(markup);
  assert.doesNotMatch(markup, />\s*이전 화면\s*</);
});

test("bottom nav exposes selected state and labels every icon-only action", () => {
  const markup = bottomNav({
    label: "주요 메뉴",
    items: [
      { label: "발견", icon: "info", action: "open-discover" },
      { label: "저장", icon: "heart", action: "open-saved", selected: true },
      { label: "경로", icon: "map-pin", action: "open-route" },
      { label: "설정", icon: "share", action: "open-settings" }
    ]
  });

  assert.match(markup, /^<nav\b/);
  assert.match(markup, /aria-label="주요 메뉴"/);
  assert.equal((markup.match(/<button\b/g) || []).length, 4);
  assert.equal((markup.match(/data-action="open-/g) || []).length, 4);
  assert.equal((markup.match(/aria-label="(?:발견|저장|경로|설정)"/g) || []).length, 4);
  assert.match(markup, /data-action="open-saved"[^>]*aria-current="page"[^>]*aria-pressed="true"/);
  assertLocalSvgMarkup(markup);
});

test("chip uses button semantics for actions and exposes selected state", () => {
  const markup = chip({ label: "데이트", action: "toggle-date", selected: true });
  assert.match(markup, /^<button\b/);
  assert.match(markup, /data-action="toggle-date"/);
  assert.match(markup, /aria-pressed="true"/);
  assert.match(markup, />데이트<\/button>$/);

  const staticMarkup = chip({ label: "조용함" });
  assert.match(staticMarkup, /^<span\b/);
  assert.doesNotMatch(staticMarkup, /data-action=/);
});

test("avatar escapes content and labels its optional image-only action", () => {
  const markup = avatar({
    src: "/app-preview/assets/references/e1.png",
    alt: "도리 <프로필>",
    action: "open-profile",
    label: "도리 프로필 열기"
  });

  assert.match(markup, /^<button\b/);
  assert.match(markup, /data-action="open-profile"/);
  assert.match(markup, /aria-label="도리 프로필 열기"/);
  assert.match(markup, /src="\/app-preview\/assets\/references\/e1\.png"/);
  assert.match(markup, /alt="도리 &lt;프로필&gt;"/);
});

test("sheet handle, toast, and confirm dialog use semantic escaped markup", () => {
  assert.match(sheetHandle(), /^<span\b[^>]*aria-hidden="true"/);

  const toastMarkup = toast({ message: "저장 <완료>", kind: "success" });
  assert.match(toastMarkup, /^<output\b/);
  assert.match(toastMarkup, /role="status"/);
  assert.match(toastMarkup, /aria-live="polite"/);
  assert.match(toastMarkup, /data-kind="success"/);
  assert.match(toastMarkup, /저장 &lt;완료&gt;/);

  const dialogMarkup = confirmDialog({
    id: "delete-photo",
    title: "사진 삭제",
    message: "정말 <삭제>할까요?",
    confirmLabel: "삭제",
    confirmAction: "confirm-delete",
    cancelLabel: "취소",
    cancelAction: "cancel-delete",
    destructive: true
  });
  assert.match(dialogMarkup, /^<section\b/);
  assert.match(dialogMarkup, /role="alertdialog"/);
  assert.match(dialogMarkup, /aria-modal="true"/);
  assert.match(dialogMarkup, /aria-labelledby="delete-photo-title"/);
  assert.match(dialogMarkup, /aria-describedby="delete-photo-message"/);
  assert.match(dialogMarkup, /data-action="confirm-delete"/);
  assert.match(dialogMarkup, /data-action="cancel-delete"/);
  assert.match(dialogMarkup, /정말 &lt;삭제&gt;할까요\?/);
  assert.match(dialogMarkup, /preview-confirm-dialog__confirm--destructive/);
});

test("shared geometry is backed by identical measurements in multiple final screens", () => {
  for (const screenId of ["a5", "a9", "a10", "a11", "a12", "a13", "a14", "a15", "a16", "a17", "a19"]) {
    assert.deepEqual(measurements[screenId].elements["action/next/bg"], {
      x: 36,
      y: 735,
      width: 321,
      height: 50
    });
  }

  for (const screenId of ["a5", "a10", "e1", "e6"]) {
    assert.deepEqual(
      {
        width: measurements[screenId].elements["action/back/bg"].width,
        height: measurements[screenId].elements["action/back/bg"].height
      },
      { width: 32, height: 32 }
    );
  }

  for (const screenId of ["d4", "d5", "d6"]) {
    assert.deepEqual(measurements[screenId].elements["Bottom nav / glass bg"], {
      x: 72,
      y: 792,
      width: 249,
      height: 54
    });
  }

  for (const screenId of ["c1", "c2", "c6"]) {
    assert.equal(measurements[screenId].elements.handle.width, 55);
    assert.equal(measurements[screenId].elements.handle.height, 5);
  }

  for (const screenId of ["b4", "b5", "b10"]) {
    assert.equal(measurements[screenId].elements["Hero / author avatar"].width, 24);
    assert.equal(measurements[screenId].elements["Hero / author avatar"].height, 24);
  }

  for (const screenId of ["d2", "d3"]) {
    assert.equal(measurements[screenId].elements["Chip/bg#3"].width, 80.06);
    assert.equal(measurements[screenId].elements["Chip/bg#3"].height, 30);
  }
});

test("token and component CSS preserve evidence geometry and accessibility constraints", async () => {
  const [tokens, components, index] = await Promise.all([
    readFile(new URL("styles/tokens.css", rootUrl), "utf8"),
    readFile(new URL("styles/components.css", rootUrl), "utf8"),
    readFile(new URL("index.html", rootUrl), "utf8")
  ]);

  for (const token of [
    "--color-primary",
    "--font-family-pretendard",
    "--space-screen-inline",
    "--radius-control",
    "--shadow-floating",
    "--duration-toast",
    "--z-content",
    "--z-overlay"
  ]) {
    assert.match(tokens, new RegExp(`${token}:`));
  }
  assert.match(tokens, /@font-face[\s\S]*\/app-preview\/assets\/fonts\/PretendardVariable\.woff2/);

  assert.match(components, /\.preview-primary-button\s*\{[^}]*width:\s*321px;[^}]*height:\s*50px;/s);
  assert.match(components, /\.preview-back-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s);
  assert.match(components, /\.preview-back-button__visible\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;/s);
  assert.match(components, /\.preview-bottom-nav\s*\{[^}]*width:\s*249px;[^}]*height:\s*54px;/s);
  assert.match(components, /\.preview-bottom-nav__item\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s);
  assert.match(components, /\.preview-avatar-action\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s);
  assert.match(components, /\.preview-sheet-handle\s*\{[^}]*width:\s*55px;[^}]*height:\s*5px;/s);
  const chipRules = components.match(/\.preview-chip\s*\{([^}]*)\}/s)?.[1] || "";
  assert.doesNotMatch(chipRules, /min-width:/, "text chips must retain their measured visible width");
  assert.match(components, /@media\s*\(max-width:\s*700px\)[\s\S]*#phone-root\[data-preview-mode="prototype"\][\s\S]*padding-top:\s*env\(safe-area-inset-top\)[\s\S]*padding-bottom:\s*env\(safe-area-inset-bottom\)/);
  assert.match(components, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);

  const tokenIndex = index.indexOf("/app-preview/styles/tokens.css");
  const shellIndex = index.indexOf("/app-preview/styles/shell.css");
  const componentIndex = index.indexOf("/app-preview/styles/components.css");
  assert.ok(tokenIndex >= 0 && tokenIndex < shellIndex && shellIndex < componentIndex);
});
