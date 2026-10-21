// ─── Demo stage ────────────────────────────────────────────────────
// The live product scaled to fit its pane, and the spotlight drawn over it.
// The player and the builder share this so an author sees exactly what a
// reader will.
//
// There is no fixed canvas here as there is for a screen: the frame gets a
// real viewport width and the stage scales to fit it, so every box the driver
// reports is in demo pixels and is multiplied by that scale on its way out.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { INK, RED } from "../theme.js";
import { renderStyledText } from "../ui/renderStyledText.js";
import { sameOriginDriver } from "./driver.js";
import type { Driver, MarkRect, MarkRects } from "./driver.js";
import type { Callout, WalkthroughTarget } from "./types.js";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Why the demo can't be driven here, when it can't. */
export type Blocked = "no-demo" | "foreign" | "small";

/** The box around one or more demo rects, in stage pixels. */
export function toBox(rects: MarkRect[], scale: number, pad = 6): Box | null {
  if (!rects.length) return null;
  const x1 = Math.min(...rects.map((r) => r.x)) - pad;
  const y1 = Math.min(...rects.map((r) => r.y)) - pad;
  const x2 = Math.max(...rects.map((r) => r.x + r.w)) + pad;
  const y2 = Math.max(...rects.map((r) => r.y + r.h)) + pad;
  return { x: x1 * scale, y: y1 * scale, w: (x2 - x1) * scale, h: (y2 - y1) * scale };
}

/** Mount the demo, keep it measured, and report the marks' geometry. */
export function useDemo(target: WalkthroughTarget, marks: string[]) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [rects, setRects] = useState<MarkRects>({});
  const [vw, setVw] = useState(() => window.innerWidth);

  const markKey = marks.join("|");
  const marksRef = useRef(marks);
  marksRef.current = marks;

  useEffect(() => {
    const on = () => setVw(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  // A demo on another origin can't be read from here, so say so rather than
  // showing a frame that silently never responds.
  const foreign = useMemo(() => {
    if (!target.src) return false;
    try {
      return new URL(target.src, window.location.href).origin !== window.location.origin;
    } catch {
      return true;
    }
  }, [target.src]);

  const blocked: Blocked | null = !target.src
    ? "no-demo"
    : foreign
      ? "foreign"
      : vw < (target.minWidth ?? 900)
        ? "small"
        : null;
  const framed = !blocked;

  useEffect(() => {
    const el = frameRef.current;
    if (!framed || !el) return;
    const next = sameOriginDriver(el, target.src);
    setDriver(next);
    return () => {
      next.dispose();
      setDriver(null);
    };
  }, [framed, target.src]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [framed]);

  const measure = useCallback(() => {
    if (!driver) return;
    const ids = marksRef.current;
    const next = ids.length ? driver.marks(ids) : {};
    // The demo reports layout every frame while it animates; only a box that
    // actually moved is worth a render.
    setRects((prev) => (sameRects(prev, next) ? prev : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver, markKey]);

  // Follow these marks as the demo reflows, not just when it scrolls.
  useEffect(() => {
    driver?.observe(marksRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver, markKey]);

  useEffect(() => {
    if (!driver) return;
    return driver.onLayout(measure);
  }, [driver, measure]);

  useEffect(() => {
    measure();
  }, [measure, size.w, size.h]);

  const width = target.width ?? size.w;
  const scale = size.w && width ? Math.min(1, size.w / width) : 1;

  const frameStyle: React.CSSProperties = {
    width: width || "100%",
    height: scale ? size.h / scale : "100%",
    border: 0,
    display: "block",
    transform: `scale(${scale})`,
    transformOrigin: "top left",
  };

  return { frameRef, stageRef, driver, rects, scale, measure, framed, blocked, frameStyle, bounds: size };
}

const sameRects = (a: MarkRects, b: MarkRects) => {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => {
    const x = a[k];
    const y = b[k];
    return y && x.x === y.x && x.y === y.y && x.w === y.w && x.h === y.h;
  });
};

/** Everything but the marked element, dimmed — and optionally click-proof. */
export function Spotlight({ box, shape, lock }: { box: Box | null; shape?: "rect" | "pill"; lock?: boolean }) {
  if (!box) return null;
  const scrim = (part: React.CSSProperties, key: string) => (
    <div key={key} style={{ position: "absolute", background: "rgba(12,14,18,0.46)", pointerEvents: lock ? "auto" : "none", ...part }} />
  );
  return (
    <>
      {scrim({ left: 0, top: 0, width: "100%", height: Math.max(0, box.y) }, "t")}
      {scrim({ left: 0, top: box.y + box.h, width: "100%", bottom: 0 }, "b")}
      {scrim({ left: 0, top: box.y, width: Math.max(0, box.x), height: box.h }, "l")}
      {scrim({ left: box.x + box.w, top: box.y, right: 0, height: box.h }, "r")}
      <motion.div
        initial={false} // appear around the element, then travel between steps
        animate={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
        style={{
          position: "absolute",
          borderRadius: shape === "pill" ? 999 : 10,
          boxShadow: `0 0 0 2px ${RED}, 0 10px 30px -8px rgba(0,0,0,0.5)`,
          pointerEvents: "none",
        }}
      />
    </>
  );
}

/** What the author is about to pick, outlined as they move over the demo. */
export function HoverOutline({ box, ok }: { box: Box | null; ok: boolean }) {
  if (!box) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        borderRadius: 8,
        border: `2px solid ${ok ? RED : "#e0a500"}`,
        background: ok ? "rgba(229,26,56,0.10)" : "rgba(224,165,0,0.12)",
        pointerEvents: "none",
      }}
    />
  );
}

/** Why there's no live demo to show. */
export function DemoNotice({ blocked, src }: { blocked: Blocked; src: string }) {
  const text =
    blocked === "no-demo" ? (
      <>
        This walkthrough doesn't point at a demo yet. Set its <strong>demo path</strong> to something served from this site, such as{" "}
        <code>/projects/&lt;id&gt;/demo/index.html</code>.
      </>
    ) : blocked === "foreign" ? (
      <>
        <strong>{src}</strong> is on another origin, so it can't be driven from here — play this walkthrough on the site that hosts the
        demo.
      </>
    ) : (
      <>The demo needs a wider window than this one.</>
    );
  return (
    <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 32, color: "#6f6a66", fontSize: 14, textAlign: "center" }}>
      <p style={{ maxWidth: 420, lineHeight: 1.6 }}>{text}</p>
    </div>
  );
}

