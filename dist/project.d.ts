import type { CaseStudyContent, ProjectPreview, Screen } from "./core.js";
import type { WalkthroughContent } from "./walkthrough/types.js";
export declare const SCHEMA_VERSION = 2;
export type ProjectKind = "case-study" | "walkthrough";
export type ProjectContent = CaseStudyContent | WalkthroughContent;
export declare const isWalkthrough: (project: ProjectContent) => project is WalkthroughContent;
/** Bring any saved project up to the current shape. Never throws: unknown or
 * empty input falls back to the starter deck. Version 1 and the unversioned
 * projects before it need no field changes — version 2 only added `kind`, and
 * a case study is what a project without one is. Legacy screens without a
 * `theme` keep their look at render time (see screenTheme). */
export declare function migrate(raw: unknown): ProjectContent;
/** Rewrite every site-relative asset path in a project to an absolute URL on
 * `base` (e.g. "https://www.tomcoggia.com"), so it renders from another origin.
 * Absolute URLs and empty fields are left alone. Returns a new object.
 *
 * A walkthrough's demo is pinned the same way. That makes the stored path
 * honest about where the demo lives, and leaves it to the player to notice the
 * demo is no longer same-origin and say so — it can only drive one it can read. */
export declare function withAssetBase<T extends ProjectContent>(project: T, base: string): T;
/** Fetch a project file and migrate it. With `assetBase`, relative asset paths
 * are pinned to that origin (use it for projects hosted by another site). */
export declare function loadProject(url: string, opts?: {
    assetBase?: string;
    signal?: AbortSignal;
}): Promise<ProjectContent>;
/** The preview card a project authors for itself (props for ProjectPreviewCard).
 * The card logo falls back to the slide logo. */
export declare function previewCard(project: ProjectContent): {
    image: string | undefined;
    imageOverlay: boolean | undefined;
    eyebrow: string | undefined;
    title: string | undefined;
    body: string | undefined;
    logo: string | undefined;
};
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
    draft: boolean;
    updatedAt: number;
    /** @deprecated Use `count`. Screens only, so a walkthrough reports 0. */
    screens: number;
}
/** Projects published by a ProjectBuilder site at `base` (e.g.
 * "https://projects.tomcoggia.com"; "" for the same origin). Asset paths come
 * back absolute, so images load from that site. Which projects a site shows is
 * the site's choice; publishing only makes them available. */
export declare function projectSource(base: string): {
    url: (id: string) => string;
    /** Every published project, newest first. */
    list(opts?: {
        signal?: AbortSignal;
    }): Promise<ProjectSummary[]>;
    get: (id: string, opts?: {
        signal?: AbortSignal;
    }) => Promise<ProjectContent>;
};
export type ProjectSource = ReturnType<typeof projectSource>;
