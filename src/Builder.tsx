import { useState } from "react";
import { Reorder } from "motion/react";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Play, LayoutGrid, Image as ImageIcon, Copy,
} from "lucide-react";
import { Button, ButtonRound } from "@tomcoggia/ui";
import { RED, DEFAULT_ACCENT } from "./theme.js";
import {
  ACCENT, THEMES, DEFAULT_OVERVIEW_ITEMS, DEFAULT_GALLERY, DEFAULT_ANNOTATIONS, DEFAULT_STAT,
  screenTheme, themeColors, bleedBg, backdropFor, Stage, ScreenView,
} from "./core.js";
import type {
  ScreenLayout, Theme, Screen, CaseStudyContent,
} from "./core.js";
import {
  MetricsEditor, ImageField, OverviewEditor, GalleryEditor, StatEditor, Field, ColorInput,
  PreviewCardSettings, inputStyle,
} from "./editors.js";
import { Player } from "./Player.js";

// ─── The builder (edit mode) ───────────────────────────────────────

const LAYOUTS: { value: ScreenLayout; label: string }[] = [
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
function layoutPatch(layout: ScreenLayout, screen: Screen): Partial<Screen> {
  const patch: Partial<Screen> = { layout };
  if (layout === "overview" && !screen.items) patch.items = DEFAULT_OVERVIEW_ITEMS;
  if (layout === "showcase" && !screen.items) patch.items = DEFAULT_ANNOTATIONS;
  if (layout === "gallery" && !screen.images) patch.images = DEFAULT_GALLERY;
  if (layout === "bento" && !screen.metrics?.length) patch.metrics = [DEFAULT_STAT];
  return patch;
}

function newScreen(): Screen {
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

export function Builder({ content, setContent, projectName, isCaseStudy, onToggleCaseStudy, onClose }: {
  content: CaseStudyContent;
  setContent: (u: (prev: CaseStudyContent) => CaseStudyContent) => void;
  projectName?: string;
  /** Case-study flag shown in Project settings; the toggle is hidden when `onToggleCaseStudy` is omitted. */
  isCaseStudy?: boolean;
  onToggleCaseStudy?: () => void;
  /** Adds a "Done" button to the toolbar (e.g. back to a project list). */
  onClose?: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showThumb, setShowThumb] = useState(false);
  const screens = content.screens;
  const screen = screens[Math.min(selected, screens.length - 1)];

  const update = (patch: Partial<Screen>) => {
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
    if (screens.length <= 1) return;
    setContent((prev) => ({ ...prev, screens: prev.screens.filter((_, i) => i !== selected) }));
    setSelected((i) => Math.max(0, i - 1));
  };

  const move = (delta: number) => {
    const to = selected + delta;
    if (to < 0 || to >= screens.length) return;
    setContent((prev) => {
      const next = [...prev.screens];
      const [s] = next.splice(selected, 1);
      next.splice(to, 0, s);
      return { ...prev, screens: next };
    });
    setSelected(to);
  };

  if (playing) {
    return <Player screens={screens} startIndex={selected} onExit={() => setPlaying(false)} logoSrc={content.preview?.logo} />;
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, background: "#e9e7e3", color: "#1a1a1a", display: "flex", flexDirection: "column" }}>
      {/* Toolbar */}
      <div style={{ height: 60, flexShrink: 0, background: "#fff", borderBottom: "1px solid #e3e0db", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 15 }}>
          <LayoutGrid size={18} style={{ color: ACCENT }} /> Project Builder
          {projectName && (
            <>
              <span style={{ color: "#cfcbc4", fontWeight: 400 }}>/</span>
              <span style={{ color: "#5a554e", fontWeight: 600 }}>{projectName}</span>
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
          <Button variant="tertiary" icon={<ImageIcon size={16} />} onClick={() => setShowThumb((v) => !v)} title="Projects page preview card & visibility">
            Project settings
          </Button>
          <Button variant="primary" icon={<Play size={16} />} onClick={() => setPlaying(true)}>
            Preview
          </Button>
          {onClose && <Button variant="secondary" onClick={onClose}>Done</Button>}
          {showThumb && (
            <PreviewCardSettings
              preview={content.preview ?? {}}
              onChange={(patch) => setContent((prev) => ({ ...prev, preview: { ...prev.preview, ...patch } }))}
              onClose={() => setShowThumb(false)}
              isCaseStudy={isCaseStudy}
              onToggleCaseStudy={onToggleCaseStudy}
            />
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Screen rail */}
        <div style={{ width: 184, flexShrink: 0, background: "#f3f1ed", borderRight: "1px solid #e3e0db", overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <Reorder.Group
            axis="y"
            values={screens}
            onReorder={(next) => {
              const selId = screens[selected]?.id;
              setContent((prev) => ({ ...prev, screens: next }));
              const ni = next.findIndex((s) => s.id === selId);
              if (ni >= 0) setSelected(ni);
            }}
            style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}
          >
            {screens.map((s, i) => (
              <Reorder.Item
                key={s.id}
                value={s}
                onClick={() => setSelected(i)}
                whileDrag={{ scale: 1.04, boxShadow: "0 10px 24px rgba(0,0,0,0.22)", cursor: "grabbing" }}
                style={{
                  position: "relative", textAlign: "left", border: i === selected ? `2px solid ${ACCENT}` : "1px solid #dcd8d2",
                  borderRadius: 8, padding: 10, cursor: "grab", background: themeColors(s).bg, color: themeColors(s).fg, minHeight: 64, overflow: "hidden",
                }}
              >
                <div style={{ fontSize: 10, opacity: 0.6, position: "absolute", top: 6, right: 8 }}>{i + 1}</div>
                <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: s.accent, marginBottom: 4 }}>{s.eyebrow}</div>
                <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.title || s.layout}</div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
          <Button variant="ghost" size="sm" icon={<Plus size={16} />} onClick={addScreen} style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
            Add screen
          </Button>
        </div>

        {/* Live canvas — the whole work area is the viewport (as in view mode),
            not a small card; the Stage scales the screen to fill it (letterboxed). */}
        <div style={{ flex: 1, minWidth: 0, position: "relative", overflow: "hidden" }}>
          <Stage key={screen.id} background={bleedBg(screen)} backdrop={backdropFor(screen)}>
            <ScreenView
              screen={screen}
              play={false}
              reduced
              logoSrc={content.preview?.logo}
              onAnnotationMove={screen.layout === "showcase"
                ? (id, x, y) => update({ items: (screen.items ?? []).map((it) => (it.id === id ? { ...it, x, y } : it)) })
                : undefined}
            />
          </Stage>
        </div>

        {/* Inspector */}
        <div style={{ width: 320, flexShrink: 0, background: "#fff", borderLeft: "1px solid #e3e0db", overflowY: "auto", padding: 18, paddingBottom: 104 }}>
          {/* Screen actions */}
          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            <ButtonRound variant="tertiary" icon={<ChevronUp size={16} />} onClick={() => move(-1)} disabled={selected === 0} title="Move up" aria-label="Move up" />
            <ButtonRound variant="tertiary" icon={<ChevronDown size={16} />} onClick={() => move(1)} disabled={selected === screens.length - 1} title="Move down" aria-label="Move down" />
            <ButtonRound variant="tertiary" icon={<Copy size={16} />} onClick={duplicateScreen} title="Duplicate" aria-label="Duplicate" />
            <ButtonRound variant="tertiary" tone="danger" icon={<Trash2 size={16} />} onClick={deleteScreen} disabled={screens.length <= 1} title="Delete" aria-label="Delete" />
          </div>

          <Field label="Layout" collapsible>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {LAYOUTS.map((l) => (
                <button key={l.value} onClick={() => update(layoutPatch(l.value, screen))}
                  style={{
                    fontSize: 12, padding: "8px 6px", borderRadius: 6, cursor: "pointer",
                    border: screen.layout === l.value ? `1.5px solid ${ACCENT}` : "1px solid #dcd8d2",
                    background: screen.layout === l.value ? "#fff5f6" : "#fff", color: "#1a1a1a",
                  }}>{l.label}</button>
              ))}
            </div>
          </Field>

          <Field label="Eyebrow">
            <textarea value={screen.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value })} rows={1} style={{ ...inputStyle, resize: "vertical" }} />
          </Field>

          <Field label="Title">
            <textarea value={screen.title ?? ""} onChange={(e) => update({ title: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </Field>

          {!["metrics", "gallery", "showcase"].includes(screen.layout) && (
            <Field label={screen.layout === "bento" ? "Body (text cell)" : "Body"}>
              <textarea value={screen.body ?? ""} onChange={(e) => update({ body: e.target.value })} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
            </Field>
          )}

          {screen.layout === "video" && (
            <Field label="Video URL">
              <input value={screen.videoUrl ?? ""} onChange={(e) => update({ videoUrl: e.target.value })} placeholder="YouTube / Vimeo / .mp4 URL" style={inputStyle} />
            </Field>
          )}

          {screen.layout === "metrics" && (
            <MetricsEditor metrics={screen.metrics ?? []} onChange={(metrics) => update({ metrics })} />
          )}

          {screen.layout === "overview" && (
            <OverviewEditor label="Data points" items={screen.items ?? []} onChange={(items) => update({ items })} />
          )}

          {screen.layout === "gallery" && (
            <GalleryEditor images={screen.images ?? []} onChange={(images) => update({ images })} />
          )}

          {screen.layout === "showcase" && (
            <>
              <ImageField value={screen.imageUrl ?? ""} onChange={(v) => update({ imageUrl: v })} />
              <OverviewEditor label="Annotations" items={screen.items ?? []} onChange={(items) => update({ items })} />
            </>
          )}

          {screen.layout === "bento" && (
            <>
              <ImageField label="Large image" value={screen.imageUrl ?? ""} onChange={(v) => update({ imageUrl: v })} />
              <ImageField label="Small image" value={screen.imageUrl2 ?? ""} onChange={(v) => update({ imageUrl2: v })} />
              <StatEditor stat={screen.metrics?.[0]} onChange={(stat) => update({ metrics: [stat] })} />
            </>
          )}

          {(screen.layout === "basic1" || screen.layout === "basic2" || screen.layout === "cover" || screen.layout === "overview" || screen.layout === "quote") && (
            <>
              <Field label="Theme">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {(screen.layout === "basic2"
                    ? ([["light", "Light", "#ffffff"], ["dark", "Dark", "#000000"], ["red", "Red", RED]] as const)
                    : ([["light", "Light", "#ffffff"], ["dark", "Dark", "#000000"], ["red", "Red", RED], ["image", "Image", "linear-gradient(135deg,#9a9a9a,#d8d8d8)"]] as const)
                  ).map(([val, label, swatch]) => {
                    const active = (screen.basicTheme ?? "light") === val;
                    return (
                      <button key={val} onClick={() => update({ basicTheme: val })}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, padding: "9px 6px", borderRadius: 6, cursor: "pointer",
                          border: active ? `1.5px solid ${ACCENT}` : "1px solid #dcd8d2", background: active ? "#fff5f6" : "#fff", color: "#1a1a1a" }}>
                        <span style={{ width: 14, height: 14, borderRadius: 4, background: swatch, border: "1px solid #cfcbc4" }} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              {(screen.layout === "basic1" || screen.layout === "cover" || screen.layout === "overview" || screen.layout === "quote") && (screen.basicTheme ?? "light") === "image" && (
                <>
                  <ImageField label="Left image" value={screen.imageUrl ?? ""} onChange={(v) => update({ imageUrl: v })} overlay={screen.overlay !== false} onOverlayChange={(v) => update({ overlay: v })} />
                  <Field label="Text color">
                    <div style={{ display: "flex", gap: 6 }}>
                      {([["White", false], ["Black", true]] as const).map(([label, dark]) => {
                        const active = !!screen.imageTextDark === dark;
                        return <button key={label} onClick={() => update({ imageTextDark: dark })} style={{ flex: 1, padding: "8px 0", fontSize: 12, fontWeight: 600, cursor: "pointer", borderRadius: 6, border: `1px solid ${active ? ACCENT : "#dcd8d2"}`, background: active ? ACCENT : "#fff", color: active ? "#fff" : "#5a554e" }}>{label}</button>;
                      })}
                    </div>
                  </Field>
                </>
              )}

              {screen.layout === "basic2" && (
                <>
                  <Field label="Text side">
                    <div style={{ display: "flex", gap: 6 }}>
                      {([["left", "Left"], ["right", "Right"]] as const).map(([val, label]) => {
                        const active = (screen.basicTextSide ?? "left") === val;
                        return <button key={val} onClick={() => update({ basicTextSide: val })} style={{ flex: 1, padding: "8px 0", fontSize: 12, fontWeight: 600, cursor: "pointer", borderRadius: 6, border: `1px solid ${active ? ACCENT : "#dcd8d2"}`, background: active ? ACCENT : "#fff", color: active ? "#fff" : "#5a554e" }}>{label}</button>;
                      })}
                    </div>
                  </Field>
                  <Field label="Image">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                      {([["off", "Off"], ["fit", "Fit"], ["fill", "Fill"], ["bleed", "Bleed"], ["desktop", "Desktop"], ["mobile", "Mobile"]] as const).map(([val, label]) => {
                        const active = (screen.basicImage ?? "off") === val;
                        return <button key={val} onClick={() => update({ basicImage: val })} style={{ padding: "8px 0", fontSize: 12, fontWeight: 600, cursor: "pointer", borderRadius: 6, border: `1px solid ${active ? ACCENT : "#dcd8d2"}`, background: active ? ACCENT : "#fff", color: active ? "#fff" : "#5a554e" }}>{label}</button>;
                      })}
                    </div>
                  </Field>
                  {(screen.basicImage ?? "off") !== "off" && (
                    <ImageField value={screen.imageUrl ?? ""} onChange={(v) => update({ imageUrl: v })}
                      {...(screen.basicImage === "fill" || screen.basicImage === "bleed"
                        ? { overlay: screen.overlay === true, onOverlayChange: (v: boolean) => update({ overlay: v }) }
                        : {})} />
                  )}
                </>
              )}
            </>
          )}

          <Field label="Link button (opens in new tab)" collapsible>
            <input value={screen.linkUrl ?? ""} onChange={(e) => update({ linkUrl: e.target.value })} placeholder="https://… (e.g. Figma prototype)" style={inputStyle} />
            <input value={screen.linkLabel ?? ""} onChange={(e) => update({ linkLabel: e.target.value })} placeholder="Button label (default: View prototype)" style={{ ...inputStyle, marginTop: 6 }} />
          </Field>

          <Field label="Logo">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1a1a1a", cursor: "pointer" }}>
              <input type="checkbox" checked={!!screen.showLogo} onChange={(e) => update({ showLogo: e.target.checked })} style={{ accentColor: ACCENT }} />
              Display logo
            </label>
            {screen.showLogo && !content.preview?.logo && (
              <div style={{ fontSize: 11, color: "#b42318", marginTop: 8 }}>No slide logo set yet — add one in <strong>Project settings</strong>.</div>
            )}
          </Field>

          {!(screen.layout === "basic1" || screen.layout === "basic2" || screen.layout === "cover" || screen.layout === "overview" || screen.layout === "quote") && (
            <>
              <Field label="Theme">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {(["light", "dark"] as Theme[]).map((t) => {
                    const active = screenTheme(screen) === t;
                    return (
                      <button key={t} onClick={() => update({ theme: t, ...THEMES[t] })}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          fontSize: 12, padding: "9px 6px", borderRadius: 6, cursor: "pointer",
                          border: active ? `1.5px solid ${ACCENT}` : "1px solid #dcd8d2",
                          background: active ? "#fff5f6" : "#fff", color: "#1a1a1a", textTransform: "capitalize",
                        }}>
                        <span style={{ width: 14, height: 14, borderRadius: 4, background: THEMES[t].bg, border: "1px solid #cfcbc4" }} />
                        {t}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Accent">
                <ColorInput label="Accent" value={screen.accent} onChange={(v) => update({ accent: v })} />
              </Field>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
