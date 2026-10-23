# Ask AI Tom, inside a project — plan

A reader playing a project can ask AI Tom about *that project*. A FAB opens a
right rail holding the same conversation UI as tomcoggia-com's Ask AI Tom; the
answers come from one document written about the project, not from the site's
whole experience record.

Reference implementation (tomcoggia-com): `AskAiFab.tsx`, `AskAiRail.tsx`,
`AskAiChat.tsx`, `AskAiMark.tsx`, `api/_ask-core.ts`, `api/ask.ts`.

---

## Decisions (agreed 2026-10-23: the recommended option on each)

1. **Where the endpoint lives.** Recommended: **ProjectBuilder** serves it — a
   dev middleware in `app/projects-plugin.ts` and a Vercel function
   `api/ask.ts` on projects.tomcoggia.com. The project document then stays
   with the project (projects are only authored here; consumers never hold a
   copy), and ProjectBuilder's own play route works without the site. Cost: a
   second set of LLM keys on the ProjectBuilder Vercel project, and a port of
   the prompt/provider code from `_ask-core.ts`.
   Alternative: a new route on tomcoggia-com's API that fetches the doc from
   projects.tomcoggia.com. That reuses the existing keys and core, but the doc
   has to be public, and ProjectBuilder's play route can't use it.
