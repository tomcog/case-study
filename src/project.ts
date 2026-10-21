import { DEFAULT_CONTENT } from "./core.js";
import type { CaseStudyContent, ProjectPreview, Screen } from "./core.js";
import type { WalkthroughContent, WalkthroughStep, WalkthroughTarget } from "./walkthrough/types.js";

// ─── Project files ─────────────────────────────────────────────────
// A project is one JSON object. These helpers make that object safe to move
// between apps: versioned, migrated on load, and with site-relative asset paths
// ("/images/…") pinned to the site they came from.
//
// There are two kinds. A case study is a deck of screens; a walkthrough is
// stepped copy beside a live demo. `kind` tells them apart, and is absent on
// everything saved before walkthroughs existed — so absent means case study.

export const SCHEMA_VERSION = 2;

export type ProjectKind = "case-study" | "walkthrough";

export type ProjectContent = CaseStudyContent | WalkthroughContent;

export const isWalkthrough = (project: ProjectContent): project is WalkthroughContent => project.kind === "walkthrough";

/** Bring any saved project up to the current shape. Never throws: unknown or
 * empty input falls back to the starter deck. Version 1 and the unversioned
 * projects before it need no field changes — version 2 only added `kind`, and
 * a case study is what a project without one is. Legacy screens without a
 * `theme` keep their look at render time (see screenTheme). */
export function migrate(raw: unknown): ProjectContent {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CONTENT, kind: "case-study", schemaVersion: SCHEMA_VERSION };
  const p = raw as Partial<ProjectContent>;
  return p.kind === "walkthrough" ? walkthrough(p as Partial<WalkthroughContent>) : caseStudy(p as Partial<CaseStudyContent>);
}

function caseStudy(p: Partial<CaseStudyContent>): CaseStudyContent {
  const screens = Array.isArray(p.screens) && p.screens.length ? p.screens : DEFAULT_CONTENT.screens;
  return { ...p, kind: "case-study", screens, schemaVersion: SCHEMA_VERSION };
}

/** A walkthrough with nothing authored yet is left empty rather than filled
 * with a starter: its steps only mean anything next to its own demo. */
function walkthrough(p: Partial<WalkthroughContent>): WalkthroughContent {
  const target = p.target && typeof p.target === "object" ? p.target : { src: "" };
  return {
    ...p,
    kind: "walkthrough",
    target: { ...target, src: typeof target.src === "string" ? target.src : "" },
    steps: Array.isArray(p.steps) ? p.steps : [],
    schemaVersion: SCHEMA_VERSION,
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
  return (step: WalkthroughStep): WalkthroughStep => ({ ...step, imageUrl: abs(step.imageUrl) });
};

const previewWithAssetBase = (base: string) => {
  const abs = absolutizer(base);
  return (pv?: ProjectPreview) => pv && { ...pv, image: abs(pv.image), logo: abs(pv.logo), cardLogo: abs(pv.cardLogo) };
};

/** Rewrite every site-relative asset path in a project to an absolute URL on
 * `base` (e.g. "https://www.tomcoggia.com"), so it renders from another origin.
 * Absolute URLs and empty fields are left alone. Returns a new object.
 *
 * A walkthrough's demo is pinned the same way. That makes the stored path
 * honest about where the demo lives, and leaves it to the player to notice the
 * demo is no longer same-origin and say so — it can only drive one it can read. */
export function withAssetBase<T extends ProjectContent>(project: T, base: string): T {
  const preview = previewWithAssetBase(base)(project.preview);
  if (isWalkthrough(project)) {
    const abs = absolutizer(base);
    const target = (t: WalkthroughTarget) => ({ ...t, src: abs(t.src) ?? "" });
    const next: WalkthroughContent = {
      ...project,
      preview,
      target: target(project.target),
      targets: project.targets && Object.fromEntries(Object.entries(project.targets).map(([name, t]) => [name, target(t)])),
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
