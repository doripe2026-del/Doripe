import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { DOMParser } from "@xmldom/xmldom";

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

function parseSafeSvg(source, name = "SVG") {
  const parseErrors = [];
  const document = new DOMParser({
    errorHandler: {
      warning: (message) => parseErrors.push(message),
      error: (message) => parseErrors.push(message),
      fatalError: (message) => parseErrors.push(message)
    }
  }).parseFromString(source, "image/svg+xml");

  assert.deepEqual(parseErrors, [], `${name} must be well-formed XML`);
  assert.equal(document.documentElement?.localName, "svg", `${name} must have one SVG root`);
  assert.equal(document.doctype, null, `${name} must not contain a doctype`);

  const visit = (node) => {
    if (node.nodeType === 7 || node.nodeType === 10) {
      assert.fail(`${name} contains a forbidden XML instruction`);
    }

    if (node.nodeType === 1) {
      const elementName = node.localName.toLowerCase();
      assert.ok(!["foreignobject", "script", "style"].includes(elementName), `${name} contains <${node.localName}>`);

      for (let index = 0; index < node.attributes.length; index += 1) {
        const attribute = node.attributes.item(index);
        const attributeName = attribute.name.toLowerCase();
        const value = attribute.value.trim();
        const compactValue = value.replace(/[\u0000-\u0020]+/g, "").toLowerCase();

        assert.doesNotMatch(attributeName, /^on/i, `${name} contains event handler ${attribute.name}`);
        if (attributeName === "xmlns" || attributeName.startsWith("xmlns:")) continue;

        assert.doesNotMatch(compactValue, /(?:javascript|data):|^(?:https?:)?\/\//i, `${name} contains an unsafe reference`);

        if (["href", "xlink:href", "src"].includes(attributeName) && value !== "") {
          assert.match(value, /^#[A-Za-z_][\w:.-]*$/, `${name} contains a non-local reference`);
        }

        for (const match of value.matchAll(/url\(([^)]+)\)/gi)) {
          const target = match[1].trim().replace(/^['"]|['"]$/g, "");
          assert.match(target, /^#[A-Za-z_][\w:.-]*$/, `${name} contains an external url()`);
        }
      }
    }

    for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
  };

  visit(document);
  return document;
}

function cssRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "s"))?.[1] || "";
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

test("all icon assets pass a parsed XML safety gate", async () => {
  const iconsUrl = new URL("assets/icons/", rootUrl);
  const files = await readdir(iconsUrl);
  assert.ok(files.length > 0);
  assert.ok(files.every((file) => file.endsWith(".svg")));

  for (const file of files) {
    const source = await readFile(new URL(file, iconsUrl), "utf8");
    parseSafeSvg(source, file);
  }
});

test("parsed SVG safety gate rejects active content and external references", () => {
  const attacks = [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><use href="javascript:alert(1)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,AA=="/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><use href="//evil.example/icon.svg#x"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.example/icon.svg#x"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path style="fill:url(//evil.example/x.svg)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://evil.example/x.css)</style></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><use href="&#x6a;avascript:alert(1)"/></svg>',
    '<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"/>'
  ];

  for (const [index, attack] of attacks.entries()) {
    assert.throws(() => parseSafeSvg(attack, `attack-${index + 1}`), undefined, attack);
  }
});

test("back icon is the exact measured Figma export", async () => {
  const source = await readFile(new URL("assets/icons/back.svg", rootUrl), "utf8");
  const document = parseSafeSvg(source, "back.svg");
  const svg = document.documentElement;
  const path = document.getElementsByTagName("path").item(0);
  const iconBox = measurements.a5.elements["icon/back"];
  const vectorBox = measurements.a5.elements.Vector;

  assert.equal(svg.getAttribute("width"), String(iconBox.width));
  assert.equal(svg.getAttribute("height"), String(iconBox.height));
  assert.equal(svg.getAttribute("viewBox"), `0 0 ${iconBox.width} ${iconBox.height}`);
  assert.equal(path.getAttribute("d"), "M16.25 19.5L9.75 13L16.25 6.5");

  const points = [...path.getAttribute("d").matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
    .map((match) => [Number(match[1]), Number(match[2])]);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  assert.deepEqual({
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  }, {
    x: vectorBox.x - iconBox.x,
    y: vectorBox.y - iconBox.y,
    width: vectorBox.width,
    height: vectorBox.height
  });
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
  assert.match(markup, /src="\/app-preview\/assets\/icons\/back\.svg"/);
  assert.doesNotMatch(markup, /chevron-down|rotate/i);
  assert.doesNotMatch(markup, />\s*이전 화면\s*</);
});

test("bottom nav exposes selected state and labels every icon-only action", () => {
  const markup = bottomNav({
    label: "주요 메뉴",
    items: [
      { label: "발견", icon: "info", action: "open-discover" },
      { label: "저장", icon: "heart", action: "open-saved" },
      { label: "경로", icon: "map-pin", action: "open-route", selected: true },
      { label: "설정", icon: "share", action: "open-settings" }
    ]
  });

  assert.match(markup, /^<nav\b/);
  assert.match(markup, /aria-label="주요 메뉴"/);
  assert.equal((markup.match(/<button\b/g) || []).length, 4);
  assert.equal((markup.match(/data-action="open-/g) || []).length, 4);
  assert.equal((markup.match(/aria-label="(?:발견|저장|경로|설정)"/g) || []).length, 4);
  assert.match(markup, /data-action="open-route"[^>]*aria-current="page"[^>]*aria-pressed="true"/);
  assertLocalSvgMarkup(markup);

  assert.throws(() => bottomNav({
    items: [
      { label: "발견", icon: "info", action: "open-discover", selected: true },
      { label: "저장", icon: "heart", action: "open-saved" },
      { label: "경로", icon: "map-pin", action: "open-route" },
      { label: "설정", icon: "share", action: "open-settings" }
    ]
  }), /third measured navigation item/);
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

test("avatar accepts only normalized files strictly below app-preview assets", () => {
  const unsafeSources = [
    "https://evil.example/app-preview/assets/avatar.png",
    "//evil.example/app-preview/assets/avatar.png",
    "/app-preview/assets/../main.js",
    "/app-preview/assets/%2e%2e/main.js",
    "/app-preview/assets/references/%252e%252e/main.js",
    "/app-preview/assets/references/e1.png?next=/app-preview/assets/x",
    "/app-preview/assets/references/e1.png%3Fnext=evil",
    "/app-preview/assets/references/e1.png#fragment",
    "/app-preview/assets/references\\e1.png",
    "/app-preview/assets/references/%00.svg"
  ];

  for (const src of unsafeSources) {
    assert.throws(() => avatar({ src, alt: "프로필" }), /local app-preview asset/, src);
  }

  assert.match(
    avatar({ src: "/app-preview/assets/references/e1.png", alt: "프로필" }),
    /src="\/app-preview\/assets\/references\/e1\.png"/
  );
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
    const elements = measurements[screenId].elements;
    const nav = elements["Bottom nav / glass bg"];
    assert.deepEqual(nav, {
      x: 72,
      y: 792,
      width: 249,
      height: 54
    });
    assert.deepEqual([
      elements["Icon / nav discover"],
      elements["Icon / nav saved"],
      elements["Icon / nav route active"],
      elements["Icon / nav settings"]
    ].map((box) => ({
      x: box.x - nav.x,
      y: box.y - nav.y,
      width: box.width,
      height: box.height
    })), [
      { x: 29, y: 15, width: 26, height: 26 },
      { x: 88, y: 15, width: 26, height: 26 },
      { x: 147, y: 8, width: 26, height: 26 },
      { x: 206, y: 15, width: 26, height: 26 }
    ]);
    assert.deepEqual({
      x: elements["Nav / active route bg"].x - nav.x,
      y: elements["Nav / active route bg"].y - nav.y,
      width: elements["Nav / active route bg"].width,
      height: elements["Nav / active route bg"].height
    }, { x: 131, y: -8, width: 58, height: 58 });
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
    "--radius-sheet-handle",
    "--shadow-floating"
  ]) {
    assert.match(tokens, new RegExp(`${token}:`));
  }
  assert.doesNotMatch(tokens, /--duration-|--z-/);
  assert.match(tokens, /@font-face[\s\S]*\/app-preview\/assets\/fonts\/PretendardVariable\.woff2/);

  assert.match(components, /\.preview-primary-button\s*\{[^}]*width:\s*321px;[^}]*height:\s*50px;/s);
  assert.match(components, /\.preview-back-button\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;/s);
  assert.match(components, /\.preview-back-button__visible\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;/s);
  assert.match(components, /\.preview-bottom-nav\s*\{[^}]*width:\s*249px;[^}]*height:\s*54px;/s);
  assert.doesNotMatch(components, /grid-template-columns:\s*repeat\(4,\s*1fr\)/);
  assert.match(cssRule(components, ".preview-bottom-nav__item"), /position:\s*absolute;[\s\S]*width:\s*26px;[\s\S]*height:\s*26px;/);
  for (const [index, expected] of [
    [1, { left: 29, top: 15 }],
    [2, { left: 88, top: 15 }],
    [3, { left: 147, top: 8 }],
    [4, { left: 206, top: 15 }]
  ]) {
    const rules = cssRule(components, `.preview-bottom-nav__item:nth-child(${index})`);
    assert.match(rules, new RegExp(`left:\\s*${expected.left}px;`));
    assert.match(rules, new RegExp(`top:\\s*${expected.top}px;`));
  }
  const selectedNavRules = cssRule(components, ".preview-bottom-nav__item:nth-child(3).preview-bottom-nav__item--selected");
  assert.match(selectedNavRules, /left:\s*131px;[\s\S]*top:\s*-8px;[\s\S]*width:\s*58px;[\s\S]*height:\s*58px;[\s\S]*border-radius:\s*var\(--radius-bottom-nav-active\);/);

  assert.match(cssRule(components, ".preview-back-button::before"), /position:\s*absolute;[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;[\s\S]*left:\s*50%;[\s\S]*top:\s*50%;/);
  assert.match(cssRule(components, ".preview-bottom-nav__item::before"), /position:\s*absolute;[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;[\s\S]*left:\s*50%;[\s\S]*top:\s*50%;/);
  assert.match(cssRule(components, ".preview-avatar-action"), /width:\s*24px;[\s\S]*height:\s*24px;/);
  assert.match(cssRule(components, ".preview-avatar-action::before"), /position:\s*absolute;[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;[\s\S]*left:\s*50%;[\s\S]*top:\s*50%;/);
  assert.match(components, /\.preview-sheet-handle\s*\{[^}]*width:\s*55px;[^}]*height:\s*5px;[^}]*border-radius:\s*var\(--radius-sheet-handle\);/s);
  assert.doesNotMatch(components, /\.preview-(?:toast|confirm-dialog)\s*\{|z-index:/);
  assert.doesNotMatch(components, /rotate\(/);
  const chipRules = components.match(/\.preview-chip\s*\{([^}]*)\}/s)?.[1] || "";
  assert.doesNotMatch(chipRules, /min-width:/, "text chips must retain their measured visible width");
  assert.match(components, /@media\s*\(max-width:\s*700px\)[\s\S]*#phone-root\[data-preview-mode="prototype"\][\s\S]*padding-top:\s*env\(safe-area-inset-top\)[\s\S]*padding-bottom:\s*env\(safe-area-inset-bottom\)/);
  assert.match(components, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);

  const tokenIndex = index.indexOf("/app-preview/styles/tokens.css");
  const shellIndex = index.indexOf("/app-preview/styles/shell.css");
  const componentIndex = index.indexOf("/app-preview/styles/components.css");
  assert.ok(tokenIndex >= 0 && tokenIndex < shellIndex && shellIndex < componentIndex);
});
