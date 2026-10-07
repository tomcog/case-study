import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Maximize2 } from "lucide-react";
import { useImageCaption } from "../config.js";
const HEADER_H = 48;
/** The single, site-wide full-size image viewer. A dark strip across the top
 * holds: a close button, a Fit-to-screen / View-full-size toggle, and the
 * image's caption. In "fit" mode the image is centered and scaled to the
 * viewport; in "full" mode it renders at natural size and the overlay scrolls.
 *
 * Caption/title can be passed explicitly (project galleries, case studies). If
 * neither is given, the caption falls back to the image's macOS Finder
 * "Comments" field via the dev server (localhost only; empty elsewhere). */
export function Lightbox({ src, onClose, caption, title, }) {
    const [zoom, setZoom] = useState("fit");
    // Reset zoom whenever a new image opens.
    useEffect(() => setZoom("fit"), [src]);
    // Caption/title come from the single per-image store (images.json), resolved
    // by path. An explicit prop wins when non-empty (e.g. a case-study slide that
    // types its own caption); otherwise fall back to the image's stored caption.
    const stored = useImageCaption(src);
    const effTitle = (title && title.length ? title : stored.title) || "";
    const captionText = (caption && caption.length ? caption : stored.caption) || "";
    // Esc closes.
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape")
            onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    return createPortal(_jsxs("div", { onClick: onClose, style: {
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "#ffffff",
            overflow: zoom === "full" ? "auto" : "hidden",
            // Fit centers; full flows from the top so tall images scroll.
            display: zoom === "full" ? "block" : "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: zoom === "full" ? `${HEADER_H + 12}px 0 48px` : `${HEADER_H + 12}px 32px 32px`,
            cursor: "zoom-out",
        }, children: [_jsxs("div", { onClick: (e) => e.stopPropagation(), style: {
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: HEADER_H,
                    zIndex: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "0 14px",
                    background: "#171717",
                    color: "#fff",
                    borderBottom: "1px solid rgba(255,255,255,0.12)",
                    cursor: "default",
                }, children: [_jsx("button", { type: "button", onClick: onClose, "aria-label": "Close", title: "Close (Esc)", style: {
                            flexShrink: 0,
                            width: 32,
                            height: 32,
                            borderRadius: 999,
                            border: "none",
                            background: "rgba(255,255,255,0.14)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                        }, children: _jsx(X, { size: 17 }) }), _jsx("button", { type: "button", onClick: () => setZoom((z) => (z === "fit" ? "full" : "fit")), style: {
                            flexShrink: 0,
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#fff",
                            background: "rgba(255,255,255,0.14)",
                            border: "none",
                            borderRadius: 999,
                            padding: "6px 14px",
                            cursor: "pointer",
                        }, children: zoom === "fit" ? "View full size" : "Fit to screen" }), _jsxs("div", { style: {
                            flex: 1,
                            minWidth: 0,
                            textAlign: "left",
                            fontSize: 13,
                            color: "#e8e6e2",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }, children: [effTitle ? _jsx("strong", { style: { fontWeight: 600 }, children: effTitle }) : null, effTitle && captionText ? _jsx("span", { style: { opacity: 0.6 }, children: "  —  " }) : null, captionText] })] }), _jsx("img", { src: src, alt: captionText || "", onClick: (e) => {
                    e.stopPropagation();
                    setZoom((z) => (z === "fit" ? "full" : "fit"));
                }, style: zoom === "full"
                    ? { display: "inline-block", cursor: "zoom-in" }
                    : { maxWidth: "100%", maxHeight: `calc(100vh - ${HEADER_H + 52}px)`, objectFit: "contain", cursor: "zoom-in" } })] }), document.body);
}
/** Wraps any clickable image so it gets the site-wide "this opens a lightbox"
 * affordance: an expand icon in a translucent circle that fades in on hover.
 * Self-contained (no Tailwind `group` dependency) so it drops into inline-styled
 * surfaces — content blocks, project thumbnails, case-study galleries. */
export function LightboxTrigger({ onOpen, children, style, title, disabled, }) {
    const [hover, setHover] = useState(false);
    if (disabled)
        return _jsx(_Fragment, { children: children });
    return (_jsxs("div", { onClick: onOpen, onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false), title: title, style: { position: "relative", cursor: "pointer", ...style }, children: [children, _jsx("div", { style: {
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: hover ? 1 : 0,
                    transition: "opacity 0.2s ease",
                    pointerEvents: "none",
                }, children: _jsx("div", { style: {
                        width: 48,
                        height: 48,
                        borderRadius: 999,
                        background: "rgba(40,37,35,0.65)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }, children: _jsx(Maximize2, { color: "#fff", size: 24 }) }) })] }));
}
//# sourceMappingURL=Lightbox.js.map