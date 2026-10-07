import { jsx as _jsx } from "react/jsx-runtime";
import { PhoneMockup } from "./PhoneMockup.js";
import { ComputerFrame } from "./ComputerFrame.js";
/** Renders a case-study thumbnail image, optionally wrapped in a device frame.
 * "none" → the bare image; "computer" → a monitor; "iphone" → the PhoneMockup
 * (its native 294px width scaled to `phoneWidth`). */
export function CaseStudyThumb({ src, frame = "none", phoneWidth = 230, fill = false }) {
    if (frame === "iphone") {
        const PHONE_W = 294, PHONE_H = 628;
        const s = phoneWidth / PHONE_W;
        // The scaled phone keeps its layout box, so reserve the scaled dimensions.
        return (_jsx("div", { style: { width: phoneWidth, height: PHONE_H * s, position: "relative", margin: "0 auto" }, children: _jsx("div", { style: { position: "absolute", top: 0, left: 0, transformOrigin: "top left", transform: `scale(${s})` }, children: _jsx(PhoneMockup, { src: src, fill: fill }) }) }));
    }
    if (frame === "computer")
        return _jsx(ComputerFrame, { src: src });
    // No frame — the bare image.
    const box = { width: "100%", borderRadius: 12, overflow: "hidden", display: "block", background: "#e5e5e5" };
    return src ? (_jsx("img", { src: src, alt: "", style: { ...box, height: "auto" } })) : (_jsx("div", { style: { ...box, aspectRatio: "16 / 10", display: "flex", alignItems: "center", justifyContent: "center", color: "#9a958e", fontSize: 13 }, children: "No thumbnail" }));
}
//# sourceMappingURL=CaseStudyThumb.js.map