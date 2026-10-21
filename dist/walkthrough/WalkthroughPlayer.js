import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ─── Walkthrough player ────────────────────────────────────────────
// Full-viewport, two panes: stepped copy beside the live product. The product
// is an iframe driven through a Driver, and the spotlight is drawn here in the
// parent from the element boxes the driver reports, so the highlight keeps
// this package's look rather than the product's. The stage itself (frame,
// scaling, overlay) is shared with the builder — see stage.tsx.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { INK, RED } from "../theme.js";
import { renderStyledText } from "../ui/renderStyledText.js";
import { DemoNotice, Spotlight, toBox, useDemo } from "./stage.js";
import { targetAt } from "./types.js";
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
    const step = steps[i];
    const finished = i >= steps.length;
    const markIds = useMemo(() => marksOf(step?.spotlight?.mark), [step]);
    const markKey = markIds.join("|");
    // Which app this step runs in. Changing it swaps the framed document, which
    // the stage handles by standing up a driver for the new demo.
    const target = useMemo(() => targetAt(content, i), [content, i]);
    const demo = useDemo(target, markIds);
    const { driver, measure } = demo;
    const next = useCallback(() => setI((n) => n + 1), []);
    useEffect(() => {
        if (!driver || !step)
            return;
        let live = true;
        // Walking forward keeps whatever the reader just did; any other arrival
        // (first mount, Back, a jump) reloads the demo from the step's seed.
        const reseed = arrivedFrom.current !== i - 1;
        arrivedFrom.current = i;
        setNudge(false);
        const timers = [];
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
        const off = watch(driver, step.advance, () => live && next());
        const nudgeAt = window.setTimeout(() => live && setNudge(true), step.nudgeAfter ?? 12000);
        return () => {
            live = false;
            off();
            timers.forEach((t) => clearTimeout(t));
            clearTimeout(nudgeAt);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [driver, i, step, markKey]);
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
    const box = useMemo(() => toBox(markIds.map((id) => demo.rects[id]).filter(Boolean), demo.scale, step?.spotlight?.pad ?? 6), 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demo.rects, markKey, demo.scale, step]);
    const restart = () => {
        arrivedFrom.current = null;
        setI(0);
    };
    const narrow = demo.blocked === "small";
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
                }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 600, color: INK, letterSpacing: "-0.01em" }, children: content.title }), _jsx("span", { style: { fontSize: 12, color: MUTED, fontVariantNumeric: "tabular-nums" }, children: finished ? `${steps.length} of ${steps.length}` : `${i + 1} of ${steps.length}` })] }), _jsx("div", { style: { height: 3, background: LINE, borderRadius: 2, margin: "14px 0 26px", overflow: "hidden" }, children: _jsx(motion.div, { initial: { width: 0 }, animate: { width: `${((finished ? steps.length : i) / Math.max(1, steps.length)) * 100}%` }, transition: reduced ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 30 }, style: { height: "100%", background: RED } }) }), _jsx("div", { style: { flex: 1, minHeight: 0 }, children: _jsx(AnimatePresence, { mode: "wait", initial: false, children: _jsx(motion.div, { initial: reduced ? { opacity: 0 } : { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: reduced ? { opacity: 0 } : { opacity: 0, y: -8 }, transition: { duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }, children: step ? (_jsxs(_Fragment, { children: [step.eyebrow && (_jsx("div", { style: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: RED, marginBottom: 10 }, children: step.eyebrow })), step.title && (_jsx("h2", { style: { margin: "0 0 12px", fontSize: 23, lineHeight: 1.2, letterSpacing: "-0.02em", color: INK, fontWeight: 650 }, children: step.title })), step.body && (_jsx("p", { style: { margin: 0, fontSize: 15, lineHeight: 1.6, color: "#45413d" }, children: renderStyledText(step.body) })), step.imageUrl && (_jsx("img", { src: step.imageUrl, alt: "", style: { display: "block", width: "100%", borderRadius: 10, marginTop: 18, border: `1px solid ${LINE}` } }))] })) : (_jsxs(_Fragment, { children: [_jsx("h2", { style: { margin: "0 0 12px", fontSize: 23, lineHeight: 1.2, letterSpacing: "-0.02em", color: INK, fontWeight: 650 }, children: "That's the walkthrough." }), _jsx("p", { style: { margin: 0, fontSize: 15, lineHeight: 1.6, color: "#45413d" }, children: "The product stays where you left it \u2014 keep clicking around, or start again from the top." })] })) }, step?.id ?? "__done") }) }), _jsxs("div", { style: { paddingTop: 22 }, children: [step && step.advance.on === "manual" && (_jsx("button", { type: "button", onClick: next, style: primary, children: step.advance.label ?? "Next" })), step && step.advance.on !== "manual" && (_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: MUTED, minHeight: 38 }, children: [_jsx(motion.span, { animate: reduced ? {} : { opacity: [1, 0.25, 1] }, transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" }, style: { width: 7, height: 7, borderRadius: "50%", background: RED, flex: "none" } }), demo.framed ? "Your turn — do it in the app" : narrow ? "Open this on a wider screen to try it" : "This step needs the live demo"] })), !step && (_jsx("button", { type: "button", onClick: restart, style: primary, children: "Start again" })), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 14, marginTop: 14 }, children: [i > 0 && (_jsx("button", { type: "button", onClick: () => setI((n) => Math.max(0, n - 1)), style: ghost, children: "Back" })), step && step.advance.on !== "manual" && nudge && (_jsx("button", { type: "button", onClick: next, style: ghost, children: "Skip this step" })), onExit && (_jsx("button", { type: "button", onClick: onExit, style: { ...ghost, marginLeft: "auto" }, children: "Exit" }))] })] })] }), demo.framed && (_jsxs("div", { ref: demo.stageRef, style: { flex: 1, position: "relative", overflow: "hidden", background: "#0f1115" }, children: [_jsx("iframe", { ref: demo.frameRef, title: content.title ?? "Product", style: demo.frameStyle }), _jsx(Spotlight, { box: box, shape: step?.spotlight?.shape, lock: step?.spotlight?.lock })] })), !demo.framed && !narrow && _jsx(DemoNotice, { blocked: demo.blocked, src: target.src })] }));
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