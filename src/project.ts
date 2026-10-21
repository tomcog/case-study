import { DEFAULT_CONTENT } from "./core.js";
import type { CaseStudyContent, ProjectPreview, Screen } from "./core.js";
import type { StepContent, WalkthroughContent, WalkthroughStep } from "./walkthrough/types.js";

// ─── Project files ─────────────────────────────────────────────────
// A project is one JSON object. These helpers make that object safe to move
// between apps: versioned, migrated on load, and with site-relative asset paths
// ("/images/…") pinned to the site they came from.
//
// There are two kinds. A case study is a deck of screens; a walkthrough is
// stepped copy beside a stage. `kind` tells them apart, and is absent on
// everything saved before walkthroughs existed — so absent means case study.

export const SCHEMA_VERSION = 4;

export type ProjectKind = "case-study" | "walkthrough";

export type ProjectContent = CaseStudyContent | WalkthroughContent;

export const isWalkthrough = (project: ProjectContent): project is WalkthroughContent => project.kind === "walkthrough";

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

interface LegacyStep {
  enter?: { app?: string; stage?: string; path?: string; state?: string };
  stage?: { src?: string; fit?: "center" | "fill" };
  still?: { src?: string; fit?: "center" | "fill" };
}

/** Bring any saved project up to the current shape. Never throws: unknown or
 * empty input falls back to the starter deck. Versions 1 and 2 need no field
 * changes for a case study — version 2 only added `kind`, and a case study is
 * what a project without one is. Legacy screens without a `theme` keep their
 * look at render time (see screenTheme).
 *
 * Walkthroughs changed twice. Version 3 folded the privileged demo and the
 * named ones beside it into one `stages` list. Version 4 removes the list
 * entirely: what a step runs, what it shows and where it starts are three
 * fields on the step, so nothing is inherited and nothing is shared. */
export function migrate(raw: unknown): ProjectContent {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CONTENT, kind: "case-study", schemaVersion: SCHEMA_VERSION };
  const p = raw as Partial<ProjectContent>;
  return p.kind === "walkthrough" ? walkthrough(p as Partial<WalkthroughContent> & LegacyWalkthrough) : caseStudy(p as Partial<CaseStudyContent>);
}

function caseStudy(p: Partial<CaseStudyContent>): CaseStudyContent {
  const screens = Array.isArray(p.screens) && p.screens.length ? p.screens : DEFAULT_CONTENT.screens;
  return { ...p, kind: "case-study", screens, schemaVersion: SCHEMA_VERSION };
}

/** A walkthrough with nothing authored yet is left empty rather than filled
 * with a starter: its steps only mean anything next to the app they run. */
function walkthrough(raw: Partial<WalkthroughContent> & LegacyWalkthrough): WalkthroughContent {
  const { target, targets, stages, ...rest } = raw;
  const legacy = legacyStages(raw);
  const steps = Array.isArray(raw.steps) ? raw.steps : [];
  return {
    ...rest,
    kind: "walkthrough",
    steps: legacy.length ? steps.map((s, i) => foldStep(s, steps, i, legacy)) : steps.map(plainStep),
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

  return {
    ...step,
    app,
    start: kind === "code" ? enter?.path : undefined,
    content,
  };
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
 * A walkthrough's own images and embeds are pinned the same way. The apps it
 * runs are not: a step stores an app's id, and where that app is served from
 * is the host's to say, since the pool is shared across projects. */
export function withAssetBase<T extends ProjectContent>(project: T, base: string): T {
  const preview = previewWithAssetBase(base)(project.preview);
  if (isWalkthrough(project)) {
    const next: WalkthroughContent = { ...project, preview, steps: project.steps.map(stepWithAssetBase(base)) };
    return next as T;
  }
  const next: CaseStudyContent = { ...project, preview, screens: project.screens.map(screenWithAssetBase(base)) };
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
  kind: ProjectKind;
  title: string;
  /** Screens in a case study, steps in a walkthrough. */
  count: number;
  /** A case study's first screen, to render a thumbnail from. Null otherwise. */
  cover: Screen | null;
  /** The card the project authors for itself: the thumbnail every kind has. */
  preview: ProjectPreview | null;
  draft: boolean;       // only in ProjectBuilder's dev list; never published
  updatedAt: number;
  /** @deprecated Use `count`. Screens only, so a walkthrough reports 0. */
  screens: number;
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
  };
}

export type ProjectSource = ReturnType<typeof projectSource>;
