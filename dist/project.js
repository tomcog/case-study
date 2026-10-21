import { DEFAULT_CONTENT } from "./core.js";
// ─── Project files ─────────────────────────────────────────────────
// A project is one JSON object. These helpers make that object safe to move
// between apps: versioned, migrated on load, and with site-relative asset paths
// ("/images/…") pinned to the site they came from.
//
// There are two kinds. A case study is a deck of screens; a walkthrough is
// stepped copy beside a stage. `kind` tells them apart, and is absent on
// everything saved before walkthroughs existed — so absent means case study.
export const SCHEMA_VERSION = 4;
export const isWalkthrough = (project) => project.kind === "walkthrough";
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
 * with a starter: its steps only mean anything next to the app they run. */
function walkthrough(raw) {
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
function legacyStages(raw) {
    if (Array.isArray(raw.stages))
        return raw.stages.filter((s) => !!s && typeof s === "object");
    const out = [];
    if (raw.target && typeof raw.target === "object")
        out.push({ id: "app", kind: "code", ...raw.target });
    for (const [name, t] of Object.entries(raw.targets ?? {})) {
        if (t && typeof t === "object")
            out.push({ id: name, label: name, kind: "code", ...t });
    }
    return out;
}
/** Which shared record a step resolved to under the old rules: the nearest one
 * named at or before it, falling back to the first. */
function legacyStageFor(steps, index, stages) {
    for (let i = Math.min(index, steps.length - 1); i >= 0; i--) {
        const named = steps[i].enter;
        const id = named?.stage ?? named?.app;
        if (id)
            return stages.find((st) => st.id === id) ?? stages[0];
    }
    return stages[0];
}
/** A step with the old shared record folded into it. What it ran becomes its
 * own `app`, what it showed becomes its own `content`, and the seed is dropped
 * — an app now opens in its default state for the screen it opens on. */
function foldStep(raw, steps, index, stages) {
    const { enter, stage: legacyStill, still, ...step } = raw;
    const record = legacyStageFor(steps, index, stages);
    const cover = still ?? legacyStill;
    const kind = record?.kind === "embed" || record?.kind === "mock" ? record.kind : "code";
    let app;
    let content;
    if (kind === "code") {
        app = record?.id;
        if (cover?.src)
            content = { kind: "image", src: cover.src, fit: cover.fit };
    }
    else if (kind === "embed") {
        content = { kind: "embed", url: record?.src ?? "", width: record?.width, minWidth: record?.minWidth };
    }
    else {
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
function plainStep(raw) {
    const { enter, stage: legacyStill, still, ...step } = raw;
    const cover = still ?? legacyStill;
    return {
        ...step,
        start: step.start ?? enter?.path,
        content: step.content ?? (cover?.src ? { kind: "image", src: cover.src, fit: cover.fit } : undefined),
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
    return (step) => ({
        ...step,
        imageUrl: abs(step.imageUrl),
        content: step.content?.kind === "image"
            ? { ...step.content, src: abs(step.content.src) ?? "" }
            : step.content?.kind === "embed"
                ? { ...step.content, url: abs(step.content.url) ?? "" }
                : step.content,
    });
};
const previewWithAssetBase = (base) => {
    const abs = absolutizer(base);
    return (pv) => pv && { ...pv, image: abs(pv.image), logo: abs(pv.logo), cardLogo: abs(pv.cardLogo) };
};
/** Rewrite every site-relative asset path in a project to an absolute URL on
 * `base` (e.g. "https://www.tomcoggia.com"), so it renders from another origin.
 * Absolute URLs and empty fields are left alone. Returns a new object.
 *
 * A walkthrough's own images and embeds are pinned the same way. The apps it
 * runs are not: a step stores an app's id, and where that app is served from
 * is the host's to say, since the pool is shared across projects. */
export function withAssetBase(project, base) {
    const preview = previewWithAssetBase(base)(project.preview);
    if (isWalkthrough(project)) {
        const next = { ...project, preview, steps: project.steps.map(stepWithAssetBase(base)) };
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