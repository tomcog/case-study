import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Reorder } from "motion/react";
import { Plus, Trash2, ChevronUp, ChevronDown, Play, LayoutGrid, Image as ImageIcon, Copy, } from "lucide-react";
import { Button, ButtonRound } from "@tomcoggia/ui";
import { RED, DEFAULT_ACCENT } from "./theme.js";
import { ACCENT, THEMES, DEFAULT_OVERVIEW_ITEMS, DEFAULT_GALLERY, DEFAULT_ANNOTATIONS, DEFAULT_STAT, screenTheme, themeColors, bleedBg, backdropFor, Stage, ScreenView, } from "./core.js";
import { MetricsEditor, ImageField, OverviewEditor, GalleryEditor, StatEditor, Field, ColorInput, PreviewCardSettings, inputStyle, } from "./editors.js";
import { Player } from "./Player.js";
// ─── The builder (edit mode) ───────────────────────────────────────
const LAYOUTS = [
    { value: "cover", label: "Title Card" },
    { value: "overview", label: "Intro" },
    { value: "basic1", label: "Basic - 1 Column" },
    { value: "basic2", label: "Basic - 2 Column" },
    { value: "quote", label: "Quote" },
    { value: "metrics", label: "Metrics" },
    { value: "gallery", label: "Gallery" },
    { value: "showcase", label: "Annotated" },
    { value: "bento", label: "Bento" },
    { value: "video", label: "Video" },
];
// Patch applied when switching layouts — seeds a layout's list content on first
// use so the canvas shows a fully-composed example instead of an empty shell.
function layoutPatch(layout, screen) {
    const patch = { layout };
    if (layout === "overview" && !screen.items)
        patch.items = DEFAULT_OVERVIEW_ITEMS;
    if (layout === "showcase" && !screen.items)
        patch.items = DEFAULT_ANNOTATIONS;
    if (layout === "gallery" && !screen.images)
        patch.images = DEFAULT_GALLERY;
    if (layout === "bento" && !screen.metrics?.length)
        patch.metrics = [DEFAULT_STAT];
    return patch;
}
function newScreen() {
    return {
        id: `s-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        layout: "basic1",
        basicTheme: "light",
        theme: "light",
        bg: THEMES.light.bg,
        fg: THEMES.light.fg,
        accent: DEFAULT_ACCENT,
        eyebrow: "Section",
        title: "New screen",
        body: "Describe this step of the story.",
    };
}
export function Builder({ content, setContent, projectName, isCaseStudy, onToggleCaseStudy, onClose }) {
    const [selected, setSelected] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [showThumb, setShowThumb] = useState(false);
    const screens = content.screens;
    const screen = screens[Math.min(selected, screens.length - 1)];
    const update = (patch) => {
        setContent((prev) => ({
            ...prev,
            screens: prev.screens.map((s, i) => (i === selected ? { ...s, ...patch } : s)),
        }));
    };
    const addScreen = () => {
        setContent((prev) => {
            const next = [...prev.screens];
            next.splice(selected + 1, 0, newScreen());
            return { ...prev, screens: next };
        });
        setSelected((i) => i + 1);
    };
    const duplicateScreen = () => {
        setContent((prev) => {
            const next = [...prev.screens];
            const copy = { ...prev.screens[selected], id: `s-${Date.now()}-${Math.floor(Math.random() * 1000)}` };
            next.splice(selected + 1, 0, copy);
            return { ...prev, screens: next };
        });
        setSelected((i) => i + 1);
    };
    const deleteScreen = () => {
        if (screens.length <= 1)
            return;
        setContent((prev) => ({ ...prev, screens: prev.screens.filter((_, i) => i !== selected) }));
        setSelected((i) => Math.max(0, i - 1));
    };
    const move = (delta) => {
        const to = selected + delta;
        if (to < 0 || to >= screens.length)
            return;
        setContent((prev) => {
            const next = [...prev.screens];
            const [s] = next.splice(selected, 1);
            next.splice(to, 0, s);
            return { ...prev, screens: next };
        });
        setSelected(to);
    };
    if (playing) {
        return _jsx(Player, { screens: screens, startIndex: selected, onExit: () => setPlaying(false), logoSrc: content.preview?.logo });
    }
    return (_jsxs("div", { style: { position: "fixed", inset: 0, zIndex: 55, background: "#e9e7e3", color: "#1a1a1a", display: "flex", flexDirection: "column" }, children: [_jsxs("div", { style: { height: 60, flexShrink: 0, background: "#fff", borderBottom: "1px solid #e3e0db", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 15 }, children: [_jsx(LayoutGrid, { size: 18, style: { color: ACCENT } }), " Project Builder", projectName && (_jsxs(_Fragment, { children: [_jsx("span", { style: { color: "#cfcbc4", fontWeight: 400 }, children: "/" }), _jsx("span", { style: { color: "#5a554e", fontWeight: 600 }, children: projectName })] }))] }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, position: "relative" }, children: [_jsx(Button, { variant: "tertiary", icon: _jsx(ImageIcon, { size: 16 }), onClick: () => setShowThumb((v) => !v), title: "Projects page preview card & visibility", children: "Project settings" }), _jsx(Button, { variant: "primary", icon: _jsx(Play, { size: 16 }), onClick: () => setPlaying(true), children: "Preview" }), onClose && _jsx(Button, { variant: "secondary", onClick: onClose, children: "Done" }), showThumb && (_jsx(PreviewCardSettings, { preview: content.preview ?? {}, onChange: (patch) => setContent((prev) => ({ ...prev, preview: { ...prev.preview, ...patch } })), onClose: () => setShowThumb(false), isCaseStudy: isCaseStudy, onToggleCaseStudy: onToggleCaseStudy }))] })] }), _jsxs("div", { style: { flex: 1, display: "flex", minHeight: 0 }, children: [_jsxs("div", { style: { width: 184, flexShrink: 0, background: "#f3f1ed", borderRight: "1px solid #e3e0db", overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }, children: [_jsx(Reorder.Group, { axis: "y", values: screens, onReorder: (next) => {
                                    const selId = screens[selected]?.id;
                                    setContent((prev) => ({ ...prev, screens: next }));
                                    const ni = next.findIndex((s) => s.id === selId);
                                    if (ni >= 0)
                                        setSelected(ni);
                                }, style: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }, children: screens.map((s, i) => (_jsxs(Reorder.Item, { value: s, onClick: () => setSelected(i), whileDrag: { scale: 1.04, boxShadow: "0 10px 24px rgba(0,0,0,0.22)", cursor: "grabbing" }, style: {
                                        position: "relative", textAlign: "left", border: i === selected ? `2px solid ${ACCENT}` : "1px solid #dcd8d2",
                                        borderRadius: 8, padding: 10, cursor: "grab", background: themeColors(s).bg, color: themeColors(s).fg, minHeight: 64, overflow: "hidden",
                                    }, children: [_jsx("div", { style: { fontSize: 10, opacity: 0.6, position: "absolute", top: 6, right: 8 }, children: i + 1 }), _jsx("div", { style: { fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: s.accent, marginBottom: 4 }, children: s.eyebrow }), _jsx("div", { style: { fontSize: 12, fontWeight: 600, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }, children: s.title || s.layout })] }, s.id))) }), _jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(Plus, { size: 16 }), onClick: addScreen, style: { width: "100%", justifyContent: "center", marginTop: 4 }, children: "Add screen" })] }), _jsx("div", { style: { flex: 1, minWidth: 0, position: "relative", overflow: "hidden" }, children: _jsx(Stage, { background: bleedBg(screen), backdrop: backdropFor(screen), children: _jsx(ScreenView, { screen: screen, play: false, reduced: true, logoSrc: content.preview?.logo, onAnnotationMove: screen.layout === "showcase"
                                    ? (id, x, y) => update({ items: (screen.items ?? []).map((it) => (it.id === id ? { ...it, x, y } : it)) })
                                    : undefined }) }, screen.id) }), _jsxs("div", { style: { width: 320, flexShrink: 0, background: "#fff", borderLeft: "1px solid #e3e0db", overflowY: "auto", padding: 18, paddingBottom: 104 }, children: [_jsxs("div", { style: { display: "flex", gap: 6, marginBottom: 18 }, children: [_jsx(ButtonRound, { variant: "tertiary", icon: _jsx(ChevronUp, { size: 16 }), onClick: () => move(-1), disabled: selected === 0, title: "Move up", "aria-label": "Move up" }), _jsx(ButtonRound, { variant: "tertiary", icon: _jsx(ChevronDown, { size: 16 }), onClick: () => move(1), disabled: selected === screens.length - 1, title: "Move down", "aria-label": "Move down" }), _jsx(ButtonRound, { variant: "tertiary", icon: _jsx(Copy, { size: 16 }), onClick: duplicateScreen, title: "Duplicate", "aria-label": "Duplicate" }), _jsx(ButtonRound, { variant: "tertiary", tone: "danger", icon: _jsx(Trash2, { size: 16 }), onClick: deleteScreen, disabled: screens.length <= 1, title: "Delete", "aria-label": "Delete" })] }), _jsx(Field, { label: "Layout", collapsible: true, children: _jsx("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }, children: LAYOUTS.map((l) => (_jsx("button", { onClick: () => update(layoutPatch(l.value, screen)), style: {
                                            fontSize: 12, padding: "8px 6px", borderRadius: 6, cursor: "pointer",
                                            border: screen.layout === l.value ? `1.5px solid ${ACCENT}` : "1px solid #dcd8d2",
                                            background: screen.layout === l.value ? "#fff5f6" : "#fff", color: "#1a1a1a",
                                        }, children: l.label }, l.value))) }) }), _jsx(Field, { label: "Eyebrow", children: _jsx("textarea", { value: screen.eyebrow ?? "", onChange: (e) => update({ eyebrow: e.target.value }), rows: 1, style: { ...inputStyle, resize: "vertical" } }) }), _jsx(Field, { label: "Title", children: _jsx("textarea", { value: screen.title ?? "", onChange: (e) => update({ title: e.target.value }), rows: 2, style: { ...inputStyle, resize: "vertical" } }) }), !["metrics", "gallery", "showcase"].includes(screen.layout) && (_jsx(Field, { label: screen.layout === "bento" ? "Body (text cell)" : "Body", children: _jsx("textarea", { value: screen.body ?? "", onChange: (e) => update({ body: e.target.value }), rows: 4, style: { ...inputStyle, resize: "vertical" } }) })), screen.layout === "video" && (_jsx(Field, { label: "Video URL", children: _jsx("input", { value: screen.videoUrl ?? "", onChange: (e) => update({ videoUrl: e.target.value }), placeholder: "YouTube / Vimeo / .mp4 URL", style: inputStyle }) })), screen.layout === "metrics" && (_jsx(MetricsEditor, { metrics: screen.metrics ?? [], onChange: (metrics) => update({ metrics }) })), screen.layout === "overview" && (_jsx(OverviewEditor, { label: "Data points", items: screen.items ?? [], onChange: (items) => update({ items }) })), screen.layout === "gallery" && (_jsx(GalleryEditor, { images: screen.images ?? [], onChange: (images) => update({ images }) })), screen.layout === "showcase" && (_jsxs(_Fragment, { children: [_jsx(ImageField, { value: screen.imageUrl ?? "", onChange: (v) => update({ imageUrl: v }) }), _jsx(OverviewEditor, { label: "Annotations", items: screen.items ?? [], onChange: (items) => update({ items }) })] })), screen.layout === "bento" && (_jsxs(_Fragment, { children: [_jsx(ImageField, { label: "Large image", value: screen.imageUrl ?? "", onChange: (v) => update({ imageUrl: v }) }), _jsx(ImageField, { label: "Small image", value: screen.imageUrl2 ?? "", onChange: (v) => update({ imageUrl2: v }) }), _jsx(StatEditor, { stat: screen.metrics?.[0], onChange: (stat) => update({ metrics: [stat] }) })] })), (screen.layout === "basic1" || screen.layout === "basic2" || screen.layout === "cover" || screen.layout === "overview" || screen.layout === "quote") && (_jsxs(_Fragment, { children: [_jsx(Field, { label: "Theme", children: _jsx("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }, children: (screen.layout === "basic2"
                                                ? [["light", "Light", "#ffffff"], ["dark", "Dark", "#000000"], ["red", "Red", RED]]
                                                : [["light", "Light", "#ffffff"], ["dark", "Dark", "#000000"], ["red", "Red", RED], ["image", "Image", "linear-gradient(135deg,#9a9a9a,#d8d8d8)"]]).map(([val, label, swatch]) => {
                                                const active = (screen.basicTheme ?? "light") === val;
                                                return (_jsxs("button", { onClick: () => update({ basicTheme: val }), style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, padding: "9px 6px", borderRadius: 6, cursor: "pointer",
                                                        border: active ? `1.5px solid ${ACCENT}` : "1px solid #dcd8d2", background: active ? "#fff5f6" : "#fff", color: "#1a1a1a" }, children: [_jsx("span", { style: { width: 14, height: 14, borderRadius: 4, background: swatch, border: "1px solid #cfcbc4" } }), label] }, val));
                                            }) }) }), (screen.layout === "basic1" || screen.layout === "cover" || screen.layout === "overview" || screen.layout === "quote") && (screen.basicTheme ?? "light") === "image" && (_jsxs(_Fragment, { children: [_jsx(ImageField, { label: "Left image", value: screen.imageUrl ?? "", onChange: (v) => update({ imageUrl: v }), overlay: screen.overlay !== false, onOverlayChange: (v) => update({ overlay: v }) }), _jsx(Field, { label: "Text color", children: _jsx("div", { style: { display: "flex", gap: 6 }, children: [["White", false], ["Black", true]].map(([label, dark]) => {
                                                        const active = !!screen.imageTextDark === dark;
                                                        return _jsx("button", { onClick: () => update({ imageTextDark: dark }), style: { flex: 1, padding: "8px 0", fontSize: 12, fontWeight: 600, cursor: "pointer", borderRadius: 6, border: `1px solid ${active ? ACCENT : "#dcd8d2"}`, background: active ? ACCENT : "#fff", color: active ? "#fff" : "#5a554e" }, children: label }, label);
                                                    }) }) })] })), screen.layout === "basic2" && (_jsxs(_Fragment, { children: [_jsx(Field, { label: "Text side", children: _jsx("div", { style: { display: "flex", gap: 6 }, children: [["left", "Left"], ["right", "Right"]].map(([val, label]) => {
                                                        const active = (screen.basicTextSide ?? "left") === val;
                                                        return _jsx("button", { onClick: () => update({ basicTextSide: val }), style: { flex: 1, padding: "8px 0", fontSize: 12, fontWeight: 600, cursor: "pointer", borderRadius: 6, border: `1px solid ${active ? ACCENT : "#dcd8d2"}`, background: active ? ACCENT : "#fff", color: active ? "#fff" : "#5a554e" }, children: label }, val);
                                                    }) }) }), _jsx(Field, { label: "Image", children: _jsx("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }, children: [["off", "Off"], ["fit", "Fit"], ["fill", "Fill"], ["bleed", "Bleed"], ["desktop", "Desktop"], ["mobile", "Mobile"]].map(([val, label]) => {
                                                        const active = (screen.basicImage ?? "off") === val;
                                                        return _jsx("button", { onClick: () => update({ basicImage: val }), style: { padding: "8px 0", fontSize: 12, fontWeight: 600, cursor: "pointer", borderRadius: 6, border: `1px solid ${active ? ACCENT : "#dcd8d2"}`, background: active ? ACCENT : "#fff", color: active ? "#fff" : "#5a554e" }, children: label }, val);
                                                    }) }) }), (screen.basicImage ?? "off") !== "off" && (_jsx(ImageField, { value: screen.imageUrl ?? "", onChange: (v) => update({ imageUrl: v }), ...(screen.basicImage === "fill" || screen.basicImage === "bleed"
                                                    ? { overlay: screen.overlay === true, onOverlayChange: (v) => update({ overlay: v }) }
                                                    : {}) }))] }))] })), _jsxs(Field, { label: "Link button (opens in new tab)", collapsible: true, children: [_jsx("input", { value: screen.linkUrl ?? "", onChange: (e) => update({ linkUrl: e.target.value }), placeholder: "https://\u2026 (e.g. Figma prototype)", style: inputStyle }), _jsx("input", { value: screen.linkLabel ?? "", onChange: (e) => update({ linkLabel: e.target.value }), placeholder: "Button label (default: View prototype)", style: { ...inputStyle, marginTop: 6 } })] }), _jsxs(Field, { label: "Logo", children: [_jsxs("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1a1a1a", cursor: "pointer" }, children: [_jsx("input", { type: "checkbox", checked: !!screen.showLogo, onChange: (e) => update({ showLogo: e.target.checked }), style: { accentColor: ACCENT } }), "Display logo"] }), screen.showLogo && !content.preview?.logo && (_jsxs("div", { style: { fontSize: 11, color: "#b42318", marginTop: 8 }, children: ["No slide logo set yet \u2014 add one in ", _jsx("strong", { children: "Project settings" }), "."] }))] }), !(screen.layout === "basic1" || screen.layout === "basic2" || screen.layout === "cover" || screen.layout === "overview" || screen.layout === "quote") && (_jsxs(_Fragment, { children: [_jsx(Field, { label: "Theme", children: _jsx("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }, children: ["light", "dark"].map((t) => {
                                                const active = screenTheme(screen) === t;
                                                return (_jsxs("button", { onClick: () => update({ theme: t, ...THEMES[t] }), style: {
                                                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                                        fontSize: 12, padding: "9px 6px", borderRadius: 6, cursor: "pointer",
                                                        border: active ? `1.5px solid ${ACCENT}` : "1px solid #dcd8d2",
                                                        background: active ? "#fff5f6" : "#fff", color: "#1a1a1a", textTransform: "capitalize",
                                                    }, children: [_jsx("span", { style: { width: 14, height: 14, borderRadius: 4, background: THEMES[t].bg, border: "1px solid #cfcbc4" } }), t] }, t));
                                            }) }) }), _jsx(Field, { label: "Accent", children: _jsx(ColorInput, { label: "Accent", value: screen.accent, onChange: (v) => update({ accent: v }) }) })] }))] })] })] }));
}
//# sourceMappingURL=Builder.js.map