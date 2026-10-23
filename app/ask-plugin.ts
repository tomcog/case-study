import type { Plugin } from "vite";
import { answer, type AskEnv } from "./ask-core";

// ─── Ask AI Tom endpoint, in dev ───────────────────────────────────
// POST /api/ask { project, messages, stepIndex? } → { text, step? }
// The player's rail posts here. The keys come from .env at the repo root
// (ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, LLM_PROVIDER, LLM_MODEL)
// and never reach the browser.

export function askPlugin(projectsDir: string, env: AskEnv): Plugin {
  return {
    name: "ask-ai-tom",
    configureServer(server) {
      server.middlewares.use("/api/ask", (req, res) => {
        const reply = (status: number, data: unknown) =>
          res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(data));
        if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            reply(200, await answer(projectsDir, JSON.parse(body || "{}"), env));
          } catch (err) {
            const message = String((err as Error)?.message ?? err);
            // A bad request (no such project, malformed messages) vs. the model failing.
            reply(/project|messages|role|content|turned on/.test(message) ? 400 : 500, { error: message });
          }
        });
      });
    },
  };
}
