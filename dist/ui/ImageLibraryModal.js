import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { isVideoSrc } from "../video.js";
import { useCaseStudyConfig } from "../config.js";
import { RED } from "../theme.js";
const defaultLibraryUrl = (path) => `/images/${path}`;
export function ImageLibraryModal({ onSelect, onClose }) {
    const { assets } = useCaseStudyConfig();
    const urlFor = assets?.libraryUrl ?? defaultLibraryUrl;
    const [imageFiles, setImageFiles] = useState([]);
    const [folder, setFolder] = useState(null); // null = folder index
    useEffect(() => {
        assets?.list?.().then(setImageFiles).catch(() => setImageFiles([]));
    }, [assets]);
    // Group files by their top-level folder ("" = loose files at the library root).
    const { folders, byFolder, rootFiles } = useMemo(() => {
        const byFolder = {};
        for (const f of imageFiles) {
            const slash = f.indexOf("/");
            const key = slash === -1 ? "" : f.slice(0, slash);
            (byFolder[key] ?? (byFolder[key] = [])).push(f);
        }
        return {
            byFolder,
            folders: Object.keys(byFolder).filter((k) => k !== "").sort(),
            rootFiles: byFolder[""] ?? [],
        };
    }, [imageFiles]);
    const media = { width: "100%", height: "100%", objectFit: "cover", display: "block" };
    const thumb = (file, alt) => isVideoSrc(file) ? _jsx("video", { src: urlFor(file), style: media, muted: true }) : _jsx("img", { src: urlFor(file), alt: alt, style: media });
    const tile = (file) => (_jsx(HoverButton, { onClick: () => onSelect(urlFor(file)), title: file, style: { aspectRatio: "1 / 1", overflow: "hidden", borderRadius: 4, padding: 0, border: "none", background: "none" }, hoverStyle: { boxShadow: `0 0 0 2px ${RED}` }, children: thumb(file, file) }, file));
    const grid = (cols) => ({ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 });
    const muted = "#8c8c8c";
    return createPortal(_jsx("div", { onClick: onClose, style: { position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }, children: _jsxs("div", { onClick: (e) => e.stopPropagation(), style: { background: "#fff", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.18)", width: 480, maxWidth: "calc(100vw - 32px)", maxHeight: "70vh", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "inherit" }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #d4d4d4" }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 }, children: [folder !== null && (_jsx(HoverButton, { onClick: () => setFolder(null), title: "Back to folders", style: { fontSize: 15, color: muted, lineHeight: 1, border: "none", background: "none", padding: 0 }, hoverStyle: { color: RED }, children: "\u2190" })), _jsx("span", { style: { fontSize: 13, fontWeight: 500, color: "#171717", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: folder !== null ? `Images / ${folder}` : "Select an image folder" })] }), _jsx(HoverButton, { onClick: onClose, style: { fontSize: 18, color: muted, lineHeight: 1, border: "none", background: "none", padding: 0 }, hoverStyle: { color: RED }, children: "\u00D7" })] }), _jsx("div", { style: { overflowY: "auto", padding: 16 }, children: imageFiles.length === 0 ? (_jsx("p", { style: { fontSize: 12, color: muted, textAlign: "center", padding: "24px 0", margin: 0 }, children: "No images found" })) : folder !== null ? (
                    /* Inside a folder: its images */
                    _jsx("div", { style: grid(4), children: (byFolder[folder] ?? []).map(tile) })) : (
                    /* Folder index: a card per folder, plus any loose root files */
                    _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 16 }, children: [folders.length > 0 && (_jsx("div", { style: grid(3), children: folders.map((name) => {
                                    const items = byFolder[name];
                                    const cover = items.find((f) => !isVideoSrc(f)) ?? items[0];
                                    return (_jsxs(HoverButton, { onClick: () => setFolder(name), title: name, style: { display: "flex", flexDirection: "column", borderRadius: 6, overflow: "hidden", border: "1px solid #e5e5e5", background: "#fff", padding: 0, textAlign: "left" }, hoverStyle: { borderColor: RED }, children: [_jsx("div", { style: { aspectRatio: "4 / 3", background: "#f5f5f5", overflow: "hidden", width: "100%" }, children: cover && thumb(cover, name) }), _jsxs("div", { style: { padding: "6px 8px", minWidth: 0, width: "100%", boxSizing: "border-box" }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 500, color: "#171717", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: name }), _jsxs("div", { style: { fontSize: 11, color: muted }, children: [items.length, " image", items.length === 1 ? "" : "s"] })] })] }, name));
                                }) })), rootFiles.length > 0 && (_jsxs("div", { children: [_jsx("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.025em", color: muted, marginBottom: 8 }, children: "Loose files" }), _jsx("div", { style: grid(4), children: rootFiles.map(tile) })] }))] })) })] }) }), document.body);
}
function HoverButton({ onClick, title, style, hoverStyle, children }) {
    const [hover, setHover] = useState(false);
    return (_jsx("button", { type: "button", onClick: onClick, title: title, onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false), style: { cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit", ...style, ...(hover ? hoverStyle : null) }, children: children }));
}
//# sourceMappingURL=ImageLibraryModal.js.map