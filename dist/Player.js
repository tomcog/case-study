import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { X, ArrowLeft, ArrowRight } from "lucide-react";
import { ACCENT, EASE, screenVariants, reducedScreenVariants, bleedBg, backdropFor, Stage, ScreenView, } from "./core.js";
// ─── The immersive player ──────────────────────────────────────────
// Full-viewport, one screen at a time. Click the right/left of the screen, use
// the arrow keys, or the corner buttons to move; Esc (or the X) calls onExit.
export function Player({ screens, onExit, startIndex = 0, logoSrc }) {
    const reduced = !!useReducedMotion();
    const [[index, dir], setState] = useState([startIndex, 0]);
    // Arrow-keys hint — shown once per browser session, the first time any project
    // is opened (dismissable). Mark it "seen" on mount so later projects skip it.
    const [showKeyTip, setShowKeyTip] = useState(() => {
        try {
            return !sessionStorage.getItem("player-arrow-tip-seen");
        }
        catch {
            return false;
        }
    });
    useEffect(() => {
        if (showKeyTip) {
            try {
                sessionStorage.setItem("player-arrow-tip-seen", "1");
            }
            catch { /* ignore */ }
        }
        // Run once on mount; showKeyTip's initial value is what matters here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const paginate = useCallback((delta) => {
        setState(([i]) => {
            const next = Math.min(Math.max(i + delta, 0), screens.length - 1);
            return [next, delta];
        });
    }, [screens.length]);
    // Lock body scroll while the player is mounted
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prev; };
    }, []);
    // Keyboard navigation
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
                e.preventDefault();
                paginate(1);
            }
            else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                paginate(-1);
            }
            else if (e.key === "Escape")
                onExit();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [paginate, onExit]);
    const screen = screens[index];
    const atStart = index === 0;
    const atEnd = index === screens.length - 1;
    // On interactive slides (gallery lightbox, embedded video, outbound CTA link),
    // let clicks reach the content instead of the full-screen nav zones; navigate
    // via keyboard or the arrow buttons there.
    // A Basic 2-column image in a framed/boxed mode is clickable (opens a lightbox).
    const basic2Lightbox = screen.layout === "basic2" && !!screen.imageUrl &&
        ["fit", "fill", "desktop", "mobile"].includes(screen.basicImage);
    const interactive = screen.layout === "gallery" || screen.layout === "video" || !!screen.linkUrl || basic2Lightbox;
    const navZones = interactive ? "none" : "auto";
    return (_jsxs("div", { style: { position: "fixed", inset: 0, zIndex: 60, background: bleedBg(screen), overflow: "hidden" }, children: [_jsx(AnimatePresence, { custom: dir, initial: false, children: _jsx(motion.div, { custom: dir, variants: reduced ? reducedScreenVariants : screenVariants, initial: "enter", animate: "center", exit: "exit", transition: reduced ? { duration: 0.3 } : { duration: 0.62, ease: EASE }, style: { position: "absolute", inset: 0 }, children: _jsx(Stage, { background: bleedBg(screen), backdrop: backdropFor(screen), children: _jsx(ScreenView, { screen: screen, play: true, reduced: reduced, logoSrc: logoSrc }) }) }, screen.id + ":" + index) }), _jsx("button", { onClick: (e) => { e.currentTarget.blur(); paginate(-1); }, "aria-label": "Previous", style: { position: "absolute", left: 0, top: 0, bottom: 0, width: "28%", background: "transparent", border: "none", outline: "none", cursor: atStart ? "default" : "w-resize", zIndex: 70, pointerEvents: navZones } }), _jsx("button", { onClick: (e) => { e.currentTarget.blur(); paginate(1); }, "aria-label": "Next", style: { position: "absolute", right: 0, top: 0, bottom: 0, width: "60%", background: "transparent", border: "none", outline: "none", cursor: atEnd ? "default" : "e-resize", zIndex: 70, pointerEvents: navZones } }), _jsx("button", { onClick: onExit, title: "Exit (Esc)", style: { ...navBtn(false), position: "absolute", top: 24, left: 24, zIndex: 80 }, children: _jsx(X, { size: 18 }) }), showKeyTip && (_jsxs("div", { style: { position: "absolute", bottom: 84, right: 24, zIndex: 85, maxWidth: 250, display: "flex", alignItems: "flex-start", gap: 10, background: ACCENT, color: "#fff", borderRadius: 10, padding: "12px 12px 12px 14px", boxShadow: "0 10px 30px rgba(0,0,0,0.35)", fontSize: 13, lineHeight: 1.45 }, children: [_jsx("span", { children: "Use left and right arrows keys to navigate presentation." }), _jsx("button", { onClick: () => setShowKeyTip(false), "aria-label": "Dismiss tip", style: { flexShrink: 0, width: 22, height: 22, marginTop: -2, borderRadius: 999, border: "none", background: "rgba(255,255,255,0.14)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }, children: _jsx(X, { size: 13 }) })] })), _jsxs("div", { style: { position: "absolute", bottom: 24, right: 24, zIndex: 80, display: "flex", alignItems: "center", gap: 12, color: "#fff" }, children: [_jsx("button", { onClick: () => paginate(-1), disabled: atStart, title: "Previous", style: navBtn(atStart), children: _jsx(ArrowLeft, { size: 18 }) }), _jsx("button", { onClick: () => paginate(1), disabled: atEnd, title: "Next", style: navBtn(atEnd), children: _jsx(ArrowRight, { size: 18 }) })] })] }));
}
function navBtn(disabled) {
    return {
        width: 36, height: 36, borderRadius: 999, border: "none",
        cursor: disabled ? "default" : "pointer",
        background: "#e5e5e5", color: "#000",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
    };
}
//# sourceMappingURL=Player.js.map