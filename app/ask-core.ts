// ─── Ask AI Tom, about one project ─────────────────────────────────
// The answering half of the player's Ask AI Tom rail. A reader asks about the
// project they're viewing; the answer comes from two places only: the
// project's own document (projects/<id>/ask.md) and the copy its steps show.
// Ported from tomcoggia-com's api/_ask-core.ts — the same persona and rules,
// narrowed from the whole portfolio to one project.
//
// Called by the dev middleware (app/ask-plugin.ts). The LLM is reached
// through the Vercel AI SDK, so the provider and model are env vars
// (LLM_PROVIDER = anthropic | google, LLM_MODEL), as on the site. Everything
// is re-read per request, so an edit to ask.md lands on the next question.

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import type { LanguageModel } from "ai";
import { z } from "zod";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Two shapes of reply. A jump to another step is only on offer where it can't
// pull the reader out of the sequence: on the last step, or on one marked
// `askLinks`. Everywhere else the field isn't there to fill.
const textOnly = z.object({
  text: z.string().describe("The written answer."),
});
const withStep = textOnly.extend({
  step: z
    .object({ id: z.string(), label: z.string() })
    .optional()
    .describe("OMIT unless the visitor explicitly asked where something is or to see/go to it. Then: the step that shows it; id is the exact step id from STEPS, label is short button text."),
});

export type AskReply = z.infer<typeof withStep>;
export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AskEnv = {
  anthropicApiKey?: string;
  googleApiKey?: string;
  provider?: string;
  model?: string;
};

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-6",
  google: "gemini-2.5-flash",
};

// Guardrails: this is a paid endpoint a reader can reach.
const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY = 20;

function resolveModel(env: AskEnv): LanguageModel {
  const provider = env.provider || "anthropic";
  const modelId = env.model || DEFAULT_MODELS[provider] || DEFAULT_MODELS.anthropic;
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey: env.anthropicApiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey: env.googleApiKey })(modelId);
    default:
      throw new Error(`LLM_PROVIDER '${provider}' is not supported (try 'anthropic' or 'google')`);
  }
}

export function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("`messages` must be a non-empty array");
  return raw.slice(-MAX_HISTORY).map((m: any) => {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
      throw new Error("each message needs role 'user'|'assistant' and string content");
    }
    return { role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) };
  });
}

// ─── What the project says ───

type StepCopy = { id: string; lines: string[]; links: boolean };

/** Copy fields worth reading aloud, by key. Ids, colors and URLs are not. */
const COPY_KEYS = new Set(["eyebrow", "title", "body", "label", "value", "text", "caption", "quote", "attribution", "linkLabel"]);

/** Plain text from the inline markup: links keep their label, styles and pauses go. */
function plain(s: string): string {
  return s
    .replace(/<pause[^>]*>/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\{\*\*([^}]+)\*\*\}|\*\*([^*]+)\*\*/g, "$1$2")
    .replace(/\{[a-z]+\}|\[gray\]/g, "")
    .replace(/\s*\n\s*/g, " / ")
    .trim();
}

function copyOf(value: unknown, out: string[]) {
  if (Array.isArray(value)) value.forEach((v) => copyOf(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === "string" && COPY_KEYS.has(k) && v.trim()) out.push(`${k}: ${plain(v)}`);
      else if (typeof v === "object") copyOf(v, out);
    }
  }
}

/** Each step's copy, whichever chrome it's drawn in: a slide's fields, or the
 * panel's eyebrow, title and body and its callouts. */
function stepsOf(project: any): StepCopy[] {
  const steps: any[] = Array.isArray(project?.steps) ? project.steps : [];
  return steps.map((s, i) => {
    const lines: string[] = [];
    if (s?.content?.kind === "slide") copyOf(s.content.screen, lines);
    else copyOf({ eyebrow: s?.eyebrow, title: s?.title, body: s?.body, callouts: s?.callouts }, lines);
    return { id: String(s?.id ?? `step-${i + 1}`), lines, links: s?.askLinks === true };
  });
}

/** The document, minus the private notes: they never reach the model. */
function loadDoc(dir: string): string {
  const file = join(dir, "ask.md");
  if (!existsSync(file)) return "";
  return readFileSync(file, "utf-8").replace(/<!--[\s\S]*?-->/g, "").trim();
}

