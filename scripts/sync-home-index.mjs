import { copyFile } from "node:fs/promises";

await copyFile("public/home/index.html", "public/index.html");
console.log("Landing index mirror updated.");
