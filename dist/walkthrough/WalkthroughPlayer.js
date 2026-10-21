import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ─── Walkthrough player ────────────────────────────────────────────
// Full-viewport, two panes: stepped copy beside whatever the step is about.
// A driveable stage is an iframe reached through a Driver, and the spotlight is
// drawn here in the parent from the boxes the driver reports, so the highlight
// keeps this package's look rather than the product's. An opaque stage reports
// nothing, so it is shown, its overlays are positioned by Area, and the reader
// moves on with the panel's button. The stage itself (frame, scaling, overlay)
// is shared with the builder — see stage.tsx.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { INK, RED } from "../theme.js";
import { renderStyledText } from "../ui/renderStyledText.js";
import { Callouts, Spotlight, StageNotice, StageStill, areaBox, toBox, useStage } from "./stage.js";
import { stageAt, stageIdAt, stepMarks } from "./types.js";
const PANEL_W = 400;
const LINE = "#e6e4e1";
const MUTED = "#6f6a66";
const norm = (path) => `#${path.replace(/^#\/?/, "").replace(/\/$/, "")}`;
/** The marks a step points at, as a list. */
export const marksOf = (mark) => (!mark ? [] : Array.isArray(mark) ? mark : [mark]);
/** Listen for whatever completes this step. Returns an unsubscribe. */
function watch(driver, advance, done) {
    switch (advance.on) {
        case "click":
            return driver.onClick((mark) => mark === advance.mark && done());
        case "path":
            return driver.onPath((path) => norm(path) === norm(advance.path) && done());
        case "signal":
            return driver.onSignal((name) => name === advance.name && done());
        case "any": {
            const offs = advance.of.map((a) => watch(driver, a, done));
            return () => offs.forEach((off) => off());
        }
        default:
            return () => { };
    }
}
export function WalkthroughPlayer({ content, startIndex = 0, onExit }) {
    const { steps } = content;
    const reduced = useReducedMotion();
    const [i, setI] = useState(startIndex);
    const [nudge, setNudge] = useState(false);
    const arrivedFrom = useRef(null); // null = nothing visited yet, so the first step still seeds
    const loadedStage = useRef(null); // the stage the live document belongs to
    const step = steps[i];
    const finished = i >= steps.length;
    // Spotlight and callouts are measured together.
    const markIds = useMemo(() => stepMarks(step), [step]);
    const markKey = markIds.join("|");
    const spotMarks = useMemo(() => marksOf(step?.spotlight?.mark), [step]);
    // Which stage this step runs in. Changing it swaps the document, which the
    // stage handles by standing up a driver for the new one — or none at all,
    // where the new stage is one that can only be shown.
    const stageId = stageIdAt(content, i);
    const stage = useMemo(() => stageAt(content, i), [content, i]);
    const demo = useStage(stage, markIds);
    const { driver, measure } = demo;
    const next = useCallback(() => setI((n) => n + 1), []);
    useEffect(() => {
        if (!step)
            return;
        let live = true;
        const forward = arrivedFrom.current === i - 1;
        arrivedFrom.current = i;
        setNudge(false);
        const timers = [];
        let off = () => { };
        if (driver) {
            // A fresh document always takes the step's seed. Only walking forward
            // inside the stage the reader is already using leaves it off, so their
            // work survives the step — which is why coming back to an app later
            // lands where the step points rather than where they left it.
            const reseed = !forward || loadedStage.current !== stageId;
            loadedStage.current = stageId;
            void (async () => {
                await driver.enter(step, { reseed });
                if (!live)
                    return;
                if (markIds[0])
                    driver.reveal(markIds[0]);
                measure();
                // Re-measure while the demo's own transitions and the smooth scroll settle.
                timers.push(window.setTimeout(measure, 140), window.setTimeout(measure, 460));
            })();
            off = watch(driver, step.advance, () => live && next());
        }
        const nudgeAt = window.setTimeout(() => live && setNudge(true), step.nudgeAfter ?? 12000);
        return () => {
            live = false;
            off();
            timers.forEach((t) => clearTimeout(t));
            clearTimeout(nudgeAt);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [driver, i, step, markKey, stageId]);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape")
                onExit?.();
            if (e.key === "ArrowLeft")
                setI((n) => Math.max(0, n - 1));
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onExit]);
    // A spotlight is anchored either way: to measured marks on a driveable
    // stage, or to a rectangle on one that can only be shown.
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
    const restart = () => {
        arrivedFrom.current = null;
        setI(0);
    };
    const narrow = demo.blocked === "small";
    const still = step?.still;
    // Nothing observes an opaque stage, so a step on one can only be left by
    // its button, whatever it was authored to wait for.
    const manual = !driver || step?.advance.on === "manual";
    const manualLabel = step?.advance.on === "manual" ? (step.advance.label ?? "Next") : "Next";
    return (_jsxs("div", { style: {
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: content.panelSide === "right" ? "row-reverse" : "row",
            background: "#f4f3f1",
            zIndex: 50,
        }, children: [_jsxs("div", { style: {
                    width: narrow ? "100%" : PANEL_W,
                    flex: "none",
                    background: "#fff",
                    borderRight: narrow || content.panelSide === "right" ? undefined : `1px solid ${LINE}`,
                    borderLeft: content.panelSide === "right" && !narrow ? `1px solid ${LINE}` : undefined,
                    display: "flex",
                    flexDirection: "column",
                    padding: "26px 28px 22px",
                    overflowY: "auto",
                }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 600, color: INK, letterSpacing: "-0.01em" }, children: content.title }), _jsx("span", { style: { fontSize: 12, color: MUTED, fontVariantNumeric: "tabular-nums" }, children: finished ? `${steps.length} of ${steps.length}` : `${i + 1} of ${steps.length}` })] }), _jsx("div", { style: { height: 3, background: LINE, borderRadius: 2, margin: "14px 0 26px", overflow: "hidden" }, children: _jsx(motion.div, { initial: { width: 0 }, animate: { width: `${((finished ? steps.length : i) / Math.max(1, steps.length)) * 100}%` }, transition: reduced ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 30 }, style: { height: "100%", background: RED } }) }), _jsx("div", { style: { flex: 1, minHeight: 0 }, children: _jsx(AnimatePresence, { mode: "wait", initial: false, children: _jsx(motion.div, { initial: reduced ? { opacity: 0 } : { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: reduced ? { opacity: 0 } : { opacity: 0, y: -8 }, transition: { duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }, children: step ? (_jsxs(_Fragment, { children: [step.eyebrow && (_jsx("div", { style: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: RED, marginBottom: 10 }, children: step.eyebrow })), step.title && (_jsx("h2", { style: { margin: "0 0 12px", fontSize: 23, lineHeight: 1.2, letterSpacing: "-0.02em", color: INK, fontWeight: 650 }, children: step.title })), step.body && (_jsx("p", { style: { margin: 0, fontSize: 15, lineHeight: 1.6, color: "#45413d" }, children: renderStyledText(step.body) })), step.imageUrl && (_jsx("img", { src: step.imageUrl, alt: "", style: { display: "block", width: "100%", borderRadius: 10, marginTop: 18, border: `1px solid ${LINE}` } }))] })) : (_jsxs(_Fragment, { children: [_jsx("h2", { style: { margin: "0 0 12px", fontSize: 23, lineHeight: 1.2, letterSpacing: "-0.02em", color: INK, fontWeight: 650 }, children: "That's the walkthrough." }), _jsx("p", { style: { margin: 0, fontSize: 15, lineHeight: 1.6, color: "#45413d" }, children: "The product stays where you left it \u2014 keep clicking around, or start again from the top." })] })) }, step?.id ?? "__done") }) }), _jsxs("div", { style: { paddingTop: 22 }, children: [step && manual && (_jsx("button", { type: "button", onClick: next, style: primary, children: manualLabel })), step && !manual && (_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: MUTED, minHeight: 38 }, children: [_jsx(motion.span, { animate: reduced ? {} : { opacity: [1, 0.25, 1] }, transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" }, style: { width: 7, height: 7, borderRadius: "50%", background: RED, flex: "none" } }), "Your turn \u2014 do it in the app"] })), !step && (_jsx("button", { type: "button", onClick: restart, style: primary, children: "Start again" })), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 14, marginTop: 14 }, children: [i > 0 && (_jsx("button", { type: "button", onClick: () => setI((n) => Math.max(0, n - 1)), style: ghost, children: "Back" })), step && !manual && nudge && (_jsx("button", { type: "button", onClick: next, style: ghost, children: "Skip this step" })), onExit && (_jsx("button", { type: "button", onClick: onExit, style: { ...ghost, marginLeft: "auto" }, children: "Exit" }))] })] })] }), demo.mode !== "blocked" && stage && (_jsxs("div", { ref: demo.stageRef, style: { flex: 1, position: "relative", overflow: "hidden", background: "#0f1115" }, children: [demo.mode === "mock" ? (_jsx(StageStill, { image: { src: stage.src, fit: stage.fit } })) : (
                    // Keyed by stage, so arriving in one is always a fresh document
                    // rather than whatever the last stage left in a reused frame.
                    _jsx("iframe", { ref: demo.frameRef, title: stage.label ?? content.title ?? "Product", src: demo.mode === "embed" ? stage.src : undefined, allowFullScreen: true, style: demo.frameStyle }, stage.id)), still ? (_jsx(StageStill, { image: still })) : (_jsxs(_Fragment, { children: [_jsx(Spotlight, { box: box, shape: step?.spotlight?.shape, dim: step?.spotlight?.dim, lock: step?.spotlight?.lock }), step?.callouts?.length ? _jsx(Callouts, { items: step.callouts, boxFor: calloutBox, bounds: demo.bounds }) : null] }))] })), demo.mode === "blocked" && !narrow && still && (_jsx("div", { style: { flex: 1, position: "relative", overflow: "hidden" }, children: _jsx(StageStill, { image: still }) })), demo.mode === "blocked" && !narrow && !still && (_jsx(StageNotice, { blocked: demo.blocked, src: stage?.src ?? "", stageId: stageId }))] }));
}
const primary = {
    appearance: "none",
    border: 0,
    background: RED,
    color: "#fff",
    font: "inherit",
    fontSize: 14,
    fontWeight: 600,
    padding: "10px 16px",
    borderRadius: 8,
    cursor: "pointer",
};
const ghost = {
    appearance: "none",
    border: 0,
    background: "none",
    color: MUTED,
    font: "inherit",
    fontSize: 13.5,
    padding: 0,
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: 3,
};
//# sourceMappingURL=WalkthroughPlayer.js.map