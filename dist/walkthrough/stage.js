import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// ─── Demo stage ────────────────────────────────────────────────────
// The live product scaled to fit its pane, and the spotlight drawn over it.
// The player and the builder share this so an author sees exactly what a
// reader will.
//
// There is no fixed canvas here as there is for a screen: the frame gets a
// real viewport width and the stage scales to fit it, so every box the driver
// reports is in demo pixels and is multiplied by that scale on its way out.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { RED } from "../theme.js";
import { sameOriginDriver } from "./driver.js";
/** The box around one or more demo rects, in stage pixels. */
export function toBox(rects, scale, pad = 6) {
    if (!rects.length)
        return null;
    const x1 = Math.min(...rects.map((r) => r.x)) - pad;
    const y1 = Math.min(...rects.map((r) => r.y)) - pad;
    const x2 = Math.max(...rects.map((r) => r.x + r.w)) + pad;
    const y2 = Math.max(...rects.map((r) => r.y + r.h)) + pad;
    return { x: x1 * scale, y: y1 * scale, w: (x2 - x1) * scale, h: (y2 - y1) * scale };
}
/** Mount the demo, keep it measured, and report the marks' geometry. */
export function useDemo(target, marks) {
    const frameRef = useRef(null);
    const stageRef = useRef(null);
    const [driver, setDriver] = useState(null);
    const [size, setSize] = useState({ w: 0, h: 0 });
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
    // A demo on another origin can't be read from here, so say so rather than
    // showing a frame that silently never responds.
    const foreign = useMemo(() => {
        if (!target.src)
            return false;
        try {
            return new URL(target.src, window.location.href).origin !== window.location.origin;
        }
        catch {
            return true;
        }
    }, [target.src]);
    const blocked = !target.src
        ? "no-demo"
        : foreign
            ? "foreign"
            : vw < (target.minWidth ?? 900)
                ? "small"
                : null;
    const framed = !blocked;
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
            setSize({ w: r.width, h: r.height });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [framed]);
    const measure = useCallback(() => {
        if (!driver)
            return;
        const ids = marksRef.current;
        setRects(ids.length ? driver.marks(ids) : {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [driver, markKey]);
    useEffect(() => {
        if (!driver)
            return;
        return driver.onLayout(measure);
    }, [driver, measure]);
    useEffect(() => {
        measure();
    }, [measure, size.w, size.h]);
    const width = target.width ?? size.w;
    const scale = size.w && width ? Math.min(1, size.w / width) : 1;
    const frameStyle = {
        width: width || "100%",
        height: scale ? size.h / scale : "100%",
        border: 0,
        display: "block",
        transform: `scale(${scale})`,
        transformOrigin: "top left",
    };
    return { frameRef, stageRef, driver, rects, scale, measure, framed, blocked, frameStyle };
}
/** Everything but the marked element, dimmed — and optionally click-proof. */
export function Spotlight({ box, shape, lock }) {
    if (!box)
        return null;
    const scrim = (part, key) => (_jsx("div", { style: { position: "absolute", background: "rgba(12,14,18,0.46)", pointerEvents: lock ? "auto" : "none", ...part } }, key));
    return (_jsxs(_Fragment, { children: [scrim({ left: 0, top: 0, width: "100%", height: Math.max(0, box.y) }, "t"), scrim({ left: 0, top: box.y + box.h, width: "100%", bottom: 0 }, "b"), scrim({ left: 0, top: box.y, width: Math.max(0, box.x), height: box.h }, "l"), scrim({ left: box.x + box.w, top: box.y, right: 0, height: box.h }, "r"), _jsx(motion.div, { initial: false, animate: { left: box.x, top: box.y, width: box.w, height: box.h }, transition: { type: "spring", stiffness: 420, damping: 36 }, style: {
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
/** Why there's no live demo to show. */
export function DemoNotice({ blocked, src }) {
    const text = blocked === "no-demo" ? (_jsxs(_Fragment, { children: ["This walkthrough doesn't point at a demo yet. Set its ", _jsx("strong", { children: "demo path" }), " to something served from this site, such as", " ", _jsx("code", { children: "/projects/<id>/demo/index.html" }), "."] })) : blocked === "foreign" ? (_jsxs(_Fragment, { children: [_jsx("strong", { children: src }), " is on another origin, so it can't be driven from here \u2014 play this walkthrough on the site that hosts the demo."] })) : (_jsx(_Fragment, { children: "The demo needs a wider window than this one." }));
    return (_jsx("div", { style: { flex: 1, display: "grid", placeItems: "center", padding: 32, color: "#6f6a66", fontSize: 14, textAlign: "center" }, children: _jsx("p", { style: { maxWidth: 420, lineHeight: 1.6 }, children: text }) }));
}
//# sourceMappingURL=stage.js.map