import { DEFAULT_CONTENT } from "./core.js";
import type { CaseStudyContent, Screen } from "./core.js";

// ─── Project files ─────────────────────────────────────────────────
// A project is one JSON object (CaseStudyContent). These helpers make that
// object safe to move between apps: versioned, migrated on load, and with
// site-relative asset paths ("/images/…") pinned to the site they came from.

export const SCHEMA_VERSION = 1;

/** Bring any saved project up to the current shape. Never throws: unknown or
 * empty input falls back to the starter deck. Older projects (saved before
 * `schemaVersion` existed) are version 0 and need no field changes. Legacy
 * screens without a `theme` keep their look at render time (see screenTheme). */
export function migrate(raw: unknown): CaseStudyContent {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CONTENT, schemaVersion: SCHEMA_VERSION };
  const p = raw as Partial<CaseStudyContent>;
  const screens = Array.isArray(p.screens) && p.screens.length ? p.screens : DEFAULT_CONTENT.screens;
  return { ...p, screens, schemaVersion: SCHEMA_VERSION };
}

const isRelative = (u?: string) => !!u && u.startsWith("/") && !u.startsWith("//");

/** Rewrite every site-relative asset path in a project to an absolute URL on
 * `base` (e.g. "https://www.tomcoggia.com"), so it renders from another origin.
 * Absolute URLs and empty fields are left alone. Returns a new object. */
export function withAssetBase(project: CaseStudyContent, base: string): CaseStudyContent {
  const root = base.replace(/\/+$/, "");
  const abs = (u?: string) => (isRelative(u) ? root + u : u);
  const screen = (s: Screen): Screen => ({
    ...s,
    imageUrl: abs(s.imageUrl),
    imageUrl2: abs(s.imageUrl2),
    videoUrl: abs(s.videoUrl),
    images: s.images?.map((img) => ({ ...img, url: abs(img.url) ?? "" })),
  });
  const pv = project.preview;
  return {
    ...project,
    screens: project.screens.map(screen),
    preview: pv && { ...pv, image: abs(pv.image), logo: abs(pv.logo), cardLogo: abs(pv.cardLogo) },
  };
}

/** Fetch a project file and migrate it. With `assetBase`, relative asset paths
 * are pinned to that origin (use it for projects hosted by another site). */
export async function loadProject(url: string, opts: { assetBase?: string; signal?: AbortSignal } = {}): Promise<CaseStudyContent> {
  const res = await fetch(url, { signal: opts.signal });
  if (!res.ok) throw new Error(`Couldn't load project (${res.status}): ${url}`);
  const project = migrate(await res.json());
  return opts.assetBase ? withAssetBase(project, opts.assetBase) : project;
}

/** The preview card a project authors for itself (props for ProjectPreviewCard),
 * plus its show-on-index flag (default true). The card logo falls back to the
 * slide logo. */
export function previewCard(project: CaseStudyContent) {
  const p = project.preview ?? {};
  return {
    image: p.image, imageOverlay: p.imageOverlay, eyebrow: p.eyebrow, title: p.title, body: p.body,
    logo: p.cardLogo || p.logo, show: p.show !== false,
  };
}
