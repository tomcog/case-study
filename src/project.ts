import { DEFAULT_WALKTHROUGH, contentOf } from "./walkthrough/types.js";
import type { ProjectPreview, Screen } from "./core.js";
import type { StepContent, WalkthroughContent, WalkthroughStep } from "./walkthrough/types.js";

// ─── Project files ─────────────────────────────────────────────────
// A project is one JSON object. These helpers make that object safe to move
// between apps: versioned, migrated on load, and with site-relative asset paths
// ("/images/…") pinned to the site they came from.
//
// There is one kind: an ordered list of steps, each displaying a slide, an
// app, a framed URL or an image. The two kinds that came before it are folded
// into that one by migrate().

export const SCHEMA_VERSION = 6;

export type ProjectContent = WalkthroughContent;

/** An app ingested into the shared pool: a snapshot of someone's built output,
 * copied in and served from this site. Steps reference the `id`, so renaming
 * the label leaves them alone; `src` is where its entry file is served from,
 * which a site hosting them elsewhere makes absolute. */
export interface IngestedApp {
  id: string;
  label: string;
  src: string;
  /** Viewport width to give it, in px; the frame scales to fit. Below
   * `minWidth` the player drops the frame and shows the copy alone. Both
   * belong to the app rather than to each step that runs it. */
  width?: number;
  minWidth?: number;
  ingestedAt?: number;
}

/** The walkthrough shapes before version 4, kept only so they can be folded
 * into the per-step one. Version 2 had a single `target` demo with named
 * `targets` beside it; version 3 made those one `stages` list. Both put the
 * app on a shared record and left the step pointing at it — which is the part
 * version 4 undoes, by giving every step its own answer. */
interface LegacyTarget {
  src?: string;
  width?: number;
  minWidth?: number;
}

interface LegacyStage {
  id?: string;
  label?: string;
  kind?: string;
  src?: string;
  width?: number;
  minWidth?: number;
  fit?: "center" | "fill";
}

interface LegacyWalkthrough {
  target?: LegacyTarget;
  targets?: Record<string, LegacyTarget>;
  stages?: LegacyStage[];
}

/** The deck a project was before version 5, when a case study and a
 * walkthrough were different kinds of thing. */
interface LegacyDeck {
  kind?: string;
  screens?: Screen[];
}

/** A step displaying a slide has no panel and no stage of its own — the slide
 * covers both — so panel copy, a spotlight and callouts say nothing on one.
 * They were authorable until the builder stopped offering them on slides,
 * which left them on saved steps: invisible to the reader and out of reach of
 * the author. Version 6 drops them.
 *
 * `advance` stays as it is. It is required, and the player already treats a
 * slide as manual whatever it says, so there is nothing to clean up — only a
 * field that would have to be invented to be removed. */
function stripSlidePanel(step: WalkthroughStep): WalkthroughStep {
  if (contentOf(step).kind !== "slide") return step;
  const { eyebrow, title, body, imageUrl, spotlight, callouts, ...rest } = step;
  return rest;
}

interface LegacyStep {
  enter?: { app?: string; stage?: string; path?: string; state?: string };
  stage?: { src?: string; fit?: "center" | "fill" };
  still?: { src?: string; fit?: "center" | "fill" };
}

/** Bring any saved project up to the current shape. Never throws: anything
 * that isn't an object falls back to one empty step, and an object without
 * steps keeps none — the builder has an empty state for that, and inventing a
 * step would put words in the author's mouth.
 *
 * A project used to be one of two kinds. A case study was a deck of screens; a
 * walkthrough was steps beside a live app. Version 5 makes it one thing — a
 * list of steps, each displaying a slide, an app, a URL or an image — because
 * a deck was only ever the case where every step displays a slide. A case
 * study's screens become exactly that, in order.
 *
 * Version 6 then takes off what a slide step can't use: see
 * `stripSlidePanel`. */
export function migrate(raw: unknown): ProjectContent {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_WALKTHROUGH, schemaVersion: SCHEMA_VERSION };
  const p = raw as Partial<WalkthroughContent> & LegacyWalkthrough & LegacyDeck;
  const { target, targets, stages, kind, screens, ...rest } = p;

  // A deck: every screen becomes a step that displays it, and nothing runs.
  if (Array.isArray(screens) && !Array.isArray(p.steps)) {
    return {
      ...rest,
      steps: screens.map((screen, i) => ({
        id: screen.id || `step-${i + 1}`,
        advance: { on: "manual" } as const,
        content: { kind: "slide" as const, screen },
      })),
      schemaVersion: SCHEMA_VERSION,
    };
  }

  const legacy = legacyStages(p);
  const steps = Array.isArray(p.steps) ? p.steps : [];
  return {
    ...rest,
    steps: (legacy.length ? steps.map((s, i) => foldStep(s, steps, i, legacy)) : steps.map(plainStep)).map(stripSlidePanel),
    schemaVersion: SCHEMA_VERSION,
  };
}

