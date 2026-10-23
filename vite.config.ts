import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { projectsPlugin } from "./app/projects-plugin";
import { askPlugin } from "./app/ask-plugin";

// ProjectBuilder, the standalone app (app/). It imports the package from src/,
// so edits to the builder or player show up without a rebuild.
export default defineConfig(({ mode }) => {
  const projects = fileURLToPath(new URL("./projects", import.meta.url));
  // The repo root's .env, not app/ (the Vite root): it holds the LLM keys.
  const env = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "");
  return {
    root: "app",
    plugins: [
      react(),
      projectsPlugin(projects, fileURLToPath(new URL("./apps", import.meta.url))),
      askPlugin(projects, {
        anthropicApiKey: env.ANTHROPIC_API_KEY,
        googleApiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
        provider: env.LLM_PROVIDER,
        model: env.LLM_MODEL,
      }),
    ],
    build: { outDir: "../app-dist", emptyOutDir: true },
    server: { port: 5187 },
  };
});
