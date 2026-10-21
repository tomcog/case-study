import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ─── Walkthrough player ────────────────────────────────────────────
// Full-viewport, two panes: stepped copy beside the live product. The product
// is an iframe the player drives through a Driver, and the spotlight is drawn
// here in the parent from the element boxes the driver reports, so the
// highlight keeps this package's look rather than the product's.
//
// Unlike a case study there is no fixed canvas: the frame gets a real viewport
// width and the stage scales to fit it, so every reported box is multiplied by
// that scale on its way to the overlay.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { INK, RED } from "../theme.js";
import { renderStyledText } from "../ui/renderStyledText.js";
import { sameOriginDriver } from "./driver.js";
const PANEL_W = 400;
const LINE = "#e6e4e1";
const MUTED = "#6f6a66";
const norm = (path) => `#${path.replace(/^#\/?/, "").replace(/\/$/, "")}`;
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
export function WalkthroughPlayer({ content, onExit }) {
    const { target, steps } = content;
    const reduced = useReducedMotion();
    const frameRef = useRef(null);
    const stageRef = useRef(null);
    const [driver, setDriver] = useState(null);
    const [stage, setStage] = useState({ w: 0, h: 0 });
    const [i, setI] = useState(0);
    const [rects, setRects] = useState({});
    const [nudge, setNudge] = useState(false);
    const arrivedFrom = useRef(null); // null = nothing visited yet, so step 0 still seeds
    const step = steps[i];
    const finished = i >= steps.length;
    const markIds = useMemo(() => {
        const mark = step?.spotlight?.mark;
        if (!mark)
            return [];
        return Array.isArray(mark) ? mark : [mark];
    }, [step]);
    const markKey = markIds.join("|");
    // A demo on another origin can't be read from here, so say so rather than
    // showing a frame that silently never responds.
    const foreign = useMemo(() => {
        try {
            return new URL(target.src, window.location.href).origin !== window.location.origin;
        }
        catch {
            return true;
        }
    }, [target.src]);
    const [vw, setVw] = useState(() => window.innerWidth);
    useEffect(() => {
        const on = () => setVw(window.innerWidth);
        window.addEventListener("resize", on);
        return () => window.removeEventListener("resize", on);
    }, []);
    const small = vw < (target.minWidth ?? 900);
    const framed = !small && !foreign && !!target.src;
    useEffect(() => {
        const el = frameRef.current;
        if (!framed || !el)
            return;
        const next = sameOriginDriver(el, target.src);
        setDriver(next);
        return () => {
            next.dispose();
            setDriver(null);
        };
    }, [framed, target.src]);
    useEffect(() => {
        const el = stageRef.current;
        if (!el)
            return;
        const ro = new ResizeObserver(([entry]) => {
            const r = entry.contentRect;
            setStage({ w: r.width, h: r.height });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [framed]);
    const measure = useCallback(() => {
        if (!driver)
            return;
        setRects(markIds.length ? driver.marks(markIds) : {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [driver, markKey]);
    useEffect(() => {
        if (!driver)
            return;
        return driver.onLayout(measure);
    }, [driver, measure]);
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
        setRects({});
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
    const width = target.width ?? stage.w;
    const scale = stage.w && width ? Math.min(1, stage.w / width) : 1;
    const box = useMemo(() => {
        const found = markIds.map((id) => rects[id]).filter(Boolean);
        if (!found.length)
            return null;
        const pad = step?.spotlight?.pad ?? 6;
        const x1 = Math.min(...found.map((r) => r.x)) - pad;
        const y1 = Math.min(...found.map((r) => r.y)) - pad;
        const x2 = Math.max(...found.map((r) => r.x + r.w)) + pad;
        const y2 = Math.max(...found.map((r) => r.y + r.h)) + pad;
        return { x: x1 * scale, y: y1 * scale, w: (x2 - x1) * scale, h: (y2 - y1) * scale };
    }, [rects, markKey, scale, step]);
    const restart = () => {
        arrivedFrom.current = null;
        setI(0);
    };
    const panel = (_jsxs("div", { style: {
            width: small ? "100%" : PANEL_W,
            flex: "none",
            background: "#fff",
            borderRight: small || content.panelSide === "right" ? undefined : `1px solid ${LINE}`,
            borderLeft: content.panelSide === "right" && !small ? `1px solid ${LINE}` : undefined,
            display: "flex",
            flexDirection: "column",
            padding: "26px 28px 22px",
            overflowY: "auto",
        }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 600, color: INK, letterSpacing: "-0.01em" }, children: content.title }), _jsx("span", { style: { fontSize: 12, color: MUTED, fontVariantNumeric: "tabular-nums" }, children: finished ? `${steps.length} of ${steps.length}` : `${i + 1} of ${steps.length}` })] }), _jsx("div", { style: { height: 3, background: LINE, borderRadius: 2, margin: "14px 0 26px", overflow: "hidden" }, children: _jsx(motion.div, { initial: { width: 0 }, animate: { width: `${((finished ? steps.length : i) / steps.length) * 100}%` }, transition: reduced ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 30 }, style: { height: "100%", background: RED } }) }), _jsx("div", { style: { flex: 1, minHeight: 0 }, children: _jsx(AnimatePresence, { mode: "wait", initial: false, children: _jsx(motion.div, { initial: reduced ? { opacity: 0 } : { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: reduced ? { opacity: 0 } : { opacity: 0, y: -8 }, transition: { duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }, children: step ? (_jsxs(_Fragment, { children: [step.eyebrow && (_jsx("div", { style: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: RED, marginBottom: 10 }, children: step.eyebrow })), step.title && (_jsx("h2", { style: { margin: "0 0 12px", fontSize: 23, lineHeight: 1.2, letterSpacing: "-0.02em", color: INK, fontWeight: 650 }, children: step.title })), step.body && (_jsx("p", { style: { margin: 0, fontSize: 15, lineHeight: 1.6, color: "#45413d" }, children: renderStyledText(step.body) })), step.imageUrl && (_jsx("img", { src: step.imageUrl, alt: "", style: { display: "block", width: "100%", borderRadius: 10, marginTop: 18, border: `1px solid ${LINE}` } }))] })) : (_jsxs(_Fragment, { children: [_jsx("h2", { style: { margin: "0 0 12px", fontSize: 23, lineHeight: 1.2, letterSpacing: "-0.02em", color: INK, fontWeight: 650 }, children: "That's the walkthrough." }), _jsx("p", { style: { margin: 0, fontSize: 15, lineHeight: 1.6, color: "#45413d" }, children: "The product stays where you left it \u2014 keep clicking around, or start again from the top." })] })) }, step?.id ?? "__done") }) }), _jsxs("div", { style: { paddingTop: 22 }, children: [step && step.advance.on === "manual" && (_jsx("button", { type: "button", onClick: next, style: primary, children: step.advance.label ?? "Next" })), step && step.advance.on !== "manual" && (_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: MUTED, minHeight: 38 }, children: [_jsx(motion.span, { animate: reduced ? {} : { opacity: [1, 0.25, 1] }, transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" }, style: { width: 7, height: 7, borderRadius: "50%", background: RED, flex: "none" } }), framed ? "Your turn — do it in the app" : "Open this on a wider screen to try it"] })), !step && (_jsx("button", { type: "button", onClick: restart, style: primary, children: "Start again" })), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 14, marginTop: 14 }, children: [i > 0 && (_jsx("button", { type: "button", onClick: () => setI((n) => Math.max(0, n - 1)), style: ghost, children: "Back" })), step && step.advance.on !== "manual" && nudge && (_jsx("button", { type: "button", onClick: next, style: ghost, children: "Skip this step" })), onExit && (_jsx("button", { type: "button", onClick: onExit, style: { ...ghost, marginLeft: "auto" }, children: "Exit" }))] })] })] }));
    const scrim = (part) => (_jsx("div", { style: { position: "absolute", background: "rgba(12,14,18,0.46)", pointerEvents: step?.spotlight?.lock ? "auto" : "none", ...part } }));
    return (_jsxs("div", { style: {
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: content.panelSide === "right" ? "row-reverse" : "row",
            background: "#f4f3f1",
            zIndex: 50,
        }, children: [panel, framed && (_jsxs("div", { ref: stageRef, style: { flex: 1, position: "relative", overflow: "hidden", background: "#0f1115" }, children: [_jsx("iframe", { ref: frameRef, title: content.title ?? "Product", style: {
                            width: width || "100%",
                            height: scale ? stage.h / scale : "100%",
                            border: 0,
                            display: "block",
                            transform: `scale(${scale})`,
                            transformOrigin: "top left",
                        } }), box && (_jsxs(_Fragment, { children: [scrim({ left: 0, top: 0, width: "100%", height: Math.max(0, box.y) }), scrim({ left: 0, top: box.y + box.h, width: "100%", bottom: 0 }), scrim({ left: 0, top: box.y, width: Math.max(0, box.x), height: box.h }), scrim({ left: box.x + box.w, top: box.y, right: 0, height: box.h }), _jsx(motion.div, { initial: false, animate: { left: box.x, top: box.y, width: box.w, height: box.h }, transition: reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }, style: {
                                    position: "absolute",
                                    borderRadius: step?.spotlight?.shape === "pill" ? 999 : 10,
                                    boxShadow: `0 0 0 2px ${RED}, 0 10px 30px -8px rgba(0,0,0,0.5)`,
                                    pointerEvents: "none",
                                } })] }))] })), !framed && !small && (_jsx("div", { style: { flex: 1, display: "grid", placeItems: "center", padding: 32, color: MUTED, fontSize: 14, textAlign: "center" }, children: _jsx("p", { style: { maxWidth: 380, lineHeight: 1.6 }, children: !target.src ? (_jsxs(_Fragment, { children: ["This walkthrough doesn't point at a demo yet. Set its ", _jsx("strong", { children: "target.src" }), " to a demo served from this site."] })) : (_jsxs(_Fragment, { children: ["This walkthrough drives a demo hosted alongside it. ", _jsx("strong", { children: target.src }), " is on another origin, so it can't be driven from here \u2014 play it on the site that hosts the demo."] })) }) }))] }));
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