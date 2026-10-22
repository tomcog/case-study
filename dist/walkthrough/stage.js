import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// ─── The frame ─────────────────────────────────────────────────────
// The running app at its own size, with whatever the step displays over it
// and the spotlight and callouts over that. The player and the builder share
// this so an author sees exactly what a reader will.
//
// The app is never scaled. It takes the pane's width and reflows with it,
// held between the min and max widths its entry in the pool asks for: below
// the floor the pane scrolls sideways, above the ceiling the app sits centered
// in it. A demo shrunk to fit is a demo nobody can read, and scrolling is the
// honest way to run out of room. So there is no canvas and no transform here:
// every box the Driver reports is in app pixels, shifted by the centering
// margin into stage pixels, and the overlays scroll with the frame because
// they share its scroll box.
//
// The app is mounted whenever a step names one, whether or not it is what the
// step displays — an image or an embed is drawn over it, so it keeps running
// and the next step picks the reader up where they left off. Those overlays
// report nothing, so anything drawn on them is positioned by an Area:
// fractions of the frame, resolved against its measured bounds.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { INK, RED } from "../theme.js";
import { renderStyledText } from "../ui/renderStyledText.js";
import { sameOriginDriver } from "./driver.js";
/** What shows behind the app: the margins beside one held to its max width,
 * and anything an app leaves transparent. White, since that is what most
 * apps assume they are drawn on. */
export const STAGE_BG = "#fff";
/** The box around one or more demo rects, in stage pixels — which are app
 * pixels, since the frame is never scaled. */