// ─── Callouts ──────────────────────────────────────────────────────
// Labels anchored to elements in the demo. The anchor moves with the demo's
// scale, but the bubble itself is drawn at the stage's own scale: a demo shown
// at 0.4 would otherwise have callouts no one could read.

const BUBBLE_W = 236;
const GAP = 16;

type Side = NonNullable<Callout["placement"]>;

/** The side with room for the bubble, preferring the one that was asked for. */
function sideFor(box: Box, bounds: { w: number; h: number }, wanted?: Side): Side {
  const room: Record<Side, number> = {
    right: bounds.w - (box.x + box.w),
    left: box.x,
    bottom: bounds.h - (box.y + box.h),
    top: box.y,
  };
  const fits = (s: Side) => room[s] >= (s === "left" || s === "right" ? BUBBLE_W + GAP : 90 + GAP);
  if (wanted && fits(wanted)) return wanted;
  return (["right", "left", "bottom", "top"] as Side[]).find(fits) ?? wanted ?? "right";
}

export function Callouts({ items, rects, scale, bounds }: {
  items: Callout[];
  rects: MarkRects;
  scale: number;
  bounds: { w: number; h: number };
}) {
  const placed = items
    .map((callout, i) => {
      const rect = rects[callout.mark];
      const box = rect && toBox([rect], scale, 0);
      if (!box) return null;
      // An anchor scrolled out of the demo has nothing to point at.
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      if (cx < 0 || cy < 0 || cx > bounds.w || cy > bounds.h) return null;

      const side = sideFor(box, bounds, callout.placement);
      const dx = (callout.offset?.x ?? 0) * scale;
      const dy = (callout.offset?.y ?? 0) * scale;
      const edge =
        side === "right" ? { x: box.x + box.w, y: cy }
        : side === "left" ? { x: box.x, y: cy }
        : side === "bottom" ? { x: cx, y: box.y + box.h }
        : { x: cx, y: box.y };
      const anchor =
        side === "right" ? { x: edge.x + GAP, y: edge.y }
        : side === "left" ? { x: edge.x - GAP, y: edge.y }
        : side === "bottom" ? { x: edge.x, y: edge.y + GAP }
        : { x: edge.x, y: edge.y - GAP };
      const shift =
        side === "right" ? "translate(0, -50%)"
        : side === "left" ? "translate(-100%, -50%)"
        : side === "bottom" ? "translate(-50%, 0)"
        : "translate(-50%, -100%)";

      // Flipping sides isn't enough on its own: a bubble centred on an element
      // near an edge still hangs off it. Clamp it inside the stage and let the
      // leader line angle across to the element.
      const PAD = 10;
      const half = BUBBLE_W / 2;
      const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));
      const x = anchor.x + dx;
      const y = anchor.y + dy;
      const placedAt =
        side === "top" || side === "bottom"
          ? { x: clamp(x, half + PAD, bounds.w - half - PAD), y }
          : { x, y: clamp(y, 44 + PAD, bounds.h - 44 - PAD) };

      return { key: `${callout.mark}-${i}`, callout, edge, anchor: placedAt, shift };
    })
    .filter((p): p is NonNullable<typeof p> => !!p);

  if (!placed.length) return null;

  return (
    <>
      <svg width={bounds.w} height={bounds.h} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}>
        {placed.map((p) => (
          <g key={p.key}>
            <line x1={p.edge.x} y1={p.edge.y} x2={p.anchor.x} y2={p.anchor.y} stroke={RED} strokeWidth={1.5} />
            <circle cx={p.edge.x} cy={p.edge.y} r={3.5} fill={RED} />
          </g>
        ))}
      </svg>
      {placed.map((p) => (
        <div
          key={p.key}
          style={{
            position: "absolute",
            left: p.anchor.x,
            top: p.anchor.y,
            transform: p.shift,
            width: BUBBLE_W,
            background: "#fff",
            border: "1px solid #e6e4e1",
            borderRadius: 9,
            boxShadow: "0 10px 28px -10px rgba(0,0,0,0.45)",
            padding: "9px 12px",
            fontSize: 13,
            lineHeight: 1.45,
            color: INK,
            pointerEvents: "none",
          }}
        >
          {renderStyledText(p.callout.text)}
        </div>
      ))}
    </>
  );
}
