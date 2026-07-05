import { existsSync, mkdirSync, statSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

const guardBin = join(homedir(), ".local", "bin");

function isExecutable(path) {
  try {
    const stat = statSync(path);
    return stat.isFile() && (stat.mode & 0o111);
  } catch {
    return false;
  }
}

function resolveCommand(name) {
  const paths = (process.env.PATH ?? "")
    .split(delimiter)
    .filter(Boolean)
    .filter((path) => path !== guardBin);

  for (const dir of paths) {
    const candidate = join(dir, name);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }

  return null;
}

function writeExecutable(name, body) {
  mkdirSync(guardBin, { recursive: true });
  const target = join(guardBin, name);
  writeFileSync(target, body, "utf8");
  chmodSync(target, 0o755);
}

const realVercel = resolveCommand("vercel");
const realNpx = resolveCommand("npx");
const realNpm = resolveCommand("npm");
const realPnpm = resolveCommand("pnpm");
const realYarn = resolveCommand("yarn");

const helper = [
  "",
  "is_doripe_context() {",
  '  case "$PWD" in',
  "    */Doripe|*/Doripe/*) return 0 ;;",
  "    */doripe|*/doripe/*) return 0 ;;",
  "  esac",
  "  return 1",
  "}",
  "",
  "is_production_vercel_action() {",
  '  local joined=" $* "',
  '  case "$joined" in',
  '    *" --prod "*|*" -p "*|*" promote "*|*" alias set "*|*" rollback "*) return 0 ;;',
  "  esac",
  "  return 1",
  "}",
  "",
  "block_direct_deploy() {",
  '  if [ "${DORIPE_ALLOW_DIRECT_VERCEL_DEPLOY:-}" = "1" ]; then',
  "    return 1",
  "  fi",
  '  if is_doripe_context && is_production_vercel_action "$@"; then',
  "    cat >&2 <<'EOF'",
  "Doripe deployment guard blocked this command.",
  "",
  "Production deploys must use:",
  "  codex/* branch -> GitHub PR -> required checks -> merge to main -> Vercel Git integration",
  "",
  "Do not run direct production commands:",
  "  vercel --prod",
  "  vercel promote",
  "  vercel alias set",
  "EOF",
  "    return 0",
  "  fi",
  "  return 1",
  "}",
  "",
].join("\n");

if (realVercel || realNpx) {
  const vercelDelegate = realVercel
    ? `${JSON.stringify(realVercel)} "$@"`
    : `${JSON.stringify(realNpx)} --yes vercel "$@"`;
  writeExecutable(
    "vercel",
    `#!/usr/bin/env zsh\n${helper}\nblock_direct_deploy "$@" && exit 64\nexec ${vercelDelegate}\n`,
  );
}

if (realNpx) {
  writeExecutable(
    "npx",
    `#!/usr/bin/env zsh\n${helper}\nif [[ " $* " == *" vercel "* ]] || [[ "$1" == "vercel" ]]; then\n  block_direct_deploy "$@" && exit 64\nfi\nexec ${JSON.stringify(realNpx)} "$@"\n`,
  );
}

if (realNpm) {
  writeExecutable(
    "npm",
    `#!/usr/bin/env zsh\n${helper}\nif [[ "$1" == "exec" || "$1" == "x" ]] && [[ " $* " == *" vercel "* ]]; then\n  block_direct_deploy "$@" && exit 64\nfi\nexec ${JSON.stringify(realNpm)} "$@"\n`,
  );
}

if (realPnpm) {
  writeExecutable(
    "pnpm",
    `#!/usr/bin/env zsh\n${helper}\nif [[ "$1" == "dlx" || "$1" == "exec" ]] && [[ " $* " == *" vercel "* ]]; then\n  block_direct_deploy "$@" && exit 64\nfi\nexec ${JSON.stringify(realPnpm)} "$@"\n`,
  );
}

if (realYarn) {
  writeExecutable(
    "yarn",
    `#!/usr/bin/env zsh\n${helper}\nif [[ "$1" == "dlx" || "$1" == "exec" ]] && [[ " $* " == *" vercel "* ]]; then\n  block_direct_deploy "$@" && exit 64\nfi\nexec ${JSON.stringify(realYarn)} "$@"\n`,
  );
}

console.log(`Deployment shell guard installed in ${guardBin}`);
console.log("Blocked in Doripe contexts: vercel --prod, vercel promote, vercel alias set, rollback, and npx/npm/pnpm/yarn vercel equivalents.");
