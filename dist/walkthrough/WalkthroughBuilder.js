import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ─── The walkthrough builder (edit mode) ───────────────────────────
// Same shape as the case-study builder — rail, canvas, inspector — but the
// canvas is the stage rather than a screen, so what you author is what plays.
// Selecting a step puts its stage into the state that step describes.
//
// Stages are edited in one place, from the toolbar, because a stage belongs to
// the walkthrough and not to the step you happen to have selected: several
// steps run in one, and an address typed into a step's inspector would quietly
// move all of them. A step only ever picks which stage it runs in.
//
// On a driveable stage, marks are picked by clicking the product: it is
// same-origin, so the builder can read what was clicked and say when an
// element has no data-walkthrough id to point at yet. On an opaque one there
// is nothing to read, so the author drags the rectangle instead.
import { useEffect, useMemo, useState } from "react";
import { Reorder } from "motion/react";
import { ChevronDown, ChevronUp, Copy, Crosshair, Image as ImageIcon, LayoutGrid, Layers, Play, Plus, Square, Trash2, X } from "lucide-react";
import { ACCENT, Stage, ScreenView, bleedBg, backdropFor } from "../core.js";
import { SlideFields, newScreen } from "../slide.js";
import { Field, ImageField, PreviewCardSettings, inputStyle } from "../editors.js";
import { Button, ButtonRound, Segment, SegmentedControl } from "@tomcoggia/ui";
import { WalkthroughPlayer, marksOf } from "./WalkthroughPlayer.js";
import { AreaDraw, Callouts, HoverOutline, Spotlight, StageNotice, StageStill, areaBox, toBox, useApp } from "./stage.js";
import { appRuns, bootsApp, contentOf, stepMarks } from "./types.js";
const ADVANCE_KINDS = [
    { value: "manual", label: "A button", hint: "The reader presses Next in the panel." },
    { value: "click", label: "A click", hint: "The reader clicks a marked element in the app." },
    { value: "path", label: "A route", hint: "The app navigates to a hash route." },
    { value: "signal", label: "A signal", hint: "The app fires wt:signal with this name." },
    { value: "any", label: "Any of…", hint: "Whichever of these happens first." },
];
const CONTENT_KINDS = [
    { value: "app", label: "The app", hint: "The app this step is running. The reader uses it, and the step can watch what they do." },
    { value: "embed", label: "A URL", hint: "Any page in a frame — a Figma prototype, a live site. The reader can click inside it; nothing out here can see them do it." },
    { value: "image", label: "An image", hint: "A still. Whatever the step is running keeps running behind it." },
    { value: "slide", label: "A slide", hint: "A composed slide, full screen. It carries its own copy, so the panel steps aside for it." },
];
const uid = () => `step-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
const newStep = () => ({
    id: uid(),
    eyebrow: "Step",
    title: "New step",
    body: "What should the reader do here?",
    advance: { on: "manual" },
});
const appName = (apps, id) => !id ? "No app" : (apps.find((a) => a.id === id)?.label ?? id);
export function WalkthroughBuilder({ content, setContent, apps = [], onIngestApp, onPatchApp, onDeleteApp, projectName, onClose }) {
    const [selected, setSelected] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [showThumb, setShowThumb] = useState(false);
    const [showApps, setShowApps] = useState(false);
    const [picking, setPicking] = useState(null);
    const [drawing, setDrawing] = useState(null);
    const [hover, setHover] = useState(null);
    const [warning, setWarning] = useState(null);
    const steps = content.steps;
    const index = Math.min(selected, Math.max(0, steps.length - 1));
    const step = steps[index];
    const markIds = useMemo(() => stepMarks(step), [step]);
    const spotMarks = useMemo(() => marksOf(step?.spotlight?.mark), [step]);
    // The app the selected step runs, and what it displays over it.
    const app = useMemo(() => apps.find((a) => a.id === step?.app), [apps, step?.app]);
    const shown = contentOf(step);
    const demo = useApp(app?.src, markIds, app);
    const { driver } = demo;
    const runs = useMemo(() => appRuns(steps), [steps]);
    const runStarts = useMemo(() => new Map(runs.map((r) => [r.from, r])), [runs]);
    const boots = bootsApp(steps, index);
    // Only a running app can be read into. An image or a URL anchors by
    // rectangle, and the reader leaves it with the panel's button.
    const driveable = demo.live && !!driver && shown.kind === "app";
    const opaque = shown.kind !== "app";
    const update = (patch) => setContent((prev) => ({ ...prev, steps: prev.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));
    // ── The pool ──
    // Ingesting and renaming reach the filesystem, so they are the host's to do;
    // the panel only collects what they need and reports what went wrong.
    const [appError, setAppError] = useState(null);
    const report = (p) => void p.then(() => setAppError(null), (err) => setAppError(err.message));
    // ── Steps ──
    const patchCallout = (at, patch) => update({ callouts: (step.callouts ?? []).map((c, i) => (i === at ? { ...c, ...patch } : c)) });
    /** Edit the slide this step displays, if it displays one. */
    const patchSlide = (patch) => update({ content: shown.kind === "slide" ? { kind: "slide", screen: { ...shown.screen, ...patch } } : shown });
    const patchAction = (at, action) => update({ actions: (step.actions ?? []).map((a, i) => (i === at ? action : a)) });
    const addCallout = () => update({ callouts: [...(step.callouts ?? []), { text: "Describe this element." }] });
    const removeCallout = (at) => update({ callouts: (step.callouts ?? []).filter((_, i) => i !== at) });
    const addStep = () => {
        setContent((prev) => {
            const next = [...prev.steps];
            next.splice(index + 1, 0, newStep());
            return { ...prev, steps: next };
        });
        setSelected(index + 1);
    };
    const duplicateStep = () => {
        setContent((prev) => {
            const next = [...prev.steps];
            next.splice(index + 1, 0, { ...prev.steps[index], id: uid() });
            return { ...prev, steps: next };
        });
        setSelected(index + 1);
    };
    const deleteStep = () => {
        if (steps.length <= 1)
            return;
        setContent((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }));
        setSelected(Math.max(0, index - 1));
    };
    const move = (delta) => {
        const to = index + delta;
        if (to < 0 || to >= steps.length)
            return;
        setContent((prev) => {
            const next = [...prev.steps];
            const [s] = next.splice(index, 1);
            next.splice(to, 0, s);
            return { ...prev, steps: next };
        });
        setSelected(to);
    };
    // A starting screen is a hash route inside the app: "#/orders". An address
    // pasted here still applies — as a hash on the app the step is already
    // running — so nothing throws and the app never changes. Catch the shapes an
    // address takes: a file, a full URL, or a hash that isn't rooted at "/".
    const start = step?.start ?? "";
    const route = start.replace(/^#/, "");
    const misroute = !!start && (!route.startsWith("/") || route.includes(".html") || start.includes("://"));
    // Selecting a step shows it the way a reader arriving at it would: booted at
    // its starting screen, with its actions performed. Editing the step's copy
    // must not reload the app, so this watches the app and the screen only.
    const actionKey = JSON.stringify(step?.actions ?? []);
    useEffect(() => {
        if (!driver || !step)
            return;
        let live = true;
        const timers = [];
        void (async () => {
            await driver.open(step.start, { reload: true });
            if (!live)
                return;
            for (const action of step.actions ?? []) {
                if (!live)
                    return;
                if (action.do === "wait")
                    await new Promise((r) => setTimeout(r, action.ms));
                else if (action.do === "click")
                    driver.click(action.mark);
                else
                    driver.type(action.mark, action.text);
            }
            if (!live)
                return;
            const first = marksOf(step.spotlight?.mark)[0];
            if (first)
                driver.reveal(first);
            demo.measure();
            timers.push(window.setTimeout(demo.measure, 160), window.setTimeout(demo.measure, 480));
        })();
        return () => {
            live = false;
            timers.forEach((t) => clearTimeout(t));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [driver, index, start, actionKey]);
    const applyMark = (slot, mark) => {
        if (slot.field === "spotlight") {
            update({ spotlight: { ...(step.spotlight ?? {}), mark, area: undefined } });
            return;
        }
        if (slot.field === "callout") {
            update({ callouts: (step.callouts ?? []).map((c, i) => (i === slot.at ? { ...c, mark, area: undefined } : c)) });
            return;
        }
        if (slot.field === "advance") {
            update({ advance: { on: "click", mark } });
            return;
        }
        if (slot.field === "action") {
            const action = step.actions?.[slot.at];
            if (action && action.do !== "wait")
                patchAction(slot.at, { ...action, mark });
            return;
        }
        const advance = step.advance;
        if (advance.on !== "any")
            return;
        update({ advance: { ...advance, of: advance.of.map((a, i) => (i === slot.at ? { on: "click", mark } : a)) } });
    };
    const applyArea = (slot, area) => {
        if (slot.field === "spotlight")
            update({ spotlight: { ...(step.spotlight ?? {}), area, mark: undefined } });
        if (slot.field === "callout") {
            update({ callouts: (step.callouts ?? []).map((c, i) => (i === slot.at ? { ...c, area, mark: undefined } : c)) });
        }
    };
    // Pick mode: the driver swallows the demo's own interactions and reports
    // what was pointed at instead.
    useEffect(() => {
        if (!driver)
            return;
        driver.setPicking(!!picking);
        if (!picking)
            return;
        const offPick = driver.onPick((hit) => {
            if (!hit.mark) {
                setWarning(`That ${hit.label} has no data-walkthrough id. Add one in the app, then pick it again.`);
                return;
            }
            applyMark(picking, hit.mark);
            setWarning(null);
            setPicking(null);
        });
        const offHover = driver.onHover(setHover);
        return () => {
            offPick();
            offHover();
            driver.setPicking(false);
            setHover(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [driver, picking, step]);
    useEffect(() => {
        if (!picking)
            return;
        const onKey = (e) => e.key === "Escape" && setPicking(null);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [picking]);
    const box = useMemo(() => {
        const spot = step?.spotlight;
        if (!spot)
            return null;
        if (spot.area)
            return areaBox(spot.area, demo.bounds);
        return toBox(spotMarks.map((id) => demo.rects[id]).filter(Boolean), demo.scale, spot.pad ?? 6);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [demo.rects, spotMarks.join("|"), demo.scale, demo.bounds, step]);
    const calloutBox = (callout) => {
        if (callout.area)
            return areaBox(callout.area, demo.bounds);
        const rect = callout.mark ? demo.rects[callout.mark] : undefined;
        return rect ? toBox([rect], demo.scale, 0) : null;
    };
    const hoverBox = hover && toBox([hover.rect], demo.scale, 2);
    const overlaid = !!picking || !!drawing;
    if (playing) {
        return _jsx(WalkthroughPlayer, { content: content, apps: apps, startIndex: index, onExit: () => setPlaying(false) });
    }
    if (!step) {
        return (_jsx("div", { style: shell, children: _jsxs("div", { style: { margin: "auto", textAlign: "center", color: "#5a554e" }, children: [_jsx("p", { style: { marginBottom: 14 }, children: "This walkthrough has no steps yet." }), _jsx(Button, { variant: "primary", icon: _jsx(Plus, { size: 16 }), onClick: addStep, style: { margin: "0 auto" }, children: "Add the first step" })] }) }));
    }
    return (_jsxs("div", { style: shell, children: [_jsxs("div", { style: toolbar, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 15 }, children: [_jsx(LayoutGrid, { size: 18, style: { color: ACCENT } }), " Walkthrough Builder", projectName && (_jsxs(_Fragment, { children: [_jsx("span", { style: { color: "#cfcbc4", fontWeight: 400 }, children: "/" }), _jsx("span", { style: { color: "#5a554e", fontWeight: 600 }, children: projectName })] }))] }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, position: "relative" }, children: [onIngestApp && (_jsxs(Button, { variant: "tertiary", icon: _jsx(Layers, { size: 16 }), onClick: () => setShowApps((v) => !v), title: "The apps any walkthrough can run", children: ["Apps ", _jsx("span", { style: { opacity: 0.6, fontWeight: 400 }, children: apps.length })] })), _jsx(Button, { variant: "tertiary", icon: _jsx(ImageIcon, { size: 16 }), onClick: () => setShowThumb((v) => !v), title: "Projects page preview card", children: "Project settings" }), _jsx(Button, { variant: "primary", icon: _jsx(Play, { size: 16 }), onClick: () => setPlaying(true), children: "Preview" }), onClose && _jsx(Button, { variant: "secondary", onClick: onClose, children: "Done" }), showApps && onIngestApp && (_jsx(AppsPanel, { apps: apps, steps: steps, error: appError, onIngest: (path, label) => report(onIngestApp(path, label)), onPatch: onPatchApp && ((id, patch) => report(onPatchApp(id, patch))), onDelete: onDeleteApp && ((id) => report(onDeleteApp(id))), onClose: () => setShowApps(false) })), showThumb && (_jsx(PreviewCardSettings, { preview: content.preview ?? {}, onChange: (patch) => setContent((prev) => ({ ...prev, preview: { ...prev.preview, ...patch } })), onClose: () => setShowThumb(false) }))] })] }), _jsxs("div", { style: { flex: 1, display: "flex", minHeight: 0 }, children: [_jsxs("div", { style: rail, children: [_jsx(Reorder.Group, { axis: "y", values: steps, onReorder: (next) => {
                                    const id = steps[index]?.id;
                                    setContent((prev) => ({ ...prev, steps: next }));
                                    const ni = next.findIndex((s) => s.id === id);
                                    if (ni >= 0)
                                        setSelected(ni);
                                }, style: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }, children: steps.map((s, i) => {
                                    const run = runStarts.get(i);
                                    return (_jsxs(Reorder.Item, { value: s, onClick: () => setSelected(i), whileDrag: { scale: 1.04, boxShadow: "0 10px 24px rgba(0,0,0,0.22)", cursor: "grabbing" }, style: { cursor: "grab" }, children: [run && (runs.length > 1 || !!run.app) && (_jsxs("div", { style: runBand, children: [_jsx(Layers, { size: 11, style: { flex: "none", opacity: 0.7 } }), _jsx("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: appName(apps, run.app) }), _jsx("span", { style: { marginLeft: "auto", opacity: 0.6 }, children: run.to - run.from + 1 })] })), _jsxs("div", { style: {
                                                    position: "relative", textAlign: "left", borderRadius: 8, padding: 10, minHeight: 58,
                                                    border: i === index ? `2px solid ${ACCENT}` : "1px solid #dcd8d2", background: "#fff", color: "#1a1a1a", overflow: "hidden",
                                                }, children: [_jsx("div", { style: { fontSize: 10, opacity: 0.5, position: "absolute", top: 6, right: 8 }, children: i + 1 }), _jsx("div", { style: { fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: ACCENT, marginBottom: 4 }, children: s.eyebrow || (s.content?.kind === "slide" ? s.content.screen.eyebrow : "") }), _jsx("div", { style: { fontSize: 12, fontWeight: 600, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }, children: s.title || (s.content?.kind === "slide" ? s.content.screen.title : "") || s.id })] })] }, s.id));
                                }) }), _jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(Plus, { size: 16 }), onClick: addStep, style: { ...fill, marginTop: 4 }, children: "Add step" })] }), _jsx("div", { style: { flex: 1, minWidth: 0, position: "relative", overflow: "hidden", display: "flex", background: demo.live || opaque ? "#0f1115" : "#e9e7e3" }, children: demo.live || opaque ? (_jsxs("div", { ref: demo.stageRef, style: { flex: 1, position: "relative", overflow: "hidden" }, children: [demo.live && app && _jsx("iframe", { ref: demo.frameRef, title: app.label, style: demo.frameStyle }, app.src), shown.kind === "slide" && (_jsx("div", { style: { position: "absolute", inset: 0, background: "#f4f3f1" }, children: _jsx(Stage, { background: bleedBg(shown.screen), backdrop: backdropFor(shown.screen), children: _jsx(ScreenView, { screen: shown.screen, play: false, reduced: true, logoSrc: content.preview?.logo, onAnnotationMove: shown.screen.layout === "showcase"
                                                ? (id, x, y) => patchSlide({ items: (shown.screen.items ?? []).map((it) => (it.id === id ? { ...it, x, y } : it)) })
                                                : undefined }) }, shown.screen.id) })), shown.kind === "image" && _jsx(StageStill, { image: shown }), shown.kind === "embed" && (_jsx("iframe", { src: shown.url, title: "Embedded page", allowFullScreen: true, style: { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 } }, shown.url)), !overlaid && _jsx(Spotlight, { box: box, shape: step.spotlight?.shape, dim: step.spotlight?.dim, lock: false }), !overlaid && step.callouts?.length ? _jsx(Callouts, { items: step.callouts, boxFor: calloutBox, bounds: demo.bounds }) : null, picking && _jsx(HoverOutline, { box: hoverBox, ok: !!hover?.mark }), drawing && (_jsx(AreaDraw, { bounds: demo.bounds, onDone: (area) => {
                                        applyArea(drawing, area);
                                        setDrawing(null);
                                    }, onCancel: () => setDrawing(null) })), (picking || drawing) && (_jsxs("div", { style: pickBanner, children: [picking ? _jsx(Crosshair, { size: 15 }) : _jsx(Square, { size: 15 }), picking ? "Click the element to mark" : "Drag the area to point at", _jsx("button", { onClick: () => (picking ? setPicking(null) : setDrawing(null)), style: pickCancel, title: "Cancel (Esc)", children: _jsx(X, { size: 14 }) })] }))] })) : (_jsx(StageNotice, { blocked: demo.blocked, src: app?.src })) }), _jsxs("div", { style: inspector, children: [_jsxs(Field, { label: "App", collapsible: true, children: [_jsxs("select", { value: step.app ?? "", onChange: (e) => update({ app: e.target.value || undefined }), style: { ...inputStyle, cursor: "pointer" }, children: [_jsx("option", { value: "", children: "None \u2014 no app running" }), apps.map((a) => (_jsx("option", { value: a.id, children: a.label }, a.id)))] }), !apps.length && onIngestApp && (_jsxs("p", { style: hint, children: ["No apps yet \u2014 ", _jsx("button", { onClick: () => setShowApps(true), style: linkBtn, children: "ingest one" }), " and every walkthrough can run it."] })), !!step.app && (_jsx("p", { style: hint, children: boots
                                            ? `Boots ${appName(apps, step.app)}. The steps after it keep it running, so whatever the reader does carries forward.`
                                            : `${appName(apps, step.app)} is already running from the step before, and keeps whatever the reader did.` })), !step.app && _jsx("p", { style: hint, children: "Nothing runs behind this step. It can still display a URL or an image." }), boots && (_jsxs(_Fragment, { children: [_jsx("label", { style: { ...hint, display: "block", marginTop: 12 }, children: "Starting screen" }), _jsxs("div", { style: { display: "flex", gap: 6, marginTop: 4 }, children: [_jsx("input", { value: step.start ?? "", onChange: (e) => update({ start: e.target.value || undefined }), placeholder: "#/orders", style: inputStyle }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => driver && update({ start: driver.currentPath() || undefined }), disabled: !driver, style: nowrap, title: "Use the screen the app is showing", children: "Use current" })] }), misroute && (_jsx("div", { style: warn, children: _jsxs("span", { children: ["That isn't a screen \u2014 it's an address. A screen is a route ", _jsx("strong", { children: "inside" }), " ", appName(apps, step.app), ", like ", _jsx("code", { children: "#/orders" }), ". To show something else, change the app above or this step's Display."] }) })), _jsx("p", { style: hint, children: "Where the app opens. Navigate it on the left and press Use current rather than typing one." })] }))] }), _jsxs(Field, { label: "Display", collapsible: true, children: [_jsx(SegmentedControl, { size: "md", "aria-label": "What this step displays", style: track, children: CONTENT_KINDS.map((k) => (_jsx(Segment, { selected: shown.kind === k.value, onClick: () => update({
                                                content: k.value === "app" ? undefined : blankContent(k.value, shown),
                                                // Nothing can be seen through a URL or an image, so a
                                                // step showing one can only be left by its button.
                                                advance: k.value === "app" || step.advance.on === "manual" ? step.advance : { on: "manual" },
                                            }), children: k.label }, k.value))) }), _jsx("p", { style: hint, children: CONTENT_KINDS.find((k) => k.value === shown.kind)?.hint }), shown.kind === "embed" && (_jsxs(_Fragment, { children: [_jsx("input", { value: shown.url, onChange: (e) => update({ content: { ...shown, url: e.target.value } }), placeholder: "https://embed.figma.com/\u2026", style: { ...inputStyle, marginTop: 8 } }), _jsxs("div", { style: { display: "flex", gap: 6, marginTop: 6 }, children: [_jsxs("label", { style: { ...hint, flex: 1 }, children: ["Width", _jsx("input", { type: "number", value: shown.width ?? "", onChange: (e) => update({ content: { ...shown, width: e.target.value ? Number(e.target.value) : undefined } }), style: inputStyle })] }), _jsxs("label", { style: { ...hint, flex: 1 }, children: ["Min width", _jsx("input", { type: "number", value: shown.minWidth ?? "", onChange: (e) => update({ content: { ...shown, minWidth: e.target.value ? Number(e.target.value) : undefined } }), style: inputStyle })] })] })] })), shown.kind === "slide" && (_jsx("div", { style: { marginTop: 12 }, children: _jsx(SlideFields, { screen: shown.screen, update: patchSlide, logoSrc: content.preview?.logo }) })), shown.kind === "image" && (_jsxs(_Fragment, { children: [_jsx("div", { style: { marginTop: 10 }, children: _jsx(ImageField, { value: shown.src, onChange: (v) => update({ content: { ...shown, src: v } }), label: "Image" }) }), _jsx(SegmentedControl, { size: "md", "aria-label": "How the image fits", style: { ...track, marginTop: 8 }, children: ["center", "fill"].map((fit) => (_jsx(Segment, { selected: (shown.fit ?? "center") === fit, onClick: () => update({ content: { ...shown, fit } }), children: fit === "center" ? "Centered" : "Fill" }, fit))) })] }))] }), _jsxs(Field, { label: "Does", collapsible: true, children: [(step.actions ?? []).map((action, at) => (_jsxs("div", { style: { border: "1px solid #e3e0db", borderRadius: 8, padding: 10, marginBottom: 8 }, children: [_jsxs("div", { style: { display: "flex", gap: 6, alignItems: "center" }, children: [_jsx(SegmentedControl, { size: "md", "aria-label": "What this does", style: track, children: ["click", "type", "wait"].map((kind) => (_jsx(Segment, { selected: action.do === kind, onClick: () => patchAction(at, blankAction(kind, action)), children: kind }, kind))) }), _jsx(ButtonRound, { size: "sm", variant: "tertiary", tone: "danger", icon: _jsx(X, { size: 13 }), onClick: () => update({ actions: (step.actions ?? []).filter((_, i) => i !== at) }), title: "Remove", "aria-label": "Remove this action", style: { marginLeft: "auto" } })] }), action.do === "wait" ? (_jsx("input", { type: "number", value: action.ms, onChange: (e) => patchAction(at, { do: "wait", ms: Number(e.target.value) || 0 }), placeholder: "400", style: { ...inputStyle, marginTop: 6 } })) : (_jsxs("div", { style: { marginTop: 6 }, children: [_jsx(Anchor, { mark: action.mark, opaque: false, onMark: (mark) => patchAction(at, { ...action, mark }), onPick: () => setPicking({ field: "action", at }), onDraw: () => { }, busy: picking?.field === "action" && picking.at === at, disabled: !driveable }), action.do === "type" && (_jsx("input", { value: action.text, onChange: (e) => patchAction(at, { do: "type", mark: action.mark, text: e.target.value }), placeholder: "Simpson", style: { ...inputStyle, marginTop: 6 } }))] }))] }, at))), _jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(Plus, { size: 15 }), onClick: () => update({ actions: [...(step.actions ?? []), { do: "click", mark: "" }] }), disabled: !step.app, children: "Add an action" }), _jsx("p", { style: hint, children: step.app
                                            ? "Done to the running app as the step opens, in order. A wait is for the gap a click opens — a menu's options don't exist until the menu does."
                                            : "A step with no app running has nothing to act on." })] }), _jsxs("div", { style: { display: "flex", gap: 6, margin: "18px 0" }, children: [_jsx(ButtonRound, { variant: "tertiary", icon: _jsx(ChevronUp, { size: 16 }), onClick: () => move(-1), disabled: index === 0, title: "Move up", "aria-label": "Move up" }), _jsx(ButtonRound, { variant: "tertiary", icon: _jsx(ChevronDown, { size: 16 }), onClick: () => move(1), disabled: index === steps.length - 1, title: "Move down", "aria-label": "Move down" }), _jsx(ButtonRound, { variant: "tertiary", icon: _jsx(Copy, { size: 16 }), onClick: duplicateStep, title: "Duplicate", "aria-label": "Duplicate" }), _jsx(ButtonRound, { variant: "tertiary", tone: "danger", icon: _jsx(Trash2, { size: 16 }), onClick: deleteStep, disabled: steps.length <= 1, title: "Delete", "aria-label": "Delete" })] }), _jsx(Field, { label: "Eyebrow", children: _jsx("textarea", { value: step.eyebrow ?? "", onChange: (e) => update({ eyebrow: e.target.value }), rows: 1, style: { ...inputStyle, resize: "vertical" } }) }), _jsx(Field, { label: "Title", children: _jsx("textarea", { value: step.title ?? "", onChange: (e) => update({ title: e.target.value }), rows: 2, style: { ...inputStyle, resize: "vertical" } }) }), _jsx(Field, { label: "Body", children: _jsx("textarea", { value: step.body ?? "", onChange: (e) => update({ body: e.target.value }), rows: 4, style: { ...inputStyle, resize: "vertical" } }) }), _jsx(Field, { label: "Panel image", collapsible: true, children: _jsx(ImageField, { value: step.imageUrl ?? "", onChange: (v) => update({ imageUrl: v || undefined }), label: "Panel image" }) }), _jsx(Field, { label: "Spotlight", collapsible: true, children: step.spotlight ? (_jsxs(_Fragment, { children: [_jsx(Anchor, { mark: marksOf(step.spotlight.mark).join(", "), area: step.spotlight.area, opaque: opaque, onMark: (v) => {
                                                const list = v.split(",").map((m) => m.trim()).filter(Boolean);
                                                update({ spotlight: { ...step.spotlight, mark: list.length === 1 ? list[0] : list } });
                                            }, onPick: () => setPicking({ field: "spotlight" }), onDraw: () => setDrawing({ field: "spotlight" }), busy: picking?.field === "spotlight" || drawing?.field === "spotlight", disabled: !opaque && !driveable }), _jsxs("div", { style: { display: "flex", gap: 6, marginTop: 8, alignItems: "center" }, children: [_jsx(SegmentedControl, { size: "md", "aria-label": "Spotlight shape", style: track, children: ["rect", "pill"].map((shape) => (_jsx(Segment, { selected: (step.spotlight.shape ?? "rect") === shape, onClick: () => update({ spotlight: { ...step.spotlight, shape } }), children: shape === "rect" ? "Rounded" : "Pill" }, shape))) }), !opaque && (_jsx("input", { type: "number", value: step.spotlight.pad ?? "", onChange: (e) => update({ spotlight: { ...step.spotlight, pad: e.target.value ? Number(e.target.value) : undefined } }), placeholder: "Pad", style: { ...inputStyle, width: 70 } }))] }), _jsxs("label", { style: { ...hint, display: "flex", alignItems: "center", gap: 7, marginTop: 10 }, children: [_jsx("input", { type: "checkbox", checked: step.spotlight.dim !== false, onChange: (e) => update({ spotlight: { ...step.spotlight, dim: e.target.checked ? undefined : false } }) }), "Dim the rest of the stage"] }), _jsxs("label", { style: { ...hint, display: "flex", alignItems: "center", gap: 7, marginTop: 6 }, children: [_jsx("input", { type: "checkbox", checked: !!step.spotlight.lock, onChange: (e) => update({ spotlight: { ...step.spotlight, lock: e.target.checked || undefined } }) }), "Block clicks everywhere else"] }), _jsx(Button, { variant: "ghost", size: "sm", tone: "danger", onClick: () => update({ spotlight: undefined }), style: { marginTop: 10 }, children: "Remove spotlight" })] })) : (_jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(Plus, { size: 15 }), onClick: () => update({ spotlight: {} }), children: "Add a spotlight" })) }), _jsxs(Field, { label: "Callouts", collapsible: true, children: [(step.callouts ?? []).map((callout, at) => (_jsxs("div", { style: { border: "1px solid #e3e0db", borderRadius: 8, padding: 10, marginBottom: 8 }, children: [_jsx(Anchor, { mark: callout.mark ?? "", area: callout.area, opaque: opaque, onMark: (v) => patchCallout(at, { mark: v }), onPick: () => setPicking({ field: "callout", at }), onDraw: () => setDrawing({ field: "callout", at }), busy: (picking?.field === "callout" && picking.at === at) || (drawing?.field === "callout" && drawing.at === at), disabled: !opaque && !driveable }), _jsx("textarea", { value: callout.text, onChange: (e) => patchCallout(at, { text: e.target.value }), rows: 2, placeholder: "What this element is for", style: { ...inputStyle, resize: "vertical", marginTop: 6 } }), _jsxs("div", { style: { display: "flex", gap: 6, marginTop: 6, alignItems: "center" }, children: [_jsx(SegmentedControl, { size: "md", "aria-label": "Which side the callout sits on", style: track, children: ["auto", "top", "right", "bottom", "left"].map((side) => (_jsx(Segment, { selected: (callout.placement ?? "auto") === side, onClick: () => patchCallout(at, { placement: side === "auto" ? undefined : side }), children: side }, side))) }), _jsx(ButtonRound, { size: "sm", variant: "tertiary", tone: "danger", icon: _jsx(X, { size: 13 }), onClick: () => removeCallout(at), title: "Remove", "aria-label": "Remove callout", style: { marginLeft: "auto" } })] })] }, at))), _jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(Plus, { size: 15 }), onClick: addCallout, children: "Add a callout" }), _jsx("p", { style: hint, children: opaque
                                            ? "Anchored to an area of the stage, which an embed or a mock-up can't move out from under them."
                                            : "Anchored to a mark, so they follow the element as the app reflows." })] }), _jsxs(Field, { label: "Advances on", collapsible: true, children: [_jsx(SegmentedControl, { size: "md", "aria-label": "What advances this step", style: track, children: ADVANCE_KINDS.filter((k) => !opaque || k.value === "manual").map((k) => (_jsx(Segment, { selected: step.advance.on === k.value, onClick: () => update({ advance: blankAdvance(k.value, step.advance) }), children: k.label }, k.value))) }), _jsx("p", { style: hint, children: opaque
                                            ? "Nothing can be observed inside an embed or a mock-up, so a step on one is left with the panel's button."
                                            : ADVANCE_KINDS.find((k) => k.value === step.advance.on)?.hint }), step.advance.on === "manual" && (_jsx("input", { value: step.advance.label ?? "", onChange: (e) => update({ advance: { on: "manual", label: e.target.value || undefined } }), placeholder: "Button label (Next)", style: inputStyle })), opaque && step.advance.on !== "manual" && (_jsx("div", { style: warn, children: "This step waits for something inside the stage, which can't be seen from here. The player will show its button instead." })), !opaque && (step.advance.on === "click" || step.advance.on === "path" || step.advance.on === "signal") && (_jsx(SimpleAdvance, { advance: step.advance, onChange: (a) => update({ advance: a }), onPick: () => setPicking({ field: "advance" }), picking: picking?.field === "advance", canPick: driveable, currentPath: driver?.currentPath() })), !opaque && step.advance.on === "any" && (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 10 }, children: [step.advance.of.map((a, at) => (_jsxs("div", { style: { border: "1px solid #e3e0db", borderRadius: 8, padding: 10 }, children: [_jsxs("div", { style: { display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }, children: [_jsx(SegmentedControl, { size: "md", "aria-label": "What this way waits for", style: track, children: ["click", "path", "signal"].map((on) => (_jsx(Segment, { selected: a.on === on, onClick: () => updateAny(step.advance, at, blankAdvance(on, a), update), children: on }, on))) }), _jsx(ButtonRound, { size: "sm", variant: "tertiary", tone: "danger", icon: _jsx(X, { size: 13 }), onClick: () => {
                                                                    const any = step.advance;
                                                                    update({ advance: { ...any, of: any.of.filter((_, i) => i !== at) } });
                                                                }, title: "Remove", "aria-label": "Remove this way", style: { marginLeft: "auto" } })] }), _jsx(SimpleAdvance, { advance: a, onChange: (next) => updateAny(step.advance, at, next, update), onPick: () => setPicking({ field: "any", at }), picking: picking?.field === "any" && picking.at === at, canPick: driveable, currentPath: driver?.currentPath() })] }, at))), _jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(Plus, { size: 15 }), onClick: () => {
                                                    const any = step.advance;
                                                    update({ advance: { ...any, of: [...any.of, { on: "click", mark: "" }] } });
                                                }, style: undefined, children: "Add a way" })] }))] }), warning && (_jsxs("div", { style: warn, children: [warning, _jsx(ButtonRound, { size: "sm", variant: "tertiary", icon: _jsx(X, { size: 13 }), onClick: () => setWarning(null), "aria-label": "Dismiss", style: { flex: "none" } })] }))] })] })] }));
}
/** A fresh content of the given kind, keeping anything the old one can lend. */
function blankContent(kind, from) {
    if (kind === "app")
        return { kind: "app" };
    if (kind === "embed")
        return { kind: "embed", url: from.kind === "embed" ? from.url : "" };
    if (kind === "slide")
        return { kind: "slide", screen: from.kind === "slide" ? from.screen : newScreen() };
    return { kind: "image", src: from.kind === "image" ? from.src : "", fit: from.kind === "image" ? from.fit : undefined };
}
/** A fresh action of the given kind, keeping the mark the old one was on. */
function blankAction(kind, from) {
    const mark = from.do === "wait" ? "" : from.mark;
    if (kind === "wait")
        return { do: "wait", ms: 400 };
    if (kind === "click")
        return { do: "click", mark };
    return { do: "type", mark, text: from.do === "type" ? from.text : "" };
}
/** The pool every walkthrough draws from. Ingesting copies someone's built
 * output in and never looks at the original again, so a demo can't break
 * because the app it runs moved on. */
function AppsPanel({ apps, steps, error, onIngest, onPatch, onDelete, onClose }) {
    const [path, setPath] = useState("");
    const [label, setLabel] = useState("");
    const used = (id) => steps.filter((s) => s.app === id).length;
    return (_jsxs(_Fragment, { children: [_jsx("div", { onClick: onClose, style: { position: "fixed", inset: 0, zIndex: 90 } }), _jsxs("div", { style: stagesPanel, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 600, marginBottom: 4 }, children: "Apps" }), _jsx("div", { style: { fontSize: 11, color: "#8c8c8c", marginBottom: 14, lineHeight: 1.5 }, children: "Every walkthrough can run any of these. Each is a copy of a built output, frozen at the moment it was ingested." }), apps.map((app) => (_jsxs("div", { style: { border: "1px solid #e3e0db", borderRadius: 9, padding: 11, marginBottom: 10 }, children: [_jsxs("div", { style: { display: "flex", gap: 6, alignItems: "center" }, children: [_jsx("input", { defaultValue: app.label, onBlur: (e) => onPatch && e.target.value.trim() && e.target.value !== app.label && onPatch(app.id, { label: e.target.value.trim() }), disabled: !onPatch, style: inputStyle }), onDelete && (_jsx(ButtonRound, { size: "sm", variant: "tertiary", tone: "danger", icon: _jsx(X, { size: 13 }), onClick: () => onDelete(app.id), title: used(app.id) ? `${used(app.id)} steps in this walkthrough run it` : "Remove this app", "aria-label": "Remove this app" }))] }), _jsxs("div", { style: { display: "flex", gap: 6, marginTop: 6 }, children: [_jsxs("label", { style: { ...hint, flex: 1 }, children: ["Width", _jsx("input", { type: "number", defaultValue: app.width ?? "", onBlur: (e) => onPatch && onPatch(app.id, { width: e.target.value ? Number(e.target.value) : undefined }), disabled: !onPatch, style: inputStyle })] }), _jsxs("label", { style: { ...hint, flex: 1 }, children: ["Min width", _jsx("input", { type: "number", defaultValue: app.minWidth ?? "", onBlur: (e) => onPatch && onPatch(app.id, { minWidth: e.target.value ? Number(e.target.value) : undefined }), disabled: !onPatch, style: inputStyle })] })] }), _jsxs("p", { style: { ...hint, display: "flex", justifyContent: "space-between", gap: 8 }, children: [_jsx("code", { style: { fontSize: 10.5, opacity: 0.75 }, children: app.id }), _jsxs("span", { children: [used(app.id), " ", used(app.id) === 1 ? "step here" : "steps here"] })] })] }, app.id))), _jsxs("div", { style: { borderTop: "1px solid #e3e0db", marginTop: 14, paddingTop: 14 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600, marginBottom: 6 }, children: "Ingest an app" }), _jsx("input", { value: label, onChange: (e) => setLabel(e.target.value), placeholder: "Provider Portal", style: inputStyle }), _jsx("input", { value: path, onChange: (e) => setPath(e.target.value), placeholder: "/Users/you/Sites/provider-portal/dist", style: { ...inputStyle, marginTop: 6 } }), _jsxs("p", { style: hint, children: ["The folder its build wrote \u2014 the one with ", _jsx("code", { children: "index.html" }), " in it, not the source. It must be built with", _jsx("code", { children: " base: \"./\"" }), " and use hash routes."] }), error && _jsx("div", { style: warn, children: error }), _jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(Plus, { size: 15 }), onClick: () => {
                                    onIngest(path.trim(), label.trim());
                                    setPath("");
                                    setLabel("");
                                }, disabled: !path.trim(), style: { ...fill, marginTop: 8 }, children: "Ingest" })] })] })] }));
}
/** Where a spotlight or a callout points: a mark on a driveable stage, an area
 * on one that can only be shown. The same field, because it is the same idea —
 * only the way of naming the spot differs. */
function Anchor({ mark, area, opaque, onMark, onPick, onDraw, busy, disabled }) {
    if (opaque) {
        const at = area ? `${Math.round(area.x * 100)}%, ${Math.round(area.y * 100)}% · ${Math.round(area.w * 100)}×${Math.round(area.h * 100)}` : "Nothing yet";
        return (_jsxs("div", { style: { display: "flex", gap: 6, alignItems: "center" }, children: [_jsx("span", { style: { ...inputStyle, display: "flex", alignItems: "center", color: area ? "#1a1a1a" : "#8a857d", fontSize: 12 }, children: at }), _jsx(Button, { size: "sm", variant: busy ? "primary" : "ghost", icon: _jsx(Square, { size: 14 }), onClick: onDraw, disabled: disabled, title: disabled ? "Needs the stage" : "Drag the area on the stage", style: nowrap, children: "Draw" })] }));
    }
    return (_jsxs("div", { style: { display: "flex", gap: 6 }, children: [_jsx("input", { value: mark, onChange: (e) => onMark(e.target.value), placeholder: "data-walkthrough id", style: inputStyle }), _jsx(Button, { size: "sm", variant: busy ? "primary" : "ghost", icon: _jsx(Crosshair, { size: 14 }), onClick: onPick, disabled: disabled, title: disabled ? "Needs a code stage" : "Pick it by clicking the app", style: nowrap, children: "Pick" })] }));
}
/** Replace one branch of an "any" advance. */
function updateAny(any, at, next, update) {
    update({ advance: { ...any, of: any.of.map((a, i) => (i === at ? next : a)) } });
}
/** A fresh advance of the given kind, keeping anything the old one can lend. */
function blankAdvance(on, from) {
    const mark = from && "mark" in from ? from.mark : "";
    switch (on) {
        case "manual":
            return { on: "manual" };
        case "click":
            return { on: "click", mark };
        case "path":
            return { on: "path", path: "" };
        case "signal":
            return { on: "signal", name: "" };
        case "any":
            return { on: "any", of: [from && from.on !== "any" && from.on !== "manual" ? from : { on: "click", mark }] };
    }
}
function SimpleAdvance({ advance, onChange, onPick, picking, canPick, currentPath }) {
    if (advance.on === "click") {
        return (_jsx(Anchor, { mark: advance.mark, opaque: false, onMark: (mark) => onChange({ on: "click", mark }), onPick: onPick, onDraw: () => { }, busy: picking, disabled: !canPick }));
    }
    if (advance.on === "path") {
        return (_jsxs("div", { style: { display: "flex", gap: 6 }, children: [_jsx("input", { value: advance.path, onChange: (e) => onChange({ on: "path", path: e.target.value }), placeholder: "#/settings", style: inputStyle }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => currentPath && onChange({ on: "path", path: currentPath }), disabled: !currentPath, style: nowrap, children: "Use current" })] }));
    }
    if (advance.on === "signal") {
        return _jsx("input", { value: advance.name, onChange: (e) => onChange({ on: "signal", name: e.target.value }), placeholder: "settings-saved", style: inputStyle });
    }
    return null;
}
const shell = {
    position: "fixed", inset: 0, zIndex: 55, background: "#e9e7e3", color: "#1a1a1a", display: "flex", flexDirection: "column",
};
const toolbar = {
    height: 60, flexShrink: 0, background: "#fff", borderBottom: "1px solid #e3e0db",
    display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px",
};
const rail = {
    width: 184, flexShrink: 0, background: "#f3f1ed", borderRight: "1px solid #e3e0db",
    overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8,
};
const inspector = {
    width: 360, flexShrink: 0, background: "#fff", borderLeft: "1px solid #e3e0db", overflowY: "auto", padding: 18, paddingBottom: 104,
};
/** A segmented control holds as many options as the walkthrough has, and a
 * walkthrough that crosses four apps has a row the panel can't fit. Scrolling
 * the track keeps that row inside the inspector instead of pushing the whole
 * panel sideways; the thumb is positioned within the track, so it travels with
 * it. */
const track = { maxWidth: "100%", overflowX: "auto" };
const stagesPanel = {
    position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 91, width: 360, maxHeight: "80vh", overflowY: "auto",
    background: "#fff", border: "1px solid #e3e0db", borderRadius: 10, boxShadow: "0 18px 44px rgba(0,0,0,0.16)", padding: 16, textAlign: "left",
};
/** The band that opens each run of steps sharing a stage. Derived from the
 * steps, so dragging one into another run simply moves the band. */
const runBand = {
    display: "flex", alignItems: "center", gap: 5, margin: "2px 0 6px",
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8a857d",
};
const hint = { fontSize: 11, color: "#8a857d", margin: "7px 0 0", lineHeight: 1.5 };
const linkBtn = {
    appearance: "none", border: 0, background: "none", padding: 0, font: "inherit", color: ACCENT,
    cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2,
};
const warn = {
    display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.5,
    background: "#fff8e6", border: "1px solid #f0dca8", color: "#6b5516", borderRadius: 8, padding: 10, marginTop: 8,
};
const pickBanner = {
    position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
    display: "flex", alignItems: "center", gap: 8, background: "#fff", border: `1px solid ${ACCENT}`,
    borderRadius: 999, padding: "7px 8px 7px 14px", fontSize: 13, fontWeight: 600, color: "#1a1a1a",
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)", zIndex: 5,
};
const pickCancel = {
    width: 24, height: 24, borderRadius: "50%", border: "none", background: "#f0eeea",
    color: "#5a554e", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};
/** A button that spans the list it ends, and one that must not wrap beside a
 * field. Everything else about these comes from the variant. */
const fill = { width: "100%", justifyContent: "center" };
const nowrap = { whiteSpace: "nowrap", flex: "none" };
//# sourceMappingURL=WalkthroughBuilder.js.map