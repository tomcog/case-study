import { useState, useEffect, useMemo, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { isVideoSrc } from "../video.js";
import { useCaseStudyConfig } from "../config.js";
import { RED } from "../theme.js";

const defaultLibraryUrl = (path: string) => `/images/${path}`;

export function ImageLibraryModal({ onSelect, onClose }: { onSelect: (path: string) => void; onClose: () => void }) {
  const { assets } = useCaseStudyConfig();
  const urlFor = assets?.libraryUrl ?? defaultLibraryUrl;
  const [imageFiles, setImageFiles] = useState<string[]>([]);
  const [folder, setFolder] = useState<string | null>(null); // null = folder index
  useEffect(() => {
    assets?.list?.().then(setImageFiles).catch(() => setImageFiles([]));
  }, [assets]);

  // Group files by their top-level folder ("" = loose files at the library root).
  const { folders, byFolder, rootFiles } = useMemo(() => {
    const byFolder: Record<string, string[]> = {};
    for (const f of imageFiles) {
      const slash = f.indexOf("/");
      const key = slash === -1 ? "" : f.slice(0, slash);
      (byFolder[key] ??= []).push(f);
    }
    return {
      byFolder,
      folders: Object.keys(byFolder).filter((k) => k !== "").sort(),
      rootFiles: byFolder[""] ?? [],
    };
  }, [imageFiles]);

  const media: CSSProperties = { width: "100%", height: "100%", objectFit: "cover", display: "block" };
  const thumb = (file: string, alt: string) =>
    isVideoSrc(file) ? <video src={urlFor(file)} style={media} muted /> : <img src={urlFor(file)} alt={alt} style={media} />;

  const tile = (file: string) => (
    <HoverButton key={file} onClick={() => onSelect(urlFor(file))} title={file}
      style={{ aspectRatio: "1 / 1", overflow: "hidden", borderRadius: 4, padding: 0, border: "none", background: "none" }}
      hoverStyle={{ boxShadow: `0 0 0 2px ${RED}` }}>
      {thumb(file, file)}
    </HoverButton>
  );

  const grid = (cols: number): CSSProperties => ({ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 });
  const muted = "#8c8c8c";

  return createPortal(
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.18)", width: 480, maxWidth: "calc(100vw - 32px)", maxHeight: "70vh", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "inherit" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #d4d4d4" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {folder !== null && (
              <HoverButton onClick={() => setFolder(null)} title="Back to folders"
                style={{ fontSize: 15, color: muted, lineHeight: 1, border: "none", background: "none", padding: 0 }} hoverStyle={{ color: RED }}>
                &larr;
              </HoverButton>
            )}
            <span style={{ fontSize: 13, fontWeight: 500, color: "#171717", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {folder !== null ? `Images / ${folder}` : "Select an image folder"}
            </span>
          </div>
          <HoverButton onClick={onClose} style={{ fontSize: 18, color: muted, lineHeight: 1, border: "none", background: "none", padding: 0 }} hoverStyle={{ color: RED }}>&times;</HoverButton>
        </div>

        <div style={{ overflowY: "auto", padding: 16 }}>
          {imageFiles.length === 0 ? (
            <p style={{ fontSize: 12, color: muted, textAlign: "center", padding: "24px 0", margin: 0 }}>No images found</p>
          ) : folder !== null ? (
            /* Inside a folder: its images */
            <div style={grid(4)}>{(byFolder[folder] ?? []).map(tile)}</div>
          ) : (
            /* Folder index: a card per folder, plus any loose root files */
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {folders.length > 0 && (
                <div style={grid(3)}>
                  {folders.map((name) => {
                    const items = byFolder[name];
                    const cover = items.find((f) => !isVideoSrc(f)) ?? items[0];
                    return (
                      <HoverButton key={name} onClick={() => setFolder(name)} title={name}
                        style={{ display: "flex", flexDirection: "column", borderRadius: 6, overflow: "hidden", border: "1px solid #e5e5e5", background: "#fff", padding: 0, textAlign: "left" }}
                        hoverStyle={{ borderColor: RED }}>
                        <div style={{ aspectRatio: "4 / 3", background: "#f5f5f5", overflow: "hidden", width: "100%" }}>
                          {cover && thumb(cover, name)}
                        </div>
                        <div style={{ padding: "6px 8px", minWidth: 0, width: "100%", boxSizing: "border-box" }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: "#171717", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                          <div style={{ fontSize: 11, color: muted }}>{items.length} image{items.length === 1 ? "" : "s"}</div>
                        </div>
                      </HoverButton>
                    );
                  })}
                </div>
              )}
              {rootFiles.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.025em", color: muted, marginBottom: 8 }}>Loose files</div>
                  <div style={grid(4)}>{rootFiles.map(tile)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function HoverButton({ onClick, title, style, hoverStyle, children }: {
  onClick: () => void;
  title?: string;
  style: CSSProperties;
  hoverStyle: CSSProperties;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onClick={onClick} title={title}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit", ...style, ...(hover ? hoverStyle : null) }}>
      {children}
    </button>
  );
}
