import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { projectsPlugin } from "./app/projects-plugin";

// ProjectBuilder, the standalone app (app/). It imports the package from src/,
// so edits to the builder or player show up without a rebuild.
export default defineConfig({
  root: "app",
  plugins: [react(), projectsPlugin(fileURLToPath(new URL("./projects", import.meta.url)), fileURLToPath(new URL("./apps", import.meta.url)))],
  build: { outDir: "../app-dist", emptyOutDir: true },
  server: { port: 5187 },
});
