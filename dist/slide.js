import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// ─── Slides ────────────────────────────────────────────────────────
// A slide is a screen composed on the fixed 1280×720 canvas: the ten layouts
// and the fields each of them uses. This file is only the slide itself — what
// a new one starts as, the one way of putting it on screen, and the one set
// of controls it is edited with, so no two of them can drift apart.
import { RED, DEFAULT_ACCENT } from "./theme.js";
import { ACCENT, THEMES, DEFAULT_OVERVIEW_ITEMS, DEFAULT_GALLERY, DEFAULT_ANNOTATIONS, DEFAULT_STAT, screenTheme, bleedBg, backdropFor, Stage, ScreenView, } from "./core.js";
import { MetricsEditor, ImageField, OverviewEditor, GalleryEditor, StatEditor, Field, ColorInput, inputStyle, } from "./editors.js";
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
export function newScreen() {
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
/** A slide on screen: the stage scaled to its parent, the bleed and backdrop
 * that fill the letterbox margins, and the screen drawn on the canvas. Every
 * place a slide appears goes through here — the player, the builder's canvas
 * and the project list's thumbnail — so a slide can't look like three
 * slightly different things depending on who drew it.
 *
 * `play` runs the entrance; a builder leaves it off, because the slide is
 * being edited rather than arrived at. `reduced` picks the reduced-motion
 * variants. */
export function SlideView({ screen, play = false, reduced = false, logoSrc, onAnnotationMove }) {
    return (_jsx(Stage, { background: bleedBg(screen), backdrop: backdropFor(screen), children: _jsx(ScreenView, { screen: screen, play: play, reduced: reduced, logoSrc: logoSrc, onAnnotationMove: onAnnotationMove }) }, screen.id));
}
/** Everything about one slide: its layout and the fields that layout uses.
 * Lifted out of the builder so a step displaying a slide edits it with exactly
 * the same controls, rather than a second set that drifts. */
export function SlideFields({ screen, update, logoSrc }) {
    return (_jsxs(_Fragment, { children: [_jsx(Field, { label: "Layout", collapsible: true, children: _jsx("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }, children: LAYOUTS.map((l) => (_jsx("button", { onClick: () => update(layoutPatch(l.value, screen)), style: {
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
                                    : {}) }))] }))] })), _jsxs(Field, { label: "Link button (opens in new tab)", collapsible: true, children: [_jsx("input", { value: screen.linkUrl ?? "", onChange: (e) => update({ linkUrl: e.target.value }), placeholder: "https://\u2026 (e.g. Figma prototype)", style: inputStyle }), _jsx("input", { value: screen.linkLabel ?? "", onChange: (e) => update({ linkLabel: e.target.value }), placeholder: "Button label (default: View prototype)", style: { ...inputStyle, marginTop: 6 } })] }), _jsxs(Field, { label: "Logo", children: [_jsxs("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1a1a1a", cursor: "pointer" }, children: [_jsx("input", { type: "checkbox", checked: !!screen.showLogo, onChange: (e) => update({ showLogo: e.target.checked }), style: { accentColor: ACCENT } }), "Display logo"] }), screen.showLogo && !logoSrc && (_jsxs("div", { style: { fontSize: 11, color: "#b42318", marginTop: 8 }, children: ["No slide logo set yet \u2014 add one in ", _jsx("strong", { children: "Project settings" }), "."] }))] }), !(screen.layout === "basic1" || screen.layout === "basic2" || screen.layout === "cover" || screen.layout === "overview" || screen.layout === "quote") && (_jsxs(_Fragment, { children: [_jsx(Field, { label: "Theme", children: _jsx("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }, children: ["light", "dark"].map((t) => {
                                const active = screenTheme(screen) === t;
                                return (_jsxs("button", { onClick: () => update({ theme: t, ...THEMES[t] }), style: {
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                        fontSize: 12, padding: "9px 6px", borderRadius: 6, cursor: "pointer",
                                        border: active ? `1.5px solid ${ACCENT}` : "1px solid #dcd8d2",
                                        background: active ? "#fff5f6" : "#fff", color: "#1a1a1a", textTransform: "capitalize",
                                    }, children: [_jsx("span", { style: { width: 14, height: 14, borderRadius: 4, background: THEMES[t].bg, border: "1px solid #cfcbc4" } }), t] }, t));
                            }) }) }), _jsx(Field, { label: "Accent", children: _jsx(ColorInput, { label: "Accent", value: screen.accent, onChange: (v) => update({ accent: v }) }) })] }))] }));
}
//# sourceMappingURL=slide.js.map