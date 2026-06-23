import React from "react";
import { createRoot } from "react-dom/client";
import { AdminShell } from "./AdminShell";

const root = document.getElementById("admin-root");

if (!root) {
  throw new Error("Missing admin root element");
}

createRoot(root).render(
  <React.StrictMode>
    <AdminShell initialAuthed={true} />
  </React.StrictMode>,
);