export function toBox(rects, pad = 6) {
    if (!rects.length)
        return null;
    const x1 = Math.min(...rects.map((r) => r.x)) - pad;
    const y1 = Math.min(...rects.map((r) => r.y)) - pad;
    const x2 = Math.max(...rects.map((r) => r.x + r.w)) + pad;
    const y2 = Math.max(...rects.map((r) => r.y + r.h)) + pad;
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
/** An Area resolved against the stage it sits on. Fractions in, pixels out. */
export function areaBox(area, bounds) {
    if (!area)
        return null;
    return { x: area.x * bounds.w, y: area.y * bounds.h, w: area.w * bounds.w, h: area.h * bounds.h };
}
/** Mount the app, keep it measured, and report its marks' geometry.
 *
 * `src` is the ingested app's entry, or undefined for a step running nothing.
 * The frame is keyed by it upstream, so arriving at a different app is always
 * a fresh document rather than whatever the last one left behind. */
export function useApp(src, marks, size) {
    const frameRef = useRef(null);
    const stageRef = useRef(null);
    const [driver, setDriver] = useState(null);
    const [bounds, setBounds] = useState({ w: 0, h: 0 });
    const [rects, setRects] = useState({});
    const [vw, setVw] = useState(() => window.innerWidth);
    const markKey = marks.join("|");
    const marksRef = useRef(marks);
    marksRef.current = marks;
    useEffect(() => {
        const on = () => setVw(window.innerWidth);
        window.addEventListener("resize", on);
        return () => window.removeEventListener("resize", on);
    }, []);
    // An app on another origin can't be read from here, so say so rather than
    // showing a frame that silently never responds. An embed is on another
    // origin by design and makes no such promise; this is only the app's problem.
    const foreign = useMemo(() => {
        if (!src)
            return false;
        try {
            return new URL(src, window.location.href).origin !== window.location.origin;
        }
        catch {
            return true;
        }
    }, [src]);
    const blocked = !src ? "no-app" : foreign ? "foreign" : vw < (size?.minWindow ?? 900) ? "small" : null;
    const live = !blocked;
    useEffect(() => {
        const el = frameRef.current;
        if (!live || !el || !src)
            return;
        const next = sameOriginDriver(el, src);
        setDriver(next);
        return () => {
            next.dispose();
            setDriver(null);
        };
    }, [live, src]);
    useEffect(() => {
        const el = stageRef.current;
        if (!el)
            return;
        const ro = new ResizeObserver(([entry]) => {
            const r = entry.contentRect;
            setBounds({ w: r.width, h: r.height });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    // Every rect was measured inside one app, so leaving it makes all of them
    // wrong rather than merely out of date. Dropping them is what stops a mark
    // from the app you just left being drawn over the one you arrived at.
    useEffect(() => {
        setRects({});
    }, [src]);
    // The app's own width, held to its range, and the margin that centers it
    // when the ceiling leaves the pane room to spare. CSS lays the frame out the
    // same way (min-width beats max-width there too); this is so the overlays
    // know where it went.
    const frameW = Math.max(size?.minWidth ?? 0, Math.min(size?.maxWidth ?? Infinity, bounds.w));
    const offsetX = Math.max(0, (bounds.w - frameW) / 2);
    const offsetRef = useRef(offsetX);
    offsetRef.current = offsetX;
    const measure = useCallback(() => {
        if (!driver)
            return;
        const ids = marksRef.current;
        const dx = offsetRef.current;
        const measured = ids.length ? driver.marks(ids) : {};
        const next = {};
        for (const id in measured)
            next[id] = { ...measured[id], x: measured[id].x + dx };
        // The app reports layout every frame while it animates; only a box that
        // actually moved is worth a render.
        setRects((prev) => (sameRects(prev, next) ? prev : next));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [driver, markKey]);
    // Follow these marks as the app reflows, not just when it scrolls.
    useEffect(() => {
        driver?.observe(marksRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [driver, markKey]);
    useEffect(() => {
        if (!driver)
            return;
        return driver.onLayout(measure);
    }, [driver, measure]);
    useEffect(() => {
        measure();
    }, [measure, bounds.w, bounds.h, offsetX]);
    // The app takes the pane and reflows with it, between its floor and its
    // ceiling: never into narrow breakpoints it wasn't designed for, never
    // stretched across a pane wider than it was designed to fill.
    const frameStyle = {
        width: "100%",
        minWidth: size?.minWidth,
        maxWidth: size?.maxWidth,
        height: "100%",
        margin: "0 auto",
        border: 0,
        display: "block",
    };
    // What the stage is as wide as: the pane, or the app's floor when the pane
    // is narrower than it. `bounds` stays the visible pane, since that is what
    // an Area is a fraction of.
    const contentW = Math.max(frameW, bounds.w);
    return { frameRef, stageRef, driver, rects, measure, live, blocked, frameStyle, bounds, contentW, offsetX };
}
const sameRects = (a, b) => {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length)
        return false;
    return keys.every((k) => {
        const x = a[k];
        const y = b[k];
        return y && x.x === y.x && x.y === y.y && x.w === y.w && x.h === y.h;
    });
};
/** A ring around the marked element, with the rest of the stage optionally
 * dimmed and optionally click-proof. The two are independent: the shield that
 * blocks clicks is the same four panels that do the dimming, so `lock` without
 * `dim` just makes them invisible. */
export function Spotlight({ box, shape, dim = true, lock, stageW }) {
    if (!box)
        return null;
    const shield = (part, key) => (_jsx("div", { style: {
            position: "absolute",
            background: dim ? "rgba(12,14,18,0.46)" : "transparent",
            pointerEvents: lock ? "auto" : "none",
            ...part,
        } }, key));
    return (_jsxs(_Fragment, { children: [(dim || lock) && (_jsxs(_Fragment, { children: [shield({ left: 0, top: 0, width: stageW ?? "100%", height: Math.max(0, box.y) }, "t"), shield({ left: 0, top: box.y + box.h, width: stageW ?? "100%", bottom: 0 }, "b"), shield({ left: 0, top: box.y, width: Math.max(0, box.x), height: box.h }, "l"), shield(stageW === undefined
                        ? { left: box.x + box.w, top: box.y, right: 0, height: box.h }
                        : { left: box.x + box.w, top: box.y, width: Math.max(0, stageW - box.x - box.w), height: box.h }, "r")] })), _jsx(motion.div, { initial: false, animate: { left: box.x, top: box.y, width: box.w, height: box.h }, transition: { type: "spring", stiffness: 420, damping: 36 }, style: {
                    position: "absolute",
                    borderRadius: shape === "pill" ? 999 : 10,
                    boxShadow: `0 0 0 2px ${RED}, 0 10px 30px -8px rgba(0,0,0,0.5)`,
                    pointerEvents: "none",
                } })] }));
}
/** What the author is about to pick, outlined as they move over the demo. */
export function HoverOutline({ box, ok }) {
    if (!box)
        return null;
    return (_jsx("div", { style: {
            position: "absolute",
            left: box.x,
            top: box.y,
            width: box.w,
            height: box.h,
            borderRadius: 8,
            border: `2px solid ${ok ? RED : "#e0a500"}`,
            background: ok ? "rgba(229,26,56,0.10)" : "rgba(224,165,0,0.12)",
            pointerEvents: "none",
        } }));
}
/** Drag a rectangle on the stage. This is how an opaque stage gets pointed at:
 * there is nothing to click for a mark, so the author draws the box instead.
 * Reported as fractions, so it survives the stage being any size later. */
export function AreaDraw({ bounds, onDone, onCancel }) {
    const [from, setFrom] = useState(null);
    const [to, setTo] = useState(null);
    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onCancel();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onCancel]);
    const at = (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const box = from && to && {
        x: Math.min(from.x, to.x),
        y: Math.min(from.y, to.y),
        w: Math.abs(to.x - from.x),
        h: Math.abs(to.y - from.y),
    };
    const finish = () => {
        if (box && box.w > 6 && box.h > 6 && bounds.w && bounds.h) {
            onDone({ x: box.x / bounds.w, y: box.y / bounds.h, w: box.w / bounds.w, h: box.h / bounds.h });
        }
        else {
            onCancel();
        }
    };
    return (_jsx("div", { onMouseDown: (e) => {
            const p = at(e);
            setFrom(p);
            setTo(p);
        }, onMouseMove: (e) => from && setTo(at(e)), onMouseUp: finish, onMouseLeave: () => from && finish(), style: { position: "absolute", inset: 0, cursor: "crosshair", background: "rgba(12,14,18,0.18)" }, children: box && (_jsx("div", { style: {
                position: "absolute",
                left: box.x,
                top: box.y,
                width: box.w,
                height: box.h,
                border: `2px solid ${RED}`,
                background: "rgba(229,26,56,0.10)",
                borderRadius: 8,
            } })) }));
}
/** An image covering the frame. It takes the clicks, so the app underneath
 * keeps running but can't be poked through it. */
export function StageStill({ image }) {
    const fill = image.fit === "fill";
    return (_jsx("div", { style: {
            position: "absolute",
            inset: 0,
            background: "#0f1115",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: fill ? 0 : 40,
        }, children: image.src && (_jsx("img", { src: image.src, alt: "", style: fill
                ? { width: "100%", height: "100%", objectFit: "cover", display: "block" }
                : { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block", borderRadius: 10, boxShadow: "0 20px 50px -20px rgba(0,0,0,0.6)" } })) }));
}
/** Why there's nothing running. Only shown when the step displays its app and
 * has none to display — an image or an embed needs no app at all. */
export function StageNotice({ blocked, src }) {
    const text = blocked === "no-app" ? (_jsx(_Fragment, { children: "This step isn't running an app. Pick one, or give it something else to display." })) : blocked === "foreign" ? (_jsxs(_Fragment, { children: [_jsx("strong", { children: src }), " is on another origin, so it can't be driven from here. Play this walkthrough on the site that serves the app, or display it as an ", _jsx("strong", { children: "embed" }), ", which is shown rather than driven."] })) : (_jsx(_Fragment, { children: "This app needs a wider window than this one." }));
    return (_jsx("div", { style: { flex: 1, display: "grid", placeItems: "center", padding: 32, color: "#6f6a66", fontSize: 14, textAlign: "center" }, children: _jsx("p", { style: { maxWidth: 440, lineHeight: 1.6 }, children: text }) }));
}
// ─── Callouts ──────────────────────────────────────────────────────
// Labels anchored to something in the frame. The anchor comes from the caller
// — a measured mark, or an Area resolved against the bounds — and the bubble
// is drawn at the stage's own size, which is the app's, since nothing here is
// scaled.
const BUBBLE_W = 236;
const GAP = 16;
/** The side with room for the bubble, preferring the one that was asked for. */
function sideFor(box, bounds, wanted) {
    const room = {
        right: bounds.w - (box.x + box.w),
        left: box.x,
        bottom: bounds.h - (box.y + box.h),
        top: box.y,
    };
    const fits = (s) => room[s] >= (s === "left" || s === "right" ? BUBBLE_W + GAP : 90 + GAP);
    if (wanted && fits(wanted))
        return wanted;
    return ["right", "left", "bottom", "top"].find(fits) ?? wanted ?? "right";
}
export function Callouts({ items, boxFor, bounds }) {
    const placed = items
        .map((callout, i) => {
        const box = boxFor(callout);
        if (!box)
            return null;
        // An anchor scrolled out of the stage has nothing to point at.
        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        if (cx < 0 || cy < 0 || cx > bounds.w || cy > bounds.h)
            return null;
        const side = sideFor(box, bounds, callout.placement);
        const dx = callout.offset?.x ?? 0;
        const dy = callout.offset?.y ?? 0;
        const edge = side === "right" ? { x: box.x + box.w, y: cy }
            : side === "left" ? { x: box.x, y: cy }
                : side === "bottom" ? { x: cx, y: box.y + box.h }
                    : { x: cx, y: box.y };
        const anchor = side === "right" ? { x: edge.x + GAP, y: edge.y }
            : side === "left" ? { x: edge.x - GAP, y: edge.y }
                : side === "bottom" ? { x: edge.x, y: edge.y + GAP }
                    : { x: edge.x, y: edge.y - GAP };
        const shift = side === "right" ? "translate(0, -50%)"
            : side === "left" ? "translate(-100%, -50%)"
                : side === "bottom" ? "translate(-50%, 0)"
                    : "translate(-50%, -100%)";
        // Flipping sides isn't enough on its own: a bubble centred on an element
        // near an edge still hangs off it. Clamp it inside the stage and let the
        // leader line angle across to the element.
        const PAD = 10;
        const half = BUBBLE_W / 2;
        const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
        const x = anchor.x + dx;
        const y = anchor.y + dy;
        const placedAt = side === "top" || side === "bottom"
            ? { x: clamp(x, half + PAD, bounds.w - half - PAD), y }
            : { x, y: clamp(y, 44 + PAD, bounds.h - 44 - PAD) };
        return { key: `${callout.mark ?? "area"}-${i}`, callout, edge, anchor: placedAt, shift };
    })
        .filter((p) => !!p);
    if (!placed.length)
        return null;
    return (_jsxs(_Fragment, { children: [_jsx("svg", { width: bounds.w, height: bounds.h, style: { position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }, children: placed.map((p) => (_jsxs("g", { children: [_jsx("line", { x1: p.edge.x, y1: p.edge.y, x2: p.anchor.x, y2: p.anchor.y, stroke: RED, strokeWidth: 1.5 }), _jsx("circle", { cx: p.edge.x, cy: p.edge.y, r: 3.5, fill: RED })] }, p.key))) }), placed.map((p) => (_jsx("div", { style: {
                    position: "absolute",
                    left: p.anchor.x,
                    top: p.anchor.y,
                    transform: p.shift,
                    width: BUBBLE_W,
                    background: "#fff",
                    border: "1px solid #e6e4e1",
                    borderRadius: 9,
                    boxShadow: "0 10px 28px -10px rgba(0,0,0,0.45)",
                    padding: "9px 12px",
                    fontSize: 13,
                    lineHeight: 1.45,
                    color: INK,
                    pointerEvents: "none",
                }, children: renderStyledText(p.callout.text) }, p.key)))] }));
}
//# sourceMappingURL=stage.js.map