import { DEFAULT_CONTENT } from "./core.js";
// ─── Project files ─────────────────────────────────────────────────
// A project is one JSON object. These helpers make that object safe to move
// between apps: versioned, migrated on load, and with site-relative asset paths
// ("/images/…") pinned to the site they came from.
//
// There are two kinds. A case study is a deck of screens; a walkthrough is
// stepped copy beside a stage. `kind` tells them apart, and is absent on
// everything saved before walkthroughs existed — so absent means case study.
export const SCHEMA_VERSION = 3;
export const isWalkthrough = (project) => project.kind === "walkthrough";
/** Bring any saved project up to the current shape. Never throws: unknown or
 * empty input falls back to the starter deck. Version 1 and the unversioned
 * projects before it need no field changes — version 2 only added `kind`, and
 * a case study is what a project without one is. Version 3 is walkthroughs
 * only: the privileged `target` and the named `targets` beside it became one
 * flat `stages` list, with `enter.app` becoming `enter.stage`. Legacy screens
 * without a `theme` keep their look at render time (see screenTheme). */
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
 * with a starter: its steps only mean anything next to its own stages. */
function walkthrough(raw) {
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
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
/** A readable id for a demo folded in from the old shape: the folder its build
 * sits in, which is what an author would have called it anyway. */
function idFromSrc(src, taken) {
    const parts = (src.split("?")[0] ?? "").split("/").filter(Boolean);
    const last = parts[parts.length - 1] ?? "";
    const folder = /\.[a-z0-9]+$/i.test(last) ? (parts[parts.length - 2] ?? "") : last;
    const base = slug(folder);
    let id = !base || base === "demo" ? "app" : base;
    for (let n = 2; taken.has(id); n++)
        id = `${base || "app"}-${n}`;
    taken.add(id);
    return id;
}
const cleanStage = (s, fallbackId) => ({
    ...s,
    id: typeof s.id === "string" && s.id ? s.id : fallbackId,
    kind: s.kind === "embed" || s.kind === "mock" ? s.kind : "code",
    src: typeof s.src === "string" ? s.src : "",
});
/** The stages a saved walkthrough has, or the old `target` + `targets` folded
 * into the same list. The old default goes first, which keeps a walkthrough
 * that never named an app opening exactly where it used to. */
function foldStages(raw) {
    if (Array.isArray(raw.stages)) {
        const taken = new Set();
        return raw.stages
            .filter((s) => !!s && typeof s === "object")
            .map((s) => cleanStage(s, idFromSrc(typeof s.src === "string" ? s.src : "", taken)));
    }
    const taken = new Set();
    const out = [];
    const fold = (t, label) => {
        const src = typeof t.src === "string" ? t.src : "";
        const id = label ? uniq(slug(label) || "app", taken) : idFromSrc(src, taken);
        out.push({ id, label: label ?? undefined, kind: "code", src, width: t.width, minWidth: t.minWidth });
    };
    if (raw.target && typeof raw.target === "object")
        fold(raw.target);
    for (const [name, t] of Object.entries(raw.targets ?? {})) {
        if (t && typeof t === "object")
            fold(t, name);
    }
    return out;
}
function uniq(id, taken) {
    let out = id;
    for (let n = 2; taken.has(out); n++)
        out = `${id}-${n}`;
    taken.add(out);
    return out;
}
/** Old `enter.app` names, mapped to the stage ids they became. */
function legacyNames(raw, stages) {
    const map = new Map();
    if (Array.isArray(raw.stages))
        return map;
    // The default was first, so the named ones line up with the rest in order.
    const named = Object.keys(raw.targets ?? {});
    const offset = raw.target && typeof raw.target === "object" ? 1 : 0;
    named.forEach((name, i) => {
        const stage = stages[offset + i];
        if (stage)
            map.set(name, stage.id);
    });
    return map;
}
/** A step in the current shape. `enter.app` named a demo that may not have
 * existed — "default" among them — and that always meant the default one, so
 * anything unresolved becomes the first stage rather than nothing. */
function foldStep(raw, names, first) {
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
        still: step.still && { ...step.still, src: abs(step.still.src) ?? "" },
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
 * A walkthrough's stages are pinned the same way. That makes the stored path
 * honest about where each one lives, and leaves it to the player to notice a
 * demo is no longer same-origin and say so — it can only drive one it can read. */
export function withAssetBase(project, base) {
    const preview = previewWithAssetBase(base)(project.preview);
    if (isWalkthrough(project)) {
        const abs = absolutizer(base);
        const next = {
            ...project,
            preview,
            stages: project.stages.map((s) => ({ ...s, src: abs(s.src) ?? "" })),
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