/** The old shared records, in order, however they were spelled. */
function legacyStages(raw: Partial<WalkthroughContent> & LegacyWalkthrough): LegacyStage[] {
  if (Array.isArray(raw.stages)) return raw.stages.filter((s): s is LegacyStage => !!s && typeof s === "object");
  const out: LegacyStage[] = [];
  if (raw.target && typeof raw.target === "object") out.push({ id: "app", kind: "code", ...raw.target });
  for (const [name, t] of Object.entries(raw.targets ?? {})) {
    if (t && typeof t === "object") out.push({ id: name, label: name, kind: "code", ...t });
  }
  return out;
}

/** Which shared record a step resolved to under the old rules: the nearest one
 * named at or before it, falling back to the first. */
function legacyStageFor(steps: WalkthroughStep[], index: number, stages: LegacyStage[]): LegacyStage | undefined {
  for (let i = Math.min(index, steps.length - 1); i >= 0; i--) {
    const named = (steps[i] as WalkthroughStep & LegacyStep).enter;
    const id = named?.stage ?? named?.app;
    if (id) return stages.find((st) => st.id === id) ?? stages[0];
  }
  return stages[0];
}

/** A step with the old shared record folded into it. What it ran becomes its
 * own `app`, what it showed becomes its own `content`, and the seed is dropped
 * — an app now opens in its default state for the screen it opens on. */
function foldStep(raw: WalkthroughStep & LegacyStep, steps: WalkthroughStep[], index: number, stages: LegacyStage[]): WalkthroughStep {
  const { enter, stage: legacyStill, still, ...step } = raw;
  const record = legacyStageFor(steps, index, stages);
  const cover = still ?? legacyStill;
  const kind = record?.kind === "embed" || record?.kind === "mock" ? record.kind : "code";

  let app: string | undefined;
  let content: StepContent | undefined;
  if (kind === "code") {
    app = record?.id;
    if (cover?.src) content = { kind: "image", src: cover.src, fit: cover.fit };
  } else if (kind === "embed") {
    content = { kind: "embed", url: record?.src ?? "", width: record?.width, minWidth: record?.minWidth };
  } else {
    content = { kind: "image", src: cover?.src || record?.src || "", fit: cover?.fit ?? record?.fit };
  }

  return { ...step, app, start: kind === "code" ? enter?.path : undefined, content };
}

/** A step already in the current shape, with the fields it may not have. */
function plainStep(raw: WalkthroughStep & LegacyStep): WalkthroughStep {
  const { enter, stage: legacyStill, still, ...step } = raw;
  const cover = still ?? legacyStill;
  return {
    ...step,
    start: step.start ?? enter?.path,
    content: step.content ?? (cover?.src ? { kind: "image", src: cover.src, fit: cover.fit } : undefined),
  };
}

const isRelative = (u?: string) => !!u && u.startsWith("/") && !u.startsWith("//");

const absolutizer = (base: string) => {
  const root = base.replace(/\/+$/, "");
  return (u?: string) => (isRelative(u) ? root + u : u);
};

const screenWithAssetBase = (base: string) => {
  const abs = absolutizer(base);
  return (s: Screen): Screen => ({
    ...s,
    imageUrl: abs(s.imageUrl),
    imageUrl2: abs(s.imageUrl2),
    videoUrl: abs(s.videoUrl),
    images: s.images?.map((img) => ({ ...img, url: abs(img.url) ?? "" })),
  });
};

const stepWithAssetBase = (base: string) => {
  const abs = absolutizer(base);
  return (step: WalkthroughStep): WalkthroughStep => ({
    ...step,
    imageUrl: abs(step.imageUrl),
    content:
      step.content?.kind === "image"
        ? { ...step.content, src: abs(step.content.src) ?? "" }
        : step.content?.kind === "embed"
          ? { ...step.content, url: abs(step.content.url) ?? "" }
          : step.content?.kind === "slide"
            ? { ...step.content, screen: screenWithAssetBase(base)(step.content.screen) }
            : step.content,
  });
};

