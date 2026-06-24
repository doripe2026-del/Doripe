import { mkdir, copyFile } from "fs/promises";
import { build } from "esbuild";

await mkdir("public/admin", { recursive: true });
await copyFile("src/admin-ui/admin.css", "public/admin/admin.css");

await build({
  bundle: true,
  entryPoints: ["src/admin-ui/main.tsx"],
  format: "esm",
  jsx: "automatic",
  outfile: "public/admin/admin.js",
  sourcemap: false,
  target: ["es2022"],
});

const adminFallbackRoutes = [
  "dashboard",
  "funnel",
  "funnel/funnel_overview",
  "funnel/ad_tests",
  "funnel/share_links",
  "users",
  "users/user_list",
  "users/waitlist",
  "users/waitlist_survey",
  "users/saved_places",
  "users/created_routes",
  "users/activity_logs",
  "creators",
  "creators/creator_list",
  "creators/creator_photos",
  "creators/creator_contacts",
  "stores",
  "stores/store_list",
  "stores/store_contacts",
  "stores/partnership_status",
  "content",
  "content/content_dashboard",
  "content/photo_management",
  "content/scrap_management",
  "content/tag_management",
  "content/photo_review",
  "settings",
];

await Promise.all(adminFallbackRoutes.map(async (route) => {
  const routeDirectory = `public/admin/${route}`;
  await mkdir(routeDirectory, { recursive: true });
  await copyFile("public/admin/index.html", `${routeDirectory}/index.html`);
}));
