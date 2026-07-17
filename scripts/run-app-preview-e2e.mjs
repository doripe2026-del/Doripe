import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        if (!port) {
          reject(new Error("테스트용 포트를 찾지 못했습니다."));
          return;
        }

        resolve(port);
      });
    });
  });
}

const port = process.env.APP_PREVIEW_PORT || String(await findAvailablePort());
const playwrightCli = fileURLToPath(
  new URL("../node_modules/@playwright/test/cli.js", import.meta.url)
);
const child = spawn(
  process.execPath,
  [playwrightCli, "test", "-c", "playwright.app-preview.config.mjs", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: { ...process.env, APP_PREVIEW_PORT: port }
  }
);

child.once("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
