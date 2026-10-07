import type { CaseStudyContent } from "./core.js";
export declare const SCHEMA_VERSION = 1;
/** Bring any saved project up to the current shape. Never throws: unknown or
 * empty input falls back to the starter deck. Older projects (saved before
 * `schemaVersion` existed) are version 0 and need no field changes. Legacy
 * screens without a `theme` keep their look at render time (see screenTheme). */
export declare function migrate(raw: unknown): CaseStudyContent;
/** Rewrite every site-relative asset path in a project to an absolute URL on
 * `base` (e.g. "https://www.tomcoggia.com"), so it renders from another origin.
 * Absolute URLs and empty fields are left alone. Returns a new object. */
export declare function withAssetBase(project: CaseStudyContent, base: string): CaseStudyContent;
/** Fetch a project file and migrate it. With `assetBase`, relative asset paths
 * are pinned to that origin (use it for projects hosted by another site). */
export declare function loadProject(url: string, opts?: {
    assetBase?: string;
    signal?: AbortSignal;
}): Promise<CaseStudyContent>;
/** The preview card a project authors for itself (props for ProjectPreviewCard),
 * plus its show-on-index flag (default true). The card logo falls back to the
 * slide logo. */
export declare function previewCard(project: CaseStudyContent): {
    image: string | undefined;
    imageOverlay: boolean | undefined;
    eyebrow: string | undefined;
    title: string | undefined;
    body: string | undefined;
    logo: string | undefined;
    show: boolean;
};