const previewWithAssetBase = (base: string) => {
  const abs = absolutizer(base);
  return (pv?: ProjectPreview) => pv && { ...pv, image: abs(pv.image), logo: abs(pv.logo), cardLogo: abs(pv.cardLogo) };
};

/** Rewrite every site-relative asset path in a project to an absolute URL on
 * `base` (e.g. "https://www.tomcoggia.com"), so it renders from another origin.
 * Absolute URLs and empty fields are left alone. Returns a new object.
 *
 * A step's own images, embeds and slides are pinned the same way. The apps it
 * runs are not: a step stores an app's id, and where that app is served from
 * is the host's to say, since the pool is shared across projects. */
export function withAssetBase<T extends ProjectContent>(project: T, base: string): T {
  const preview = previewWithAssetBase(base)(project.preview);
  const next: WalkthroughContent = { ...project, preview, steps: project.steps.map(stepWithAssetBase(base)) };
  return next as T;
}

/** Fetch a project file and migrate it. With `assetBase`, relative asset paths
 * are pinned to that origin (use it for projects hosted by another site). */
export async function loadProject(url: string, opts: { assetBase?: string; signal?: AbortSignal } = {}): Promise<ProjectContent> {
  const res = await fetch(url, { signal: opts.signal });
  if (!res.ok) throw new Error(`Couldn't load project (${res.status}): ${url}`);
  const project = migrate(await res.json());
  return opts.assetBase ? withAssetBase(project, opts.assetBase) : project;
}

/** The preview card a project authors for itself (props for ProjectPreviewCard).
 * The card logo falls back to the slide logo. */
export function previewCard(project: ProjectContent) {
  const p = project.preview ?? {};
  return {
    image: p.image, imageOverlay: p.imageOverlay, eyebrow: p.eyebrow, title: p.title, body: p.body,
    logo: p.cardLogo || p.logo,
  };
}

/** One row of a project source's index.json (written by ProjectBuilder). */
export interface ProjectSummary {
  id: string;
  title: string;
  /** How many steps it has. */
  count: number;
  /** The first slide it displays, to render a thumbnail from — null for a
   * project that opens straight into an app. */
  cover: Screen | null;
  /** The card the project authors for itself: the thumbnail every kind has. */
  preview: ProjectPreview | null;
  draft: boolean;       // only in ProjectBuilder's dev list; never published
  updatedAt: number;
}

/** Projects published by a ProjectBuilder site at `base` (e.g.
 * "https://projects.tomcoggia.com"; "" for the same origin). Asset paths come
 * back absolute, so images load from that site. Which projects a site shows is
 * the site's choice; publishing only makes them available. */
export function projectSource(base: string) {
  const root = base.replace(/\/+$/, "");
  const url = (id: string) => `${root}/projects/${id}/project.json`;
  return {
    url,
    /** Every published project, newest first. */
    async list(opts: { signal?: AbortSignal } = {}): Promise<ProjectSummary[]> {
      const res = await fetch(`${root}/projects/index.json`, { signal: opts.signal, cache: "no-cache" });
      if (!res.ok) throw new Error(`Couldn't list projects (${res.status}): ${root}`);
      const rows: ProjectSummary[] = await res.json();
      const screen = screenWithAssetBase(root);
      const preview = previewWithAssetBase(root);
      return rows.map((row) => ({ ...row, cover: row.cover && screen(row.cover), preview: preview(row.preview ?? undefined) ?? null }));
    },
    get: (id: string, opts: { signal?: AbortSignal } = {}) => loadProject(url(id), { ...opts, assetBase: root }),

    /** The apps those projects run, with their addresses made absolute. A step
     * stores only an app's id, so a site rendering someone else's projects has
     * to be handed the pool to resolve them against.
     *
     * An app served from another origin can be shown but not driven — the
     * player says so rather than sitting there — so a project whose steps run
     * apps is fully itself only on the site that serves them. */
    async apps(opts: { signal?: AbortSignal } = {}): Promise<IngestedApp[]> {
      const res = await fetch(`${root}/apps/index.json`, { signal: opts.signal, cache: "no-cache" });
      if (!res.ok) return [];
      const rows: IngestedApp[] = await res.json();
      const abs = absolutizer(root);
      return rows.map((app) => ({ ...app, src: abs(app.src) ?? "" }));
    },
  };
}

export type ProjectSource = ReturnType<typeof projectSource>;
