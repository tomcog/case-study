import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** A simple desktop-monitor frame: bezel + 16:10 screen + neck/base. Fills its
 * container's width and scales naturally. Used for case-study thumbnails. */
export function ComputerFrame({ src, alt = "Desktop preview" }) {
    const wrap = { display: "flex", flexDirection: "column", alignItems: "center", width: "100%" };
    const bezel = {
        width: "100%", background: "#1c1c1e", borderRadius: 14, padding: 10,
        border: "1px solid #3c3c3e", outline: "1px solid #0a0a0b", outlineOffset: 1, boxSizing: "border-box",
    };
    const screen = {
        width: "100%", aspectRatio: "16 / 10", background: "#000", borderRadius: 5, overflow: "hidden",
    };
    const neck = { width: "14%", height: 16, background: "#2c2c2e" };
    const base = { width: "34%", height: 8, background: "#2c2c2e", borderRadius: "0 0 4px 4px" };
    return (_jsxs("div", { style: wrap, children: [_jsx("div", { style: bezel, children: _jsx("div", { style: screen, children: src ? (_jsx("img", { src: src, alt: alt, style: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" } })) : (_jsx("div", { style: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#5a5a5e", fontSize: 13 }, children: "No image" })) }) }), _jsx("div", { style: neck }), _jsx("div", { style: base })] }));
}
//# sourceMappingURL=ComputerFrame.js.map