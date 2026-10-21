import { DEFAULT_CONTENT } from "./core.js";
// ─── Project files ─────────────────────────────────────────────────
// A project is one JSON object. These helpers make that object safe to move
// between apps: versioned, migrated on load, and with site-relative asset paths
// ("/images/…") pinned to the site they came from.
//
// There are two kinds. A case study is a deck of screens; a walkthrough is
// stepped copy beside a live demo. `kind` tells them apart, and is absent on
// everything saved before walkthroughs existed — so absent means case study.
export const SCHEMA_VERSION = 2;
export const isWalkthrough = (project) => project.kind === "walkthrough";
/** Bring any saved project up to the current shape. Never throws: unknown or
 * empty input falls back to the starter deck. Version 1 and the unversioned
 * projects before it need no field changes — version 2 only added `kind`, and
 * a case study is what a project without one is. Legacy screens without a
 * `theme` keep their look at render time (see screenTheme). */
export function migrate(raw) {
    if (!raw || typeof raw !== "object")
        return { ...DEFAULT_CONTENT, kind: "case-study", schemaVersion: SCHEMA_VERSION };
    const p = raw;
    return p.kind === "walkthrough" ? walkthrough(p) : caseStudy(p);
}
function caseStudy(p) {
    const screens = Array.isArray(p.screens) && p.screens.length ? p.screens : DEFAULT_CONTENT.screens;
    return { ...p, kind: "case-study", screens, schemaVersion: SCHEMA_VERSION };
}
/** A walkthrough with nothing authored yet is left empty rather than filled
 * with a starter: its steps only mean anything next to its own demo. */
function walkthrough(p) {
    const target = p.target && typeof p.target === "object" ? p.target : { src: "" };
    return {
        ...p,
        kind: "walkthrough",
        target: { ...target, src: typeof target.src === "string" ? target.src : "" },
        steps: Array.isArray(p.steps) ? p.steps : [],
        schemaVersion: SCHEMA_VERSION,
    };
}
const isRelative = (u) => !!u && u.startsWith("/") && !u.startsWith("//");
const absolutizer = (base) => {
    const root = base.replace(/\/+$/, "");
    return (u) => (isRelative(u) ? root + u : u);
};
const screenWithAssetBase = (base) => {
    const abs = absolutizer(base);
    return (s) => ({
        ...s,
        imageUrl: abs(s.imageUrl),
        imageUrl2: abs(s.imageUrl2),
        videoUrl: abs(s.videoUrl),
        images: s.images?.map((img) => ({ ...img, url: abs(img.url) ?? "" })),
    });
};
const stepWithAssetBase = (base) => {
    const abs = absolutizer(base);
    return (step) => ({ ...step, imageUrl: abs(step.imageUrl) });
};
const previewWithAssetBase = (base) => {
    const abs = absolutizer(base);
    return (pv) => pv && { ...pv, image: abs(pv.image), logo: abs(pv.logo), cardLogo: abs(pv.cardLogo) };
};
/** Rewrite every site-relative asset path in a project to an absolute URL on
 * `base` (e.g. "https://www.tomcoggia.com"), so it renders from another origin.
 * Absolute URLs and empty fields are left alone. Returns a new object.
 *
 * A walkthrough's demo is pinned the same way. That makes the stored path
 * honest about where the demo lives, and leaves it to the player to notice the
 * demo is no longer same-origin and say so — it can only drive one it can read. */
export function withAssetBase(project, base) {
    const preview = previewWithAssetBase(base)(project.preview);
    if (isWalkthrough(project)) {
        const abs = absolutizer(base);
        const next = {
            ...project,
            preview,
            target: { ...project.target, src: abs(project.target.src) ?? "" },
            steps: project.steps.map(stepWithAssetBase(base)),
        };
        return next;
    }
    const next = { ...project, preview, screens: project.screens.map(screenWithAssetBase(base)) };
    return next;
}
/** Fetch a project file and migrate it. With `assetBase`, relative asset paths
 * are pinned to that origin (use it for projects hosted by another site). */
export async function loadProject(url, opts = {}) {
    const res = await fetch(url, { signal: opts.signal });
    if (!res.ok)
        throw new Error(`Couldn't load project (${res.status}): ${url}`);
    const project = migrate(await res.json());
    return opts.assetBase ? withAssetBase(project, opts.assetBase) : project;
}
/** The preview card a project authors for itself (props for ProjectPreviewCard).
 * The card logo falls back to the slide logo. */
export function previewCard(project) {
    const p = project.preview ?? {};
    return {
        image: p.image, imageOverlay: p.imageOverlay, eyebrow: p.eyebrow, title: p.title, body: p.body,
        logo: p.cardLogo || p.logo,
    };
}
/** Projects published by a ProjectBuilder site at `base` (e.g.
 * "https://projects.tomcoggia.com"; "" for the same origin). Asset paths come
 * back absolute, so images load from that site. Which projects a site shows is
 * the site's choice; publishing only makes them available. */
export function projectSource(base) {
    const root = base.replace(/\/+$/, "");
    const url = (id) => `${root}/projects/${id}/project.json`;
    return {
        url,
        /** Every published project, newest first. */
        async list(opts = {}) {
            const res = await fetch(`${root}/projects/index.json`, { signal: opts.signal, cache: "no-cache" });
            if (!res.ok)
                throw new Error(`Couldn't list projects (${res.status}): ${root}`);
            const rows = await res.json();
            const screen = screenWithAssetBase(root);
            const preview = previewWithAssetBase(root);
            return rows.map((row) => ({ ...row, cover: row.cover && screen(row.cover), preview: preview(row.preview ?? undefined) ?? null }));
        },
        get: (id, opts = {}) => loadProject(url(id), { ...opts, assetBase: root }),
    };
}
//# sourceMappingURL=project.js.map