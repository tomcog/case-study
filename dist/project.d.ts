import type { ProjectPreview, Screen } from "./core.js";
import type { WalkthroughContent } from "./walkthrough/types.js";
export declare const SCHEMA_VERSION = 6;
export type ProjectContent = WalkthroughContent;
/** An app ingested into the shared pool: a snapshot of someone's built output,
 * copied in and served from this site. Steps reference the `id`, so renaming
 * the label leaves them alone; `src` is where its entry file is served from,
 * which a site hosting them elsewhere makes absolute. */
export interface IngestedApp {
    id: string;
    label: string;
    src: string;
    /** The range of viewport widths to give it, in px. The app takes the pane's
     * width and reflows as the step affords it more or less room, but never
     * below `minWidth` or above `maxWidth`. It is never scaled: a pane narrower
     * than the floor scrolls sideways, and one wider than the ceiling centers
     * the app in it. Either unset leaves that side open. */
    minWidth?: number;
    maxWidth?: number;
    /** The narrowest reader window worth running a demo in; 900 when unset.
     * Below it the player drops the frame and shows the copy alone. Unrelated
     * to the two above: this one is measured against the browser window, not
     * the pane. All three belong to the app rather than to each step. */
    minWindow?: number;
    /** Kept out of the pickers, in every project, without being removed. A step
     * already running it keeps running it — hiding is how an app is retired
     * from new use, and deleting is the only thing that breaks a project. */
    hidden?: boolean;
    ingestedAt?: number;
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
export declare function migrate(raw: unknown): ProjectContent;
/** Rewrite every site-relative asset path in a project to an absolute URL on
 * `base` (e.g. "https://www.tomcoggia.com"), so it renders from another origin.
 * Absolute URLs and empty fields are left alone. Returns a new object.
 *
 * A step's own images, embeds and slides are pinned the same way. The apps it
 * runs are not: a step stores an app's id, and where that app is served from
 * is the host's to say, since the pool is shared across projects. */
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
    imageMono: boolean | undefined;
    eyebrow: string | undefined;
    title: string | undefined;
    body: string | undefined;
    logo: string | undefined;
};
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
    draft: boolean;
    updatedAt: number;
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
    }) => Promise<WalkthroughContent>;
    /** The apps those projects run, with their addresses made absolute. A step
     * stores only an app's id, so a site rendering someone else's projects has
     * to be handed the pool to resolve them against.
     *
     * An app served from another origin can be shown but not driven — the
     * player says so rather than sitting there — so a project whose steps run
     * apps is fully itself only on the site that serves them. */
    apps(opts?: {
        signal?: AbortSignal;
    }): Promise<IngestedApp[]>;
};
export type ProjectSource = ReturnType<typeof projectSource>;
