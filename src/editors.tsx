import { useState, useRef } from "react";
import { Plus, Trash2, ChevronDown, FolderOpen, Image as ImageIcon, Layers } from "lucide-react";
import { RED as ACCENT, DEFAULT_ACCENT } from "./theme.js";
import { useCaseStudyConfig } from "./config.js";
import { ImageLibraryModal } from "./ui/ImageLibraryModal.js";
import { ProjectPreviewCard } from "./ui/ProjectPreviewCard.js";
import type { Metric, OverviewItem, GalleryImage, ProjectPreview } from "./core.js";

export function MetricsEditor({ metrics, onChange }: { metrics: Metric[]; onChange: (m: Metric[]) => void }) {
  return (
    <Field label="Metrics">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {metrics.map((m, i) => (
          <div key={m.id} style={{ display: "flex", gap: 6 }}>
            <input value={m.value} onChange={(e) => onChange(metrics.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="−63%" style={{ ...inputStyle, width: 70 }} />
            <input value={m.label} onChange={(e) => onChange(metrics.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Label" style={inputStyle} />
            <button onClick={() => onChange(metrics.filter((_, j) => j !== i))} style={iconBtn(false)}><Trash2 size={14} /></button>
          </div>
        ))}
        <button onClick={() => onChange([...metrics, { id: `m-${Date.now()}`, value: "00", label: "Metric" }])} style={{ ...ghostBtn, justifyContent: "center" }}>
          <Plus size={14} /> Add metric
        </button>
      </div>
    </Field>
  );
}

export function ImageField({ value, onChange, overlay, onOverlayChange, label = "Image" }: {
  value: string;
  onChange: (v: string) => void;
  overlay?: boolean;
  onOverlayChange?: (v: boolean) => void;
  label?: string;
}) {
  const { assets } = useCaseStudyConfig();
  const [showLibrary, setShowLibrary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/") || !assets?.upload) return;
    setUploading(true);
    const path = await assets.upload(file).catch(() => null);
    setUploading(false);
    if (path) onChange(path);
  };

  return (
    <Field label={label}>
      {showLibrary && (
        <ImageLibraryModal
          onSelect={(path) => { onChange(path); setShowLibrary(false); }}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {value && (
        <div style={{ position: "relative", marginBottom: 8, borderRadius: 6, overflow: "hidden", border: "1px solid #dcd8d2", background: "#4a4a4a" }}>
          <img src={value} alt="" style={{ display: "block", width: "100%", height: 120, objectFit: "contain" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
          {onOverlayChange && (
            <button onClick={() => onOverlayChange(!overlay)} title={overlay ? "Disable gradient overlay" : "Enable gradient overlay"}
              style={{ position: "absolute", top: 6, left: 6, width: 26, height: 26, borderRadius: 999, border: "none", background: overlay ? ACCENT : "rgba(20,18,16,0.7)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Layers size={13} />
            </button>
          )}
          <button onClick={() => onChange("")} title="Remove image"
            style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: 999, border: "none", background: "rgba(20,18,16,0.7)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Trash2 size={13} />
          </button>
        </div>
      )}

      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… or /images/…" style={inputStyle} />

      {(assets?.upload || assets?.list) && (
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          {assets.upload && (
            <button onClick={() => fileInputRef.current?.click()} style={{ ...ghostBtn, flex: 1, justifyContent: "center" }}>
              <ImageIcon size={14} /> {uploading ? "Uploading…" : "Upload"}
            </button>
          )}
          {assets.list && (
            <button onClick={() => setShowLibrary(true)} style={{ ...ghostBtn, flex: 1, justifyContent: "center" }}>
              <FolderOpen size={14} /> Browse
            </button>
          )}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </Field>
  );
}

export function OverviewEditor({ items, onChange, label = "Index items" }: { items: OverviewItem[]; onChange: (m: OverviewItem[]) => void; label?: string }) {
  return (
    <Field label={label}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it, i) => (
          <div key={it.id} style={{ display: "flex", flexDirection: "column", gap: 6, border: "1px solid #e3e0db", borderRadius: 8, padding: 8 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#8a857d", fontVariantNumeric: "tabular-nums" }}>{String(i + 1).padStart(2, "0")}</span>
              <textarea value={it.label} onChange={(e) => onChange(items.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Label" rows={1} style={{ ...inputStyle, resize: "vertical" }} />
              <button onClick={() => onChange(items.filter((_, j) => j !== i))} style={iconBtn(false)}><Trash2 size={14} /></button>
            </div>
            <textarea value={it.body} onChange={(e) => onChange(items.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} rows={2} placeholder="Description" style={{ ...inputStyle, resize: "vertical" }} />
          </div>
        ))}
        <button onClick={() => onChange([...items, { id: `o-${Date.now()}`, label: "Section", body: "Describe this section." }])} style={{ ...ghostBtn, justifyContent: "center" }}>
          <Plus size={14} /> Add item
        </button>
      </div>
    </Field>
  );
}

export function GalleryEditor({ images, onChange }: { images: GalleryImage[]; onChange: (m: GalleryImage[]) => void }) {
  const set = (i: number, patch: Partial<GalleryImage>) => onChange(images.map((x, j) => j === i ? { ...x, ...patch } : x));
  return (
    <Field label="Images">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {images.map((img, i) => (
          <div key={img.id} style={{ display: "flex", flexDirection: "column", gap: 6, border: "1px solid #e3e0db", borderRadius: 8, padding: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <input
                value={img.number ?? String(i + 1).padStart(2, "0")}
                onChange={(e) => set(i, { number: e.target.value })}
                title="Index label — clear it to hide the number for this image"
                style={{ ...inputStyle, width: 56, padding: "5px 8px", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
              />
              <button onClick={() => onChange(images.filter((_, j) => j !== i))} style={iconBtn(false)}><Trash2 size={14} /></button>
            </div>
            <ImageField value={img.url} onChange={(url) => set(i, { url })} />
            <textarea value={img.caption} onChange={(e) => set(i, { caption: e.target.value })} rows={1} placeholder="Caption" style={{ ...inputStyle, resize: "vertical" }} />
          </div>
        ))}
        <button onClick={() => onChange([...images, { id: `g-${Date.now()}`, url: "", caption: "Caption" }])} style={{ ...ghostBtn, justifyContent: "center" }}>
          <Plus size={14} /> Add image
        </button>
      </div>
    </Field>
  );
}

export function StatEditor({ stat, onChange }: { stat?: Metric; onChange: (m: Metric) => void }) {
  const s = stat ?? { id: "b-stat", value: "", label: "" };
  return (
    <Field label="Stat">
      <div style={{ display: "flex", gap: 6 }}>
        <input value={s.value} onChange={(e) => onChange({ ...s, value: e.target.value })} placeholder="−63%" style={{ ...inputStyle, width: 80 }} />
        <input value={s.label} onChange={(e) => onChange({ ...s, label: e.target.value })} placeholder="Label" style={inputStyle} />
      </div>
    </Field>
  );
}

export function Field({ label, children, collapsible = false }: { label: string; children: React.ReactNode; collapsible?: boolean }) {
  const [open, setOpen] = useState(true);
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8a857d", marginBottom: 7 };
  if (collapsible) {
    return (
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setOpen((v) => !v)}
          style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6, width: "100%", padding: 0, border: "none", background: "none", cursor: "pointer" }}>
          <ChevronDown size={13} style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform 0.15s" }} />
          {label}
        </button>
        {open && children}
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={labelStyle}>{label}</div>
      {children}
    </div>
  );
}

const SWATCHES = ["#ffffff", "#0f0f10", DEFAULT_ACCENT];

export function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: "#8a857d" }}>
      {label}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 44, height: 30, border: "1px solid #dcd8d2", borderRadius: 6, padding: 2, cursor: "pointer", background: "#fff" }} />
      <div style={{ display: "flex", gap: 5 }}>
        {SWATCHES.map((c) => {
          const active = value.toLowerCase() === c.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => onChange(c)}
              style={{
                width: 16, height: 16, borderRadius: 4, padding: 0, cursor: "pointer",
                background: c, border: "1px solid #cfcbc4",
                boxShadow: active ? `0 0 0 2px #fff, 0 0 0 3px ${ACCENT}` : "none",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%", fontSize: 13, padding: "8px 10px", border: "1px solid #dcd8d2",
  borderRadius: 6, outline: "none", color: "#1a1a1a", background: "#fff", fontFamily: "inherit",
};

export const primaryBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, background: ACCENT, color: "#fff",
  border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer",
};

export const ghostBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, background: "#fff", color: "#5a554e",
  border: "1px dashed #cfcbc4", borderRadius: 8, padding: "9px 12px", fontSize: 13, cursor: "pointer",
};

export function iconBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 34, height: 34, borderRadius: 6, border: "1px solid #dcd8d2", background: "#fff",
    color: disabled ? "#cfcbc4" : "#5a554e", cursor: disabled ? "default" : "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  };
}

// ─── Thumbnail settings (deck-level) ──────────────────────────────
// Authors the preview card shown on the Projects page (/projects) for this
// case study — image / eyebrow / title / body — plus a show-on-Projects toggle.
export function PreviewCardSettings({ preview, onChange, onClose, isCaseStudy, onToggleCaseStudy }: {
  preview: ProjectPreview;
  onChange: (patch: Partial<ProjectPreview>) => void;
  onClose: () => void;
  isCaseStudy?: boolean;
  onToggleCaseStudy?: () => void;
}) {
  const show = preview.show !== false;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
      <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 91, width: 340, maxHeight: "80vh", overflowY: "auto", background: "#fff", border: "1px solid #e3e0db", borderRadius: 10, boxShadow: "0 18px 44px rgba(0,0,0,0.16)", padding: 16, textAlign: "left" }}>
        {/* Case study vs plain project — decides how "Ask AI Tom" links to this
            page: "View the case study" vs "View project". */}
        {onToggleCaseStudy && <button onClick={onToggleCaseStudy}
          style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, width: "100%", padding: "10px 10px", marginBottom: 14, borderRadius: 6, border: "1px solid #e3e0db", background: "#fff", cursor: "pointer", textAlign: "left" }}>
          <span>
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1a1a1a" }}>Case study</span>
            <span style={{ display: "block", fontSize: 11, color: "#8c8c8c", marginTop: 2 }}>An in-depth piece — links read “View the case study”.</span>
          </span>
          <span style={{ position: "relative", flexShrink: 0, display: "inline-block", width: 38, height: 22, marginTop: 1, borderRadius: 999, background: isCaseStudy ? ACCENT : "#dcd8d2", transition: "background 0.15s" }}>
            <span style={{ position: "absolute", top: 3, left: isCaseStudy ? 19 : 3, width: 16, height: 16, borderRadius: 999, background: "#fff", transition: "left 0.15s" }} />
          </span>
        </button>}

        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Projects page card</div>
        <div style={{ fontSize: 11, color: "#8c8c8c", marginBottom: 14 }}>The preview card shown on the Projects page. Clicking it opens this project.</div>

        <button onClick={() => onChange({ show: !show })}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "8px 10px", marginBottom: 14, borderRadius: 6, border: "1px solid #e3e0db", background: "#fff", cursor: "pointer" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a" }}>Show on Projects page</span>
          <span style={{ position: "relative", display: "inline-block", width: 38, height: 22, borderRadius: 999, background: show ? ACCENT : "#dcd8d2", transition: "background 0.15s" }}>
            <span style={{ position: "absolute", top: 3, left: show ? 19 : 3, width: 16, height: 16, borderRadius: 999, background: "#fff", transition: "left 0.15s" }} />
          </span>
        </button>

        <ImageField label="Image" value={preview.image ?? ""} onChange={(v) => onChange({ image: v })} overlay={preview.imageOverlay === true} onOverlayChange={(v) => onChange({ imageOverlay: v })} />

        <Field label="Eyebrow">
          <input value={preview.eyebrow ?? ""} onChange={(e) => onChange({ eyebrow: e.target.value })} placeholder="e.g. Case Study" style={inputStyle} />
        </Field>
        <Field label="Title">
          <input value={preview.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} placeholder="Project title" style={inputStyle} />
        </Field>
        <Field label="Body">
          <textarea value={preview.body ?? ""} onChange={(e) => onChange({ body: e.target.value })} rows={3} placeholder="Short description" style={{ ...inputStyle, resize: "vertical" }} />
        </Field>
        <ImageField label="Slide logo (Intro / Title Card, top-left)" value={preview.logo ?? ""} onChange={(v) => onChange({ logo: v })} />
        <ImageField label="Card logo (Projects page card — falls back to slide logo)" value={preview.cardLogo ?? ""} onChange={(v) => onChange({ cardLogo: v })} />

        <div style={{ fontSize: 11, fontWeight: 600, color: "#8c8c8c", margin: "12px 0 8px" }}>PREVIEW</div>
        <div style={{ background: "#f3f1ed", borderRadius: 8, padding: 12 }}>
          <ProjectPreviewCard image={preview.image} imageOverlay={preview.imageOverlay} eyebrow={preview.eyebrow} title={preview.title} body={preview.body} logo={preview.cardLogo || preview.logo} />
        </div>
      </div>
    </>
  );
}
