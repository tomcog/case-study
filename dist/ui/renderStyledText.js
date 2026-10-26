import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { RED } from "../theme.js";
/**
 * Lightweight inline markup parser.
 *
 * Syntax:
 *   {text}        → red
 *   **text**      → bold
 *   {**text**}    → bold + red
 *   __text__      → bold + red  (legacy, same result)
 *   [label](url)  → link (red, underlined, opens in new tab)
 *   [text]        → middle gray
 *
 * A pause (`<pause 1 sec>`) isn't drawn at all: it is a beat in a slide's
 * build, read by splitPauses, and every place copy is drawn strips it.
 */
export function renderStyledText(text) {
    const pattern = /(\{(?:\*\*[^*]+\*\*|[^}]+)\}|\*\*[^*]+\*\*|__[^_]+__|\[[^\]]+\]\([^)]+\)|\[[^\]]+\])/g;
    const tokens = text.split(pattern);
    return tokens.map((token, i) => {
        // {**bold + red**} or {red}
        if (token.startsWith("{") && token.endsWith("}")) {
            const inner = token.slice(1, -1);
            if (inner.startsWith("**") && inner.endsWith("**")) {
                return _jsx("strong", { style: { fontWeight: 700, color: RED }, children: inner.slice(2, -2) }, i);
            }
            return _jsx("span", { style: { color: RED }, children: inner }, i);
        }
        // **bold**
        if (token.startsWith("**") && token.endsWith("**")) {
            return _jsx("strong", { style: { fontWeight: 700 }, children: token.slice(2, -2) }, i);
        }
        // __bold + red__ (legacy)
        if (token.startsWith("__") && token.endsWith("__")) {
            return _jsx("strong", { style: { fontWeight: 700, color: RED }, children: token.slice(2, -2) }, i);
        }
        // [label](url)
        const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch)
            return _jsx(StyledLink, { href: linkMatch[2], children: linkMatch[1] }, i);
        // [text] → middle gray, one step lighter than surrounding text
        if (token.startsWith("[") && token.endsWith("]")) {
            return _jsx("span", { style: { color: "#838383", fontWeight: "lighter" }, children: token.slice(1, -1) }, i);
        }
        return token;
    });
}
// Red link whose 4px underline wipes in from the left on hover.
function StyledLink({ href, children }) {
    const [hover, setHover] = useState(false);
    return (_jsxs("a", { href: href, target: "_blank", rel: "noopener noreferrer", onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false), style: { position: "relative", display: "inline-block", color: RED, fontWeight: 600, textDecoration: "none" }, children: [children, _jsx("span", { style: { position: "absolute", left: 0, right: 0, bottom: -1, height: 4, background: RED, transformOrigin: "left", transform: hover ? "scaleX(1)" : "scaleX(0)", transition: "transform 0.2s" } })] }));
}
// A beat in a slide's build: `<pause 1 sec>`, `<pause 1.5s>`, `<pause 500ms>`.
// A bare number is seconds, and `<pause>` alone is one second.
const PAUSE = /<pause(?:\s+(\d*\.?\d+)\s*(ms|milli(?:second)?s?|s|secs?|seconds?)?)?\s*>/gi;
const pauseSeconds = (n, unit) => n === undefined ? 1 : Number(n) / (unit && /^m/i.test(unit) ? 1000 : 1);
/** Copy cut at its pauses: each run of text with the seconds the build waits
 * before it (0 for the first run, unless the copy opens on a pause). The space
 * an author leaves after a pause is dropped, so `<pause 1 sec> Title` reads as
 * `Title`. */
export function splitPauses(text) {
    const parts = [];
    let wait = 0, at = 0;
    for (const m of text.matchAll(PAUSE)) {
        parts.push({ wait, text: text.slice(at, m.index) });
        wait = pauseSeconds(m[1], m[2]);
        at = m.index + m[0].length;
    }
    parts.push({ wait, text: text.slice(at) });
    return parts.map((p, i) => (i ? { ...p, text: p.text.replace(/^\s+/, "") } : p));
}
/** Copy with its pauses taken out, for anywhere it is shown without a build. */
export const stripPauses = (text) => splitPauses(text).map((p) => p.text).join("");
//# sourceMappingURL=renderStyledText.js.map