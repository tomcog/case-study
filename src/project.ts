import { DEFAULT_CONTENT } from "./core.js";
import type { CaseStudyContent, ProjectPreview, Screen } from "./core.js";
import type { Stage, StillImage, WalkthroughContent, WalkthroughStep } from "./walkthrough/types.js";

// ─── Project files ─────────────────────────────────────────────────
// A project is one JSON object. These helpers make that object safe to move
// between apps: versioned, migrated on load, and with site-relative asset paths
// ("/images/…") pinned to the site they came from.
//
// There are two kinds. A case study is a deck of screens; a walkthrough is
// stepped copy beside a stage. `kind` tells them apart, and is absent on
// everything saved before walkthroughs existed — so absent means case study.

export const SCHEMA_VERSION = 3;

export type ProjectKind = "case-study" | "walkthrough";

export type ProjectContent = CaseStudyContent | WalkthroughContent;

export const isWalkthrough = (project: ProjectContent): project is WalkthroughContent => project.kind === "walkthrough";

/** The walkthrough shape before version 3, when there was one demo plus named
 * extras beside it. Kept only so those projects can be folded into `stages`. */
interface LegacyTarget {
  src?: string;
  width?: number;
  minWidth?: number;
}

interface LegacyWalkthrough {
  target?: LegacyTarget;
  targets?: Record<string, LegacyTarget>;
}

interface LegacyStep {
  enter?: { app?: string; stage?: string; path?: string; state?: string };
  stage?: StillImage;
}

/** Bring any saved project up to the current shape. Never throws: unknown or
 * empty input falls back to the starter deck. Version 1 and the unversioned
 * projects before it need no field changes — version 2 only added `kind`, and
 * a case study is what a project without one is. Version 3 is walkthroughs
 * only: the privileged `target` and the named `targets` beside it became one
 * flat `stages` list, with `enter.app` becoming `enter.stage`. Legacy screens
 * without a `theme` keep their look at render time (see screenTheme). */
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
 * with a starter: its steps only mean anything next to its own stages. */
function walkthrough(raw: Partial<WalkthroughContent> & LegacyWalkthrough): WalkthroughContent {
  const { target, targets, ...rest } = raw;
  const stages = foldStages(raw);
  const first = stages[0]?.id ?? null;
  const names = legacyNames(raw, stages);
  return {
    ...rest,
    kind: "walkthrough",
    stages,
    steps: Array.isArray(raw.steps) ? raw.steps.map((s) => foldStep(s, names, first)) : [],
    schemaVersion: SCHEMA_VERSION,
  };
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** A readable id for a demo folded in from the old shape: the folder its build
 * sits in, which is what an author would have called it anyway. */
function idFromSrc(src: string, taken: Set<string>): string {
  const parts = (src.split("?")[0] ?? "").split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  const folder = /\.[a-z0-9]+$/i.test(last) ? (parts[parts.length - 2] ?? "") : last;
  const base = slug(folder);
  let id = !base || base === "demo" ? "app" : base;
  for (let n = 2; taken.has(id); n++) id = `${base || "app"}-${n}`;
  taken.add(id);
  return id;
}

const cleanStage = (s: Partial<Stage>, fallbackId: string): Stage => ({
  ...s,
  id: typeof s.id === "string" && s.id ? s.id : fallbackId,
  kind: s.kind === "embed" || s.kind === "mock" ? s.kind : "demo",
  src: typeof s.src === "string" ? s.src : "",
});

/** The stages a saved walkthrough has, or the old `target` + `targets` folded
 * into the same list. The old default goes first, which keeps a walkthrough
 * that never named an app opening exactly where it used to. */
function foldStages(raw: Partial<WalkthroughContent> & LegacyWalkthrough): Stage[] {
  if (Array.isArray(raw.stages)) {
    const taken = new Set<string>();
    return raw.stages
      .filter((s) => !!s && typeof s === "object")
      .map((s) => cleanStage(s as Partial<Stage>, idFromSrc(typeof s.src === "string" ? s.src : "", taken)));
  }
  const taken = new Set<string>();
  const out: Stage[] = [];
  const fold = (t: LegacyTarget, label?: string) => {
    const src = typeof t.src === "string" ? t.src : "";
    const id = label ? uniq(slug(label) || "app", taken) : idFromSrc(src, taken);
    out.push({ id, label: label ?? undefined, kind: "demo", src, width: t.width, minWidth: t.minWidth });
  };
  if (raw.target && typeof raw.target === "object") fold(raw.target);
  for (const [name, t] of Object.entries(raw.targets ?? {})) {
    if (t && typeof t === "object") fold(t, name);
  }
  return out;
}

function uniq(id: string, taken: Set<string>): string {
  let out = id;
  for (let n = 2; taken.has(out); n++) out = `${id}-${n}`;
  taken.add(out);
  return out;
}

/** Old `enter.app` names, mapped to the stage ids they became. */
function legacyNames(raw: Partial<WalkthroughContent> & LegacyWalkthrough, stages: Stage[]): Map<string, string> {
  const map = new Map<string, string>();
  if (Array.isArray(raw.stages)) return map;
  // The default was first, so the named ones line up with the rest in order.
  const named = Object.keys(raw.targets ?? {});
  const offset = raw.target && typeof raw.target === "object" ? 1 : 0;
  named.forEach((name, i) => {
    const stage = stages[offset + i];
    if (stage) map.set(name, stage.id);
  });
  return map;
}

/** A step in the current shape. `enter.app` named a demo that may not have
 * existed — "default" among them — and that always meant the default one, so
 * anything unresolved becomes the first stage rather than nothing. */
function foldStep(raw: WalkthroughStep & LegacyStep, names: Map<string, string>, first: string | null): WalkthroughStep {
  const { stage: still, ...step } = raw;
  const app = raw.enter?.app;
  const enter = !raw.enter
    ? undefined
    : {
        ...raw.enter,
        app: undefined,
        stage: app ? (names.get(app) ?? first ?? undefined) : raw.enter.stage,
      };
  return {
    ...step,
    enter: enter && (enter.stage || enter.path || enter.state ? enter : undefined),
    still: still ?? raw.still,
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
    still: step.still && { ...step.still, src: abs(step.still.src) ?? "" },
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
 * A walkthrough's stages are pinned the same way. That makes the stored path
 * honest about where each one lives, and leaves it to the player to notice a
 * demo is no longer same-origin and say so — it can only drive one it can read. */
export function withAssetBase<T extends ProjectContent>(project: T, base: string): T {
  const preview = previewWithAssetBase(base)(project.preview);
  if (isWalkthrough(project)) {
    const abs = absolutizer(base);
    const next: WalkthroughContent = {
      ...project,
      preview,
      stages: project.stages.map((s) => ({ ...s, src: abs(s.src) ?? "" })),
      steps: project.steps.map(stepWithAssetBase(base)),
    };
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