2. **Is the document public?** Recommended: **no**. `ask.md` is read by the
   function only and left out of the public `projects/` copy, so HTML-comment
   authoring notes (the site's convention) never ship.
3. **Does the project assistant also know the site record** (`experience.json`)?
   Recommended: **no** for v1. It's scoped to the project; for anything outside
   it, it says so and points to the site's own Ask AI Tom or email.

---

## Data

- **`projects/<id>/ask.md`** — the knowledge doc. Plain prose about the project:
  the problem, the decisions, the outcome, what's behind each step. HTML comments
  are private notes, as on the site. Not copied into the build's public
  `projects/`; bundled into the function instead (`vercel.json` →
  `functions["api/ask.ts"].includeFiles: "projects/*/ask.md"`).
- **`ask` on the project** (`WalkthroughContent`, additive and optional, so no
  schema bump):
  ```ts
  ask?: {
    enabled?: boolean;      // the FAB shows only when true and the host gave an endpoint
    intro?: string;         // the rail's opening line; defaults to one naming the project
    suggestions?: string[]; // the suggestion pills; defaults to a generic three
  }
  ```
- Drafts: the function refuses a draft project's id in production, the same
  way the build leaves drafts out.

## Request contract

`POST /api/ask`

```ts
// request
{ project: string;                       // project id
  messages: { role: "user" | "assistant"; content: string }[];
  step?: { index: number; eyebrow?: string; title?: string; body?: string } }
// response
{ text: string; step?: { id: string; label: string } }
```

`step` in the request is where the reader is, so "what am I looking at?" has an
answer. `step` in the response is an optional jump chip — the project's
equivalent of the site's nav link: offered, never taken for the reader. The
server drops a step id that isn't in the project.

## Server (`server/ask-core.ts`, outside `src/` so it never enters the package)

Ported from tomcoggia-com's `_ask-core.ts`, trimmed to one source:

- Same persona and rules: first person as Tom, answer only from the doc, never
  guess a hard fact, private notes are invisible, decline off-topic, point to
  email for what's missing.
- The prompt is built per request from `ask.md` + the project's title and its
  steps (eyebrow/title/body, ids) — re-read every call, so editing the doc in
  dev lands on the next question.
- Same guardrails (2000 chars per message, last 20 messages), same env-driven
  provider (`LLM_PROVIDER`, `LLM_MODEL`; Anthropic and Google via the AI SDK).
- CORS: allow tomcoggia.com and the ProjectBuilder origins.
- `ai`, `@ai-sdk/*` and `zod` go in ProjectBuilder's **devDependencies** — the
  package's only runtime dependency stays `lucide-react`.

Entry points: dev middleware at `/api/ask` in `projects-plugin.ts` (keys from
`.env`, as the site does), and `api/ask.ts` for Vercel.

## Package UI (`src/ask/`)

A port of the site's four components, inline-styled like the rest of `src/`,
taking colors from `src/theme.ts` (`RED`/`INK`):

- **`AskMark`** — red disc with lucide `BotMessageSquare`, 40px.
- **`AskFab`** — mark + "Ask AI Tom" label, label red → ink on hover with the
  disc following; fades out while the rail is open. Pinned to the viewport's
  top right (`top: 24, right: 32` — the player has no site header to clear).
  On a narrow viewport it drops the label and shows the mark alone.
- **`AskRail`** — `min(440px, 100vw)`, white, left border and the site's
  shadow, spring slide-in from the right, transparent click-catcher (no dim),
  header of mark + "Ask **AI Tom**" with the project's title beneath it and a
  close `ButtonRound`. Focuses the field 260ms after opening.
- **`AskChat`** — the conversation, mirroring `AskAiChat`'s rail variant:
  newest exchange first with each question above its answer, "You" / "AI Tom"
  labels, the typewriter reveal, the TC loader in the pending answer, the field
  pinned to the top of the scroll area and hidden while busy, suggestion pills
  until the first question, the "under development" line, the error strip.
  Step chips render as `CaseStudyLink`-style buttons and call the player's
  `goTo(index)`. Kept in `sessionStorage` under `ask-project:<id>`, so a reload
  keeps the conversation (one per project, not shared with the site's).
- Reduced motion (package rule): no spring and no typewriter — the rail fades
  and the answer appears whole.

Not ported: project cards, example images and page links. They belong to the
portfolio; inside a project the step is the thing to link to.

## Wiring into the player

- **Host config** — `CaseStudyProvider` gains `ask?: { endpoint: string }`.
  `ProjectPlayer` gains `projectId?: string` (content doesn't carry its id).
  The FAB renders only with an endpoint, an id, and `content.ask?.enabled`.
- **Layering** — FAB and rail mount last in `WalkthroughPlayer`, above the
  slide layer and the toolbar. A click on the FAB must not reach the slide's
  click-to-advance (stop propagation).
- **Keys** — while the rail is open, ArrowLeft/ArrowRight/Esc belong to it: Esc
  closes the rail rather than exiting the player, and arrows never step the
  walkthrough while you type. The player's key handler checks an `askOpen` ref.
- **Panel on the right** — `panelSide: "right"` puts the panel's top right under
  the FAB, so the panel takes a top clearance there, the way it already clears
  the toolbar at its foot.
- **Running app** — the rail sits over the stage; the app keeps running beneath
  it, and closing the rail leaves it exactly where it was.
- Exports from `src/index.ts`: `AskFab`, `AskRail`, `AskChat`, `AskMark`, the
  `ask` config type — so tomcoggia-com can later swap its own copies for these.

## Authoring in ProjectBuilder

- An **Ask AI Tom** section in the project's settings in the builder: the
  enabled toggle, intro, suggestions (one per line), and the document itself
  in a tall textarea.
- `POST /__projects/ask { id, doc }` writes `ask.md`; `GET` reads it. Duplicate
  copies it along with the images; delete removes it with the folder.
- `app/App.tsx` passes `projectId` and `ask={{ endpoint: "/api/ask" }}`.
- Editing the doc and asking in the play route closes the loop in dev.

## tomcoggia-com

- Bump `@tomcog/case-study` to the release tag; `Presentation.tsx` passes
  `projectId` and the provider gets
  `ask={{ endpoint: "https://projects.tomcoggia.com/api/ask" }}`.
- `Layout.tsx` hides the site's FAB and rail on presentation routes. Today they
  would sit over the player (FAB z100, rail z150 over the player's z50), which
  means two FABs once the project has its own.

---

## Milestones

1. **Endpoint answers from a doc.** `server/ask-core.ts`, dev middleware, an
   `ask.md` for the test project; checked with curl.
2. **FAB + rail in the player.** `src/ask/`, provider config, `projectId`,
   layering and keys; checked in `npm run dev` on the test project, over a
   slide and over a running app, panel left and right, narrow and wide.
3. **Step context and step chips.**
4. **Authoring** in the builder, plus duplicate/delete handling.
5. **Production.** `api/ask.ts`, env keys on Vercel, CORS, `includeFiles`, ask.md
   kept out of the public copy; `npm run build` + commit `dist/`, tag.
6. **tomcoggia-com** adopts the tag and hides its own FAB on presentations.

## Deferred

- Streaming answers (the site doesn't stream either).
- tomcoggia-com's own rail rebuilt on the package's `AskChat`, so the two can't
  drift.
- Rate limiting beyond the length caps; prompt caching for long docs.
