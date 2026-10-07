import { useLayoutEffect, useRef, useState } from "react";
import { LogoMark } from "./LogoMark.js";
import { renderStyledText } from "./renderStyledText.js";

import { RED, INK as BLACK } from "../theme.js";

// Design reference (from Figma node 264:784): 460×260 card, image on the left
// half, text on the right. Rendered at the fixed design size and scaled to fit
// its container width so the proportions/type stay exact at any card size.
const CARD_W = 460;
const CARD_H = 260;

export function ProjectPreviewCard({ image, imageOverlay, eyebrow, title, body, logo }: {
  image?: string;
  imageOverlay?: boolean;
  eyebrow?: string;
  title?: string;
  body?: string;
  logo?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const compute = () => setScale(el.clientWidth / CARD_W);
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", width: "100%", aspectRatio: `${CARD_W} / ${CARD_H}` }}>
      {/* Absolutely positioned so the fixed 460×260 layout box doesn't set a
          min-content height that would override the container's aspect-ratio —
          otherwise the card can't get shorter than 260px on narrow viewports. */}
      <div style={{ position: "absolute", top: 0, left: 0, width: CARD_W, height: CARD_H, transformOrigin: "top left", transform: `scale(${scale})` }}>
        <div style={{
          display: "flex", width: CARD_W, height: CARD_H, borderRadius: 16, overflow: "hidden",
          background: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
        }}>
          {/* Image half — logo pinned top-left, mirroring the Intro slide */}
          <div style={{ position: "relative", width: CARD_W / 2, height: CARD_H, flexShrink: 0, background: "#e9e7e3", overflow: "hidden" }}>
            {image && <img src={image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
            {imageOverlay && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0))" }} />}
            {logo && <LogoMark src={logo} position="left top" style={{ position: "absolute", left: 20, top: 20, width: "63%", maxWidth: 135, height: 31.5 }} />}
          </div>
          {/* Text half */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12, padding: "40px 40px 40px 20px" }}>
            {eyebrow && (
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: RED, lineHeight: 1, wordBreak: "break-word" }}>{renderStyledText(eyebrow)}</div>
            )}
            {title && (
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.25, color: BLACK, wordBreak: "break-word" }}>{renderStyledText(title)}</div>
            )}
            {body && (
              <div style={{ fontSize: 14, fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 1.5, color: BLACK, wordBreak: "break-word" }}>{renderStyledText(body)}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
