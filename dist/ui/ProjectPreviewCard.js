import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLayoutEffect, useRef, useState } from "react";
import { LogoMark } from "./LogoMark.js";
import { renderStyledText } from "./renderStyledText.js";
import { RED, INK as BLACK, OVERLAY_GRADIENT, MONO_FILTER } from "../theme.js";
// Design reference (from Figma node 264:784): 460×260 card, image on the left
// half, text on the right. Rendered at the fixed design size and scaled to fit
// its container width so the proportions/type stay exact at any card size.
const CARD_W = 460;
const CARD_H = 260;
export function ProjectPreviewCard({ image, imageOverlay, imageMono, eyebrow, title, body, logo }) {
    const ref = useRef(null);
    const [scale, setScale] = useState(1);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        const compute = () => setScale(el.clientWidth / CARD_W);
        compute();
        const ro = new ResizeObserver(compute);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return (_jsx("div", { ref: ref, style: { position: "relative", width: "100%", aspectRatio: `${CARD_W} / ${CARD_H}` }, children: _jsx("div", { style: { position: "absolute", top: 0, left: 0, width: CARD_W, height: CARD_H, transformOrigin: "top left", transform: `scale(${scale})` }, children: _jsxs("div", { style: {
                    display: "flex", width: CARD_W, height: CARD_H, borderRadius: 16, overflow: "hidden",
                    background: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
                }, children: [_jsxs("div", { style: { position: "relative", width: CARD_W / 2, height: CARD_H, flexShrink: 0, background: "#e9e7e3", overflow: "hidden" }, children: [image && _jsx("img", { src: image, alt: "", style: { width: "100%", height: "100%", objectFit: "cover", display: "block", filter: imageMono ? MONO_FILTER : undefined } }), imageOverlay && _jsx("div", { style: { position: "absolute", inset: 0, background: OVERLAY_GRADIENT } }), logo && _jsx(LogoMark, { src: logo, position: "left top", style: { position: "absolute", left: 20, top: 20, width: "63%", maxWidth: 135, height: 31.5 } })] }), _jsxs("div", { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12, padding: "40px 40px 40px 20px" }, children: [eyebrow && (_jsx("div", { style: { fontSize: 12, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: RED, lineHeight: 1, wordBreak: "break-word" }, children: renderStyledText(eyebrow) })), title && (_jsx("div", { style: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.25, color: BLACK, wordBreak: "break-word" }, children: renderStyledText(title) })), body && (_jsx("div", { style: { fontSize: 14, fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 1.5, color: BLACK, wordBreak: "break-word" }, children: renderStyledText(body) }))] })] }) }) }));
}
//# sourceMappingURL=ProjectPreviewCard.js.map