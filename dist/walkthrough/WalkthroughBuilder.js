import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ─── The walkthrough builder (edit mode) ───────────────────────────
// Same shape as the case-study builder — rail, canvas, inspector — but the
// canvas is the live demo rather than a screen, so what you author is what
// plays. Selecting a step puts the demo into that step's state.
//
// Marks are picked by clicking the product: the demo is same-origin, so the
// builder can read what was clicked and tell you when an element has no
// data-walkthrough id to point at yet.
import { useEffect, useMemo, useState } from "react";
import { Reorder } from "motion/react";
import { ChevronDown, ChevronUp, Copy, Crosshair, Image as ImageIcon, LayoutGrid, Play, Plus, Trash2, X } from "lucide-react";
import { ACCENT } from "../core.js";
import { Field, ImageField, PreviewCardSettings, ghostBtn, iconBtn, inputStyle, primaryBtn } from "../editors.js";
import { WalkthroughPlayer, marksOf } from "./WalkthroughPlayer.js";
import { DemoNotice, HoverOutline, Spotlight, toBox, useDemo } from "./stage.js";
const ADVANCE_KINDS = [
    { value: "manual", label: "A button", hint: "The reader presses Next in the panel." },
    { value: "click", label: "A click", hint: "The reader clicks a marked element in the demo." },
    { value: "path", label: "A route", hint: "The demo navigates to a hash route." },
    { value: "signal", label: "A signal", hint: "The demo fires wt:signal with this name." },
    { value: "any", label: "Any of…", hint: "Whichever of these happens first." },
];
const uid = () => `step-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
const newStep = () => ({
    id: uid(),
    eyebrow: "Step",
    title: "New step",
    body: "What should the reader do here?",
    advance: { on: "manual" },
});
export function WalkthroughBuilder({ content, setContent, projectName, onClose }) {
    const [selected, setSelected] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [showThumb, setShowThumb] = useState(false);
    const [picking, setPicking] = useState(null);
    const [hover, setHover] = useState(null);
    const [warning, setWarning] = useState(null);
    const steps = content.steps;
    const index = Math.min(selected, Math.max(0, steps.length - 1));
    const step = steps[index];
    const markIds = useMemo(() => marksOf(step?.spotlight?.mark), [step]);
    const demo = useDemo(content.target, markIds);
    const { driver } = demo;
    const update = (patch) => setContent((prev) => ({ ...prev, steps: prev.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));
    const setTarget = (patch) => setContent((prev) => ({ ...prev, target: { ...prev.target, ...patch } }));
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
    // Selecting a step shows its state, the same way the reader would arrive at
    // it out of order. Editing the step's copy must not reload the demo, so this
    // watches the seed only.
    const enterPath = step?.enter?.path ?? "";
    const enterState = step?.enter?.state ?? "";
    useEffect(() => {
        if (!driver || !step)
            return;
        let live = true;
        const timers = [];
        void (async () => {
            await driver.enter(step, { reseed: true });
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
    }, [driver, index, enterPath, enterState]);
    const applyMark = (slot, mark) => {
        if (slot.field === "spotlight") {
            update({ spotlight: { ...(step.spotlight ?? {}), mark } });
            return;
        }
        if (slot.field === "advance") {
            update({ advance: { on: "click", mark } });
            return;
        }
        const advance = step.advance;
        if (advance.on !== "any")
            return;
        update({ advance: { ...advance, of: advance.of.map((a, i) => (i === slot.at ? { on: "click", mark } : a)) } });
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
                setWarning(`That ${hit.label} has no data-walkthrough id. Add one in the demo, then pick it again.`);
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
    const box = useMemo(() => toBox(markIds.map((id) => demo.rects[id]).filter(Boolean), demo.scale, step?.spotlight?.pad ?? 6), 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demo.rects, markIds.join("|"), demo.scale, step]);
    const hoverBox = hover && toBox([hover.rect], demo.scale, 2);
    if (playing) {
        return _jsx(WalkthroughPlayer, { content: content, startIndex: index, onExit: () => setPlaying(false) });
    }
    if (!step) {
        return (_jsx("div", { style: shell, children: _jsxs("div", { style: { margin: "auto", textAlign: "center", color: "#5a554e" }, children: [_jsx("p", { style: { marginBottom: 14 }, children: "This walkthrough has no steps yet." }), _jsxs("button", { onClick: addStep, style: { ...primaryBtn, margin: "0 auto" }, children: [_jsx(Plus, { size: 16 }), " Add the first step"] })] }) }));
    }
    return (_jsxs("div", { style: shell, children: [_jsxs("div", { style: toolbar, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 15 }, children: [_jsx(LayoutGrid, { size: 18, style: { color: ACCENT } }), " Walkthrough Builder", projectName && (_jsxs(_Fragment, { children: [_jsx("span", { style: { color: "#cfcbc4", fontWeight: 400 }, children: "/" }), _jsx("span", { style: { color: "#5a554e", fontWeight: 600 }, children: projectName })] }))] }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, position: "relative" }, children: [_jsxs("button", { onClick: () => setShowThumb((v) => !v), style: ghostBtn, title: "Projects page preview card", children: [_jsx(ImageIcon, { size: 16 }), " Project settings"] }), _jsxs("button", { onClick: () => setPlaying(true), style: primaryBtn, children: [_jsx(Play, { size: 16 }), " Preview"] }), onClose && _jsx("button", { onClick: onClose, style: { ...ghostBtn, borderStyle: "solid" }, children: "Done" }), showThumb && (_jsx(PreviewCardSettings, { preview: content.preview ?? {}, onChange: (patch) => setContent((prev) => ({ ...prev, preview: { ...prev.preview, ...patch } })), onClose: () => setShowThumb(false) }))] })] }), _jsxs("div", { style: { flex: 1, display: "flex", minHeight: 0 }, children: [_jsxs("div", { style: rail, children: [_jsx(Reorder.Group, { axis: "y", values: steps, onReorder: (next) => {
                                    const id = steps[index]?.id;
                                    setContent((prev) => ({ ...prev, steps: next }));
                                    const ni = next.findIndex((s) => s.id === id);
                                    if (ni >= 0)
                                        setSelected(ni);
                                }, style: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }, children: steps.map((s, i) => (_jsxs(Reorder.Item, { value: s, onClick: () => setSelected(i), whileDrag: { scale: 1.04, boxShadow: "0 10px 24px rgba(0,0,0,0.22)", cursor: "grabbing" }, style: {
                                        position: "relative", textAlign: "left", borderRadius: 8, padding: 10, cursor: "grab", minHeight: 58,
                                        border: i === index ? `2px solid ${ACCENT}` : "1px solid #dcd8d2", background: "#fff", color: "#1a1a1a", overflow: "hidden",
                                    }, children: [_jsx("div", { style: { fontSize: 10, opacity: 0.5, position: "absolute", top: 6, right: 8 }, children: i + 1 }), _jsx("div", { style: { fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: ACCENT, marginBottom: 4 }, children: s.eyebrow }), _jsx("div", { style: { fontSize: 12, fontWeight: 600, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }, children: s.title || s.id })] }, s.id))) }), _jsxs("button", { onClick: addStep, style: { ...ghostBtn, justifyContent: "center", marginTop: 4 }, children: [_jsx(Plus, { size: 16 }), " Add step"] })] }), _jsx("div", { style: { flex: 1, minWidth: 0, position: "relative", overflow: "hidden", display: "flex", background: demo.framed ? "#0f1115" : "#e9e7e3" }, children: demo.framed ? (_jsxs("div", { ref: demo.stageRef, style: { flex: 1, position: "relative", overflow: "hidden" }, children: [_jsx("iframe", { ref: demo.frameRef, title: "Demo", style: demo.frameStyle }), !picking && _jsx(Spotlight, { box: box, shape: step.spotlight?.shape, lock: false }), picking && _jsx(HoverOutline, { box: hoverBox, ok: !!hover?.mark }), picking && (_jsxs("div", { style: pickBanner, children: [_jsx(Crosshair, { size: 15 }), "Click the element to mark", _jsx("button", { onClick: () => setPicking(null), style: pickCancel, title: "Cancel (Esc)", children: _jsx(X, { size: 14 }) })] }))] })) : (_jsx(DemoNotice, { blocked: demo.blocked, src: content.target.src })) }), _jsxs("div", { style: inspector, children: [_jsxs(Field, { label: "Demo", collapsible: true, children: [_jsx("input", { value: content.target.src, onChange: (e) => setTarget({ src: e.target.value }), placeholder: "/projects/<id>/demo/index.html", style: inputStyle }), _jsx("p", { style: hint, children: "Served from this site, so the walkthrough can drive it. A build in the project's own demo/ folder." }), _jsxs("div", { style: { display: "flex", gap: 6, marginTop: 8 }, children: [_jsxs("label", { style: { ...hint, flex: 1 }, children: ["Width", _jsx("input", { type: "number", value: content.target.width ?? "", onChange: (e) => setTarget({ width: e.target.value ? Number(e.target.value) : undefined }), style: inputStyle })] }), _jsxs("label", { style: { ...hint, flex: 1 }, children: ["Min width", _jsx("input", { type: "number", value: content.target.minWidth ?? "", onChange: (e) => setTarget({ minWidth: e.target.value ? Number(e.target.value) : undefined }), style: inputStyle })] })] })] }), _jsxs("div", { style: { display: "flex", gap: 6, margin: "18px 0" }, children: [_jsx("button", { onClick: () => move(-1), disabled: index === 0, title: "Move up", style: iconBtn(index === 0), children: _jsx(ChevronUp, { size: 16 }) }), _jsx("button", { onClick: () => move(1), disabled: index === steps.length - 1, title: "Move down", style: iconBtn(index === steps.length - 1), children: _jsx(ChevronDown, { size: 16 }) }), _jsx("button", { onClick: duplicateStep, title: "Duplicate", style: iconBtn(false), children: _jsx(Copy, { size: 16 }) }), _jsx("button", { onClick: deleteStep, disabled: steps.length <= 1, title: "Delete", style: iconBtn(steps.length <= 1), children: _jsx(Trash2, { size: 16 }) })] }), _jsx(Field, { label: "Eyebrow", children: _jsx("textarea", { value: step.eyebrow ?? "", onChange: (e) => update({ eyebrow: e.target.value }), rows: 1, style: { ...inputStyle, resize: "vertical" } }) }), _jsx(Field, { label: "Title", children: _jsx("textarea", { value: step.title ?? "", onChange: (e) => update({ title: e.target.value }), rows: 2, style: { ...inputStyle, resize: "vertical" } }) }), _jsx(Field, { label: "Body", children: _jsx("textarea", { value: step.body ?? "", onChange: (e) => update({ body: e.target.value }), rows: 4, style: { ...inputStyle, resize: "vertical" } }) }), _jsx(Field, { label: "Panel image", collapsible: true, children: _jsx(ImageField, { value: step.imageUrl ?? "", onChange: (v) => update({ imageUrl: v || undefined }), label: "Panel image" }) }), _jsxs(Field, { label: "Starts at", collapsible: true, children: [_jsxs("div", { style: { display: "flex", gap: 6 }, children: [_jsx("input", { value: step.enter?.path ?? "", onChange: (e) => update({ enter: { ...step.enter, path: e.target.value || undefined } }), placeholder: "#/settings", style: inputStyle }), _jsx("button", { onClick: () => driver && update({ enter: { ...step.enter, path: driver.currentPath() || undefined } }), disabled: !driver, style: { ...ghostBtn, whiteSpace: "nowrap" }, title: "Use the route the demo is showing", children: "Use current" })] }), _jsx("input", { value: step.enter?.state ?? "", onChange: (e) => update({ enter: { ...step.enter, state: e.target.value || undefined } }), placeholder: "Seed, passed as ?wt=", style: { ...inputStyle, marginTop: 6 } }), _jsx("p", { style: hint, children: "Applied when the reader arrives out of order. Walking forward keeps what they did." })] }), _jsx(Field, { label: "Spotlight", collapsible: true, children: step.spotlight ? (_jsxs(_Fragment, { children: [_jsx(MarkField, { value: marksOf(step.spotlight.mark).join(", "), onChange: (v) => {
                                                const list = v.split(",").map((m) => m.trim()).filter(Boolean);
                                                update({ spotlight: { ...step.spotlight, mark: list.length === 1 ? list[0] : list } });
                                            }, onPick: () => setPicking({ field: "spotlight" }), picking: picking?.field === "spotlight", disabled: !demo.framed }), _jsxs("div", { style: { display: "flex", gap: 6, marginTop: 8 }, children: [["rect", "pill"].map((shape) => (_jsx("button", { onClick: () => update({ spotlight: { ...step.spotlight, shape } }), style: choice((step.spotlight.shape ?? "rect") === shape), children: shape === "rect" ? "Rounded" : "Pill" }, shape))), _jsx("input", { type: "number", value: step.spotlight.pad ?? "", onChange: (e) => update({ spotlight: { ...step.spotlight, pad: e.target.value ? Number(e.target.value) : undefined } }), placeholder: "Pad", style: { ...inputStyle, width: 70 } })] }), _jsxs("label", { style: { ...hint, display: "flex", alignItems: "center", gap: 7, marginTop: 10 }, children: [_jsx("input", { type: "checkbox", checked: !!step.spotlight.lock, onChange: (e) => update({ spotlight: { ...step.spotlight, lock: e.target.checked || undefined } }) }), "Block clicks everywhere else"] }), _jsx("button", { onClick: () => update({ spotlight: undefined }), style: { ...ghostBtn, marginTop: 10 }, children: "Remove spotlight" })] })) : (_jsxs("button", { onClick: () => update({ spotlight: { mark: "" } }), style: ghostBtn, children: [_jsx(Plus, { size: 15 }), " Add a spotlight"] })) }), _jsxs(Field, { label: "Advances on", collapsible: true, children: [_jsx("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }, children: ADVANCE_KINDS.map((k) => (_jsx("button", { onClick: () => update({ advance: blankAdvance(k.value, step.advance) }), style: choice(step.advance.on === k.value), children: k.label }, k.value))) }), _jsx("p", { style: hint, children: ADVANCE_KINDS.find((k) => k.value === step.advance.on)?.hint }), step.advance.on === "manual" && (_jsx("input", { value: step.advance.label ?? "", onChange: (e) => update({ advance: { on: "manual", label: e.target.value || undefined } }), placeholder: "Button label (Next)", style: inputStyle })), (step.advance.on === "click" || step.advance.on === "path" || step.advance.on === "signal") && (_jsx(SimpleAdvance, { advance: step.advance, onChange: (a) => update({ advance: a }), onPick: () => setPicking({ field: "advance" }), picking: picking?.field === "advance", canPick: demo.framed, currentPath: driver?.currentPath() })), step.advance.on === "any" && (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 10 }, children: [step.advance.of.map((a, at) => (_jsxs("div", { style: { border: "1px solid #e3e0db", borderRadius: 8, padding: 10 }, children: [_jsxs("div", { style: { display: "flex", gap: 6, marginBottom: 8 }, children: [["click", "path", "signal"].map((on) => (_jsx("button", { onClick: () => updateAny(step.advance, at, blankAdvance(on, a), update), style: choice(a.on === on), children: on }, on))), _jsx("button", { onClick: () => {
                                                                    const any = step.advance;
                                                                    update({ advance: { ...any, of: any.of.filter((_, i) => i !== at) } });
                                                                }, style: { ...iconBtn(false), width: 28, height: 28, marginLeft: "auto" }, title: "Remove", children: _jsx(X, { size: 13 }) })] }), _jsx(SimpleAdvance, { advance: a, onChange: (next) => updateAny(step.advance, at, next, update), onPick: () => setPicking({ field: "any", at }), picking: picking?.field === "any" && picking.at === at, canPick: demo.framed, currentPath: driver?.currentPath() })] }, at))), _jsxs("button", { onClick: () => {
                                                    const any = step.advance;
                                                    update({ advance: { ...any, of: [...any.of, { on: "click", mark: "" }] } });
                                                }, style: ghostBtn, children: [_jsx(Plus, { size: 15 }), " Add a way"] })] }))] }), warning && (_jsxs("div", { style: warn, children: [warning, _jsx("button", { onClick: () => setWarning(null), style: { ...iconBtn(false), width: 26, height: 26, flex: "none" }, "aria-label": "Dismiss", children: _jsx(X, { size: 13 }) })] }))] })] })] }));
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
        return (_jsx(MarkField, { value: advance.mark, onChange: (mark) => onChange({ on: "click", mark }), onPick: onPick, picking: picking, disabled: !canPick }));
    }
    if (advance.on === "path") {
        return (_jsxs("div", { style: { display: "flex", gap: 6 }, children: [_jsx("input", { value: advance.path, onChange: (e) => onChange({ on: "path", path: e.target.value }), placeholder: "#/settings", style: inputStyle }), _jsx("button", { onClick: () => currentPath && onChange({ on: "path", path: currentPath }), disabled: !currentPath, style: { ...ghostBtn, whiteSpace: "nowrap" }, children: "Use current" })] }));
    }
    if (advance.on === "signal") {
        return _jsx("input", { value: advance.name, onChange: (e) => onChange({ on: "signal", name: e.target.value }), placeholder: "settings-saved", style: inputStyle });
    }
    return null;
}
function MarkField({ value, onChange, onPick, picking, disabled }) {
    return (_jsxs("div", { style: { display: "flex", gap: 6 }, children: [_jsx("input", { value: value, onChange: (e) => onChange(e.target.value), placeholder: "data-walkthrough id", style: inputStyle }), _jsxs("button", { onClick: onPick, disabled: disabled, title: disabled ? "Needs the live demo" : "Pick it by clicking the demo", style: {
                    ...ghostBtn,
                    whiteSpace: "nowrap",
                    borderStyle: "solid",
                    ...(picking ? { background: ACCENT, color: "#fff", borderColor: ACCENT } : null),
                    ...(disabled ? { opacity: 0.5, cursor: "default" } : null),
                }, children: [_jsx(Crosshair, { size: 14 }), " Pick"] })] }));
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
    width: 320, flexShrink: 0, background: "#fff", borderLeft: "1px solid #e3e0db", overflowY: "auto", padding: 18, paddingBottom: 104,
};
const hint = { fontSize: 11, color: "#8a857d", margin: "7px 0 0", lineHeight: 1.5 };
const warn = {
    display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.5,
    background: "#fff8e6", border: "1px solid #f0dca8", color: "#6b5516", borderRadius: 8, padding: 10, marginTop: 8,
};
const pickBanner = {
    position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
    display: "flex", alignItems: "center", gap: 8, background: "#fff", border: `1px solid ${ACCENT}`,
    borderRadius: 999, padding: "7px 8px 7px 14px", fontSize: 13, fontWeight: 600, color: "#1a1a1a",
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
};
const pickCancel = {
    width: 24, height: 24, borderRadius: "50%", border: "none", background: "#f0eeea",
    color: "#5a554e", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};
function choice(active) {
    return {
        fontSize: 12, padding: "7px 10px", borderRadius: 6, cursor: "pointer",
        border: active ? `1.5px solid ${ACCENT}` : "1px solid #dcd8d2",
        background: active ? "#fff5f6" : "#fff", color: "#1a1a1a",
    };
}
//# sourceMappingURL=WalkthroughBuilder.js.map