import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { Wifi, BatteryFull } from "lucide-react";
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function formatClock(d) {
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const h12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${h12}:${minutes}`;
}
export function PhoneMockup({ src, alt = "Mobile layout preview", allowUpload = false, className, fill = false, }) {
    const [displaySrc, setDisplaySrc] = useState(src);
    const [uploadedMeta, setUploadedMeta] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [clock, setClock] = useState(() => formatClock(new Date()));
    const [showScrollHint, setShowScrollHint] = useState(false);
    // Avoid flashing into a half-loaded page: stay invisible (but keep layout
    // space reserved) until window.load fires, when above-the-fold images have
    // finished and the mockup's final position is settled.
    const [pageLoaded, setPageLoaded] = useState(() => typeof document !== "undefined" && document.readyState === "complete");
    const scrollAreaRef = useRef(null);
    const fileInputRef = useRef(null);
    useEffect(() => {
        if (pageLoaded)
            return;
        if (typeof document !== "undefined" && document.readyState === "complete") {
            setPageLoaded(true);
            return;
        }
        const onLoad = () => setPageLoaded(true);
        window.addEventListener("load", onLoad);
        return () => window.removeEventListener("load", onLoad);
    }, [pageLoaded]);
    // Sync incoming src prop
    useEffect(() => {
        setDisplaySrc(src);
        setUploadedMeta(null);
    }, [src]);
    // Reset scroll when image changes
    useEffect(() => {
        if (scrollAreaRef.current)
            scrollAreaRef.current.scrollTop = 0;
    }, [displaySrc]);
    // Live clock — every 30s
    useEffect(() => {
        const tick = () => setClock(formatClock(new Date()));
        const interval = setInterval(tick, 30000);
        return () => clearInterval(interval);
    }, []);
    // Tall-image scroll hint — persists until the user scrolls inside the screen
    useEffect(() => {
        setShowScrollHint(false);
        if (!displaySrc)
            return;
        const probe = new Image();
        probe.onload = () => {
            if (probe.naturalHeight > probe.naturalWidth * 1.5) {
                setShowScrollHint(true);
            }
        };
        probe.src = displaySrc;
    }, [displaySrc]);
    // Hide hint as soon as the user starts scrolling inside the phone screen
    useEffect(() => {
        if (!showScrollHint)
            return;
        const el = scrollAreaRef.current;
        if (!el)
            return;
        const onScroll = () => setShowScrollHint(false);
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => el.removeEventListener("scroll", onScroll);
    }, [showScrollHint]);
    const handleFile = (file) => {
        if (!file.type.startsWith("image/"))
            return;
        const objectUrl = URL.createObjectURL(file);
        const probe = new Image();
        probe.onload = () => {
            setUploadedMeta({ width: probe.naturalWidth, height: probe.naturalHeight, size: file.size });
        };
        probe.src = objectUrl;
        setDisplaySrc(objectUrl);
    };
    const onFileInputChange = (e) => {
        const file = e.target.files?.[0];
        if (file)
            handleFile(file);
        if (fileInputRef.current)
            fileInputRef.current.value = "";
    };
    const onDropZoneDragOver = (e) => {
        e.preventDefault();
        setDragActive(true);
    };
    const onDropZoneDragLeave = () => setDragActive(false);
    const onDropZoneDrop = (e) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file)
            handleFile(file);
    };
    // ─── Styles ─────────────────────────────────────────────────────────
    const shellStyle = {
        position: "relative",
        width: 294,
        height: 628,
        background: "#1c1c1e",
        borderRadius: 50,
        border: "1px solid #3c3c3e",
        outline: "1px solid #0a0a0b",
        outlineOffset: 1,
        boxSizing: "border-box",
        opacity: pageLoaded ? 1 : 0,
        transition: "opacity 0.4s ease-out",
    };
    const sideButton = (top, height, side) => ({
        position: "absolute",
        [side]: -4,
        top,
        width: 4,
        height,
        background: "#2c2c2e",
        borderTopLeftRadius: side === "left" ? 2 : 0,
        borderBottomLeftRadius: side === "left" ? 2 : 0,
        borderTopRightRadius: side === "right" ? 2 : 0,
        borderBottomRightRadius: side === "right" ? 2 : 0,
    });
    const screenStyle = {
        position: "absolute",
        inset: 10,
        background: "#000",
        borderRadius: 42,
        overflow: "hidden",
    };
    const dynamicIslandStyle = {
        position: "absolute",
        top: 14,
        left: "50%",
        transform: "translateX(-50%)",
        width: 108,
        height: 34,
        borderRadius: 999,
        background: "#000",
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingRight: 8,
    };
    const cameraDotStyle = {
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: "#1a1a1a",
    };
    const statusBarStyle = {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 56,
        zIndex: 20,
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        padding: "0 26px 7px 26px",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)",
        pointerEvents: "none",
        boxSizing: "border-box",
    };
    const clockStyle = {
        fontSize: 13,
        fontWeight: 600,
        color: "#fff",
        letterSpacing: 0.2,
        fontVariantNumeric: "tabular-nums",
    };
    const statusIconsStyle = {
        display: "flex",
        alignItems: "center",
        gap: 6,
        color: "#fff",
    };
    const scrollAreaStyle = {
        position: "absolute",
        inset: 0,
        overflowY: "auto",
        overflowX: "hidden",
    };
    const homeIndicatorStyle = {
        position: "absolute",
        bottom: 8,
        left: "50%",
        transform: "translateX(-50%)",
        width: 108,
        height: 4,
        borderRadius: 2,
        background: "rgba(255,255,255,0.35)",
        zIndex: 20,
    };
    const placeholderStyle = {
        width: "100%",
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#5a5a5e",
        fontSize: 13,
        padding: 32,
        textAlign: "center",
        boxSizing: "border-box",
    };
    const dropZoneStyle = {
        marginTop: 16,
        width: 294,
        padding: 16,
        border: `1px dashed ${dragActive ? "#838383" : "#3c3c3e"}`,
        borderRadius: 12,
        color: "#838383",
        fontSize: 12,
        textAlign: "center",
        cursor: "pointer",
        background: dragActive ? "rgba(255,255,255,0.04)" : "transparent",
        transition: "border-color 0.15s, background 0.15s",
        boxSizing: "border-box",
    };
    const scrollHintStyle = {
        position: "absolute",
        bottom: 32,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 25,
        padding: "6px 12px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.6)",
        color: "#fff",
        fontSize: 11,
        letterSpacing: 0.2,
        pointerEvents: "none",
        opacity: showScrollHint ? 1 : 0,
        transition: "opacity 0.4s",
    };
    const wrapperStyle = {
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
    };
    return (_jsxs("div", { className: className, style: wrapperStyle, children: [_jsx("style", { children: `.phone-mockup-scroll::-webkit-scrollbar{display:none}.phone-mockup-scroll{scrollbar-width:none}` }), _jsxs("div", { style: shellStyle, "aria-label": "Phone mockup", children: [_jsx("div", { style: sideButton(116, 28, "left") }), _jsx("div", { style: sideButton(158, 52, "left") }), _jsx("div", { style: sideButton(220, 52, "left") }), _jsx("div", { style: sideButton(172, 74, "right") }), _jsxs("div", { style: screenStyle, children: [_jsx("div", { style: dynamicIslandStyle, children: _jsx("div", { style: cameraDotStyle }) }), _jsxs("div", { style: statusBarStyle, children: [_jsx("span", { style: clockStyle, children: clock }), _jsxs("span", { style: statusIconsStyle, children: [_jsx(Wifi, { size: 14, strokeWidth: 2.25 }), _jsx(BatteryFull, { size: 18, strokeWidth: 2 })] })] }), _jsx("div", { ref: scrollAreaRef, className: "phone-mockup-scroll", style: scrollAreaStyle, children: displaySrc ? (_jsx("img", { src: displaySrc, alt: alt, style: fill
                                        ? { display: "block", width: "100%", height: "100%", objectFit: "cover" }
                                        : { display: "block", width: "100%", height: "auto" } })) : (_jsx("div", { style: placeholderStyle, children: allowUpload ? "Drop or pick an image to preview" : "No image" })) }), _jsx("div", { style: scrollHintStyle, children: "scroll to explore \u2191\u2193" }), _jsx("div", { style: homeIndicatorStyle })] })] }), allowUpload && (_jsxs(_Fragment, { children: [_jsx("div", { style: dropZoneStyle, onClick: () => fileInputRef.current?.click(), onDragOver: onDropZoneDragOver, onDragLeave: onDropZoneDragLeave, onDrop: onDropZoneDrop, children: uploadedMeta ? (_jsxs("span", { style: { color: "#838383" }, children: [uploadedMeta.width, "\u00D7", uploadedMeta.height, " \u00B7 ", formatBytes(uploadedMeta.size), _jsx("span", { style: { marginLeft: 8, opacity: 0.6 }, children: "(click or drop to replace)" })] })) : (_jsx("span", { children: "Click or drop an image" })) }), _jsx("input", { ref: fileInputRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: onFileInputChange })] }))] }));
}
//# sourceMappingURL=PhoneMockup.js.map