function buildSystemPrompt(title: string, doc: string, steps: StepCopy[], at: number | null, links: boolean): string {
  const stepLines = steps.length
    ? steps
        .map((s, i) => `Step ${i + 1} of ${steps.length} — id: ${s.id}${i === at ? "  ← THE READER IS HERE" : ""}\n${s.lines.map((l) => `    ${l}`).join("\n") || "    (no copy)"}`)
        .join("\n")
    : "(none)";
  return [
    `You ARE Tom Coggia. A visitor is viewing "${title}", a project of yours,`,
    "and has opened a chat to ask you about it. Talk with them directly, in the",
    "first person, as yourself. Answer as \"I\" / \"me\". Be warm, real, and",
    "conversational.",
    "",
    "Rules:",
    "- Everything you say about this project must come ONLY from THE DOCUMENT",
    "  and STEPS below. Never invent or embellish. If something isn't there, say",
    "  so plainly, as yourself and in your own words — not a stock line.",
    "- You MAY briefly explain a general term or concept that comes up (e.g.",
    "  \"what is a liquid biopsy?\") from general knowledge. Keep it short, then",
    "  bring it back to the project.",
    "- Be concise and specific. Lead with the direct answer. Sound like a person",
    "  talking, not a brochure. Two to four sentences unless they ask for more.",
    "- VOICE: conversational and approachable, with the quiet authority of",
    "  someone who did the work and knows it inside out. THE DOCUMENT is often",
    "  written like a specification — component lists, regulatory terms,",
    "  formal definitions. Never answer in that register. Don't recite lists",
    "  of parts or requirements, don't define things the way a standard or a",
    "  glossary would, and don't stack jargon. Pick the few details that",
    "  matter for the question and say them the way you'd explain them to a",
    "  sharp colleague across the table: what it is, why it mattered, what you",
    "  did about it. Plain words first; a technical term only when it's the",
    "  right word, explained in passing if a visitor might not know it.",
    "  Approachable never means vague: every fact you state stays exact.",
    "- SPEAK FROM MEMORY: the sources below are your own memory of your own",
    "  work, not something you're reading alongside the visitor. State what you",
    "  know as plain fact, the way you'd recall it (\"I was at Freenome from 2021",
    "  to 2026\"). Never refer to your sources or hedge toward them: no \"based",
    "  on what's here\", \"according to the document\", \"from what I can see\",",
    "  \"it looks like\", \"the slides say\", \"it's listed as\", \"this write-up\",",
    "  \"what I've written here\", \"I don't cover that\". That holds when the",
    "  answer is missing too: say it as a person would (\"I'd rather not guess",
    "  at that\"), not as a document that lacks a section. The visitor should",
    "  never be able to tell there is a document at all. (A step they're",
    "  looking at is fine to point to — \"the screen you're on\" — since they can",
    "  see it too.)",
    "- STEPS is what the visitor is clicking through, in order. When they say",
    "  \"this\", \"here\" or \"this screen\", they mean the step marked THE READER IS",
    "  HERE. You can refer to other steps by what they show.",
    "- NEVER GUESS A HARD FACT. Numbers, dates, names, regulatory status and",
    "  outcomes must be copied from the sources below, not inferred. If the",
    "  answer isn't there, say you'd rather share that directly and point them",
    "  to tom.coggia@gmail.com. The same goes for reasons: don't link two facts",
    "  with a cause (\"that dropped because…\") unless the sources give it.",
    "- This chat is about this project. For questions about the rest of your",
    "  career or other work, answer only if THE DOCUMENT covers it; otherwise say",
    "  warmly that this chat is about this project, and that the Ask AI Tom on",
    "  tomcoggia.com covers the rest. Politely decline anything unrelated to",
    "  you or your field.",
    "- Questions about salary, availability, or why you left a role: don't",
    "  speculate. Point them to tom.coggia@gmail.com.",
    "- Always populate `text`. Plain prose; **bold** is the only formatting.",
    ...(links
      ? [
          "- STEP LINKS: set `step` ONLY when the visitor asks to see, find or go to",
          "  something a specific step shows (\"where's the research?\", \"show me the",
          "  results\"). Never add one to an answer they didn't ask to navigate from.",
          "  Then `step` is { id: <the exact id from STEPS>, label: <short button text",
          "  naming what that step shows, e.g. \"Go to the research\"> }. Only use an id",
          "  that appears in STEPS, never the step they're already on. Don't cite step",
          "  numbers in `text`; the button does the pointing.",
        ]
      : [
          "- KEEP THEM IN SEQUENCE: the visitor is partway through a presentation",
          "  that runs in order. Don't send them to other steps or tell them to skip",
          "  ahead or go back. If they ask about something a later step covers,",
          "  answer it here; you may say it comes up later on, but never say which",
          "  step, how far ahead, or that it's the last one. If they ask to go",
          "  somewhere, tell them the arrows at the lower left move back and",
          "  forward through it.",
        ]),
    "",
    "=== THE DOCUMENT (your own writing about this project) ===",
    doc || "(Nothing written yet. Answer from STEPS alone.)",
    "",
    "=== STEPS (what the visitor sees, in order) ===",
    stepLines,
  ].join("\n");
}

// ─── Answering ───

export type AskRequest = { project?: unknown; messages?: unknown; stepIndex?: unknown };

/** Answer one question about the project in `projectsDir/<project>`. */
export async function answer(projectsDir: string, body: AskRequest, env: AskEnv): Promise<AskReply> {
  const id = typeof body.project === "string" ? body.project : "";
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error("`project` must be a project id");
  const dir = join(projectsDir, id);
  const file = join(dir, "project.json");
  if (!existsSync(file)) throw new Error(`No project '${id}'`);
  const project = JSON.parse(readFileSync(file, "utf-8"));
  if (!project?.ask?.enabled) throw new Error(`Ask AI Tom isn't turned on for '${id}'`);

  const messages = sanitizeMessages(body.messages);
  const steps = stepsOf(project);
  const at = typeof body.stepIndex === "number" && body.stepIndex >= 0 && body.stepIndex < steps.length ? body.stepIndex : null;
  // Jumps only from the end of the presentation, or a step marked for them.
  const links = at != null && (at === steps.length - 1 || steps[at].links);

  const { object }: { object: AskReply } = await generateObject({
    model: resolveModel(env),
    schema: links ? withStep : textOnly,
    system: buildSystemPrompt(String(project.title || id), loadDoc(dir), steps, at, links),
    messages,
  });

  // Offer only a step that exists, and not the one the reader is already on.
  if (object.step && (!steps.some((s) => s.id === object.step!.id) || (at != null && steps[at].id === object.step.id))) {
    delete object.step;
  }
  return object;
}
