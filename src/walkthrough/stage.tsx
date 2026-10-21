// ─── The stage ─────────────────────────────────────────────────────
// Whatever a step is talking about, scaled to fit its pane, with the spotlight
// and callouts drawn over it. The player and the builder share this so an
// author sees exactly what a reader will.
//
// A driveable stage is read through a Driver, and every box it reports is in
// demo pixels, multiplied by the stage's scale on its way out. There is no
// fixed canvas as there is for a screen: the frame gets a real viewport width
// and the stage scales to fit it.
//
// An opaque stage — an embed or a still — reports nothing, so anything drawn
// over it is positioned by an Area: fractions of the stage, resolved against
// its measured bounds.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { INK, RED } from "../theme.js";
import { renderStyledText } from "../ui/renderStyledText.js";
import { sameOriginDriver } from "./driver.js";
import type { Driver, MarkRect, MarkRects } from "./driver.js";
import type { Area, Callout, Stage, StillImage } from "./types.js";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Why there is nothing on the stage, when there isn't. */
export type Blocked = "no-stage" | "no-src" | "foreign" | "small";

/** What the stage is doing: showing one of the three kinds, or nothing. */
export type StageMode = "code" | "embed" | "mock" | "blocked";

/** The box around one or more demo rects, in stage pixels. */
export function toBox(rects: MarkRect[], scale: number, pad = 6): Box | null {
  if (!rects.length) return null;
  const x1 = Math.min(...rects.map((r) => r.x)) - pad;
  const y1 = Math.min(...rects.map((r) => r.y)) - pad;
  const x2 = Math.max(...rects.map((r) => r.x + r.w)) + pad;
  const y2 = Math.max(...rects.map((r) => r.y + r.h)) + pad;
  return { x: x1 * scale, y: y1 * scale, w: (x2 - x1) * scale, h: (y2 - y1) * scale };
}

/** An Area resolved against the stage it sits on. Fractions in, pixels out. */
export function areaBox(area: Area | undefined, bounds: { w: number; h: number }): Box | null {
  if (!area) return null;
  return { x: area.x * bounds.w, y: area.y * bounds.h, w: area.w * bounds.w, h: area.h * bounds.h };
}

/** Mount the stage, keep it measured, and — where it can be read — report the
 * marks' geometry. */
export function useStage(stage: Stage | null, marks: string[]) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [rects, setRects] = useState<MarkRects>({});
  const [vw, setVw] = useState(() => window.innerWidth);

  const markKey = marks.join("|");
  const marksRef = useRef(marks);
  marksRef.current = marks;

  const kind = stage?.kind ?? null;
  const src = stage?.src ?? "";

  useEffect(() => {
    const on = () => setVw(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  // A code stage on another origin can't be read from here, so say so rather
  // than showing a frame that silently never responds. An embed is on another
  // origin by design and makes no such promise, so this is only code's problem.
  const foreign = useMemo(() => {
    if (!src || kind !== "code") return false;
    try {
      return new URL(src, window.location.href).origin !== window.location.origin;
    } catch {
      return true;
    }
  }, [src, kind]);

  const blocked: Blocked | null = !stage
    ? "no-stage"
    : !src
      ? "no-src"
      : foreign
        ? "foreign"
        : kind !== "mock" && vw < (stage.minWidth ?? 900)
          ? "small"
          : null;

  const mode: StageMode = blocked ? "blocked" : (kind as StageMode);
  const driveable = mode === "code";

  useEffect(() => {
    const el = frameRef.current;
    if (!driveable || !el) return;
    const next = sameOriginDriver(el, src);
    setDriver(next);
    return () => {
      next.dispose();
      setDriver(null);
    };
  }, [driveable, src]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  // Every rect was measured inside one particular stage, so leaving it makes
  // all of them wrong rather than merely out of date. Dropping them is what
  // stops a mark from the demo you just left being drawn over the mock-up you
  // arrived at, where nothing will ever correct it.
  useEffect(() => {
    setRects({});
  }, [src, kind]);

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

  const width = stage?.width ?? size.w;
  const scale = size.w && width ? Math.min(1, size.w / width) : 1;

  const frameStyle: React.CSSProperties = {
    width: width || "100%",
    height: scale ? size.h / scale : "100%",
    border: 0,
    display: "block",
    transform: `scale(${scale})`,
    transformOrigin: "top left",
  };

  return { frameRef, stageRef, driver, rects, scale, measure, mode, driveable, blocked, frameStyle, bounds: size };
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

/** A ring around the marked element, with the rest of the stage optionally
 * dimmed and optionally click-proof. The two are independent: the shield that
 * blocks clicks is the same four panels that do the dimming, so `lock` without
 * `dim` just makes them invisible. */
export function Spotlight({ box, shape, dim = true, lock }: {
  box: Box | null;
  shape?: "rect" | "pill";
  dim?: boolean;
  lock?: boolean;
}) {
  if (!box) return null;
  const shield = (part: React.CSSProperties, key: string) => (
    <div
      key={key}
      style={{
        position: "absolute",
        background: dim ? "rgba(12,14,18,0.46)" : "transparent",
        pointerEvents: lock ? "auto" : "none",
        ...part,
      }}
    />
  );
  return (
    <>
      {(dim || lock) && (
        <>
          {shield({ left: 0, top: 0, width: "100%", height: Math.max(0, box.y) }, "t")}
          {shield({ left: 0, top: box.y + box.h, width: "100%", bottom: 0 }, "b")}
          {shield({ left: 0, top: box.y, width: Math.max(0, box.x), height: box.h }, "l")}
          {shield({ left: box.x + box.w, top: box.y, right: 0, height: box.h }, "r")}
        </>
      )}
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

/** Drag a rectangle on the stage. This is how an opaque stage gets pointed at:
 * there is nothing to click for a mark, so the author draws the box instead.
 * Reported as fractions, so it survives the stage being any size later. */
export function AreaDraw({ bounds, onDone, onCancel }: {
  bounds: { w: number; h: number };
  onDone: (area: Area) => void;
  onCancel: () => void;
}) {
  const [from, setFrom] = useState<{ x: number; y: number } | null>(null);
  const [to, setTo] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const at = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const box = from && to && {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    w: Math.abs(to.x - from.x),
    h: Math.abs(to.y - from.y),
  };

  const finish = () => {
    if (box && box.w > 6 && box.h > 6 && bounds.w && bounds.h) {
      onDone({ x: box.x / bounds.w, y: box.y / bounds.h, w: box.w / bounds.w, h: box.h / bounds.h });
    } else {
      onCancel();
    }
  };

  return (
    <div
      onMouseDown={(e) => {
        const p = at(e);
        setFrom(p);
        setTo(p);
      }}
      onMouseMove={(e) => from && setTo(at(e))}
      onMouseUp={finish}
      onMouseLeave={() => from && finish()}
      style={{ position: "absolute", inset: 0, cursor: "crosshair", background: "rgba(12,14,18,0.18)" }}
    >
      {box && (
        <div
          style={{
            position: "absolute",
            left: box.x,
            top: box.y,
            width: box.w,
            height: box.h,
            border: `2px solid ${RED}`,
            background: "rgba(229,26,56,0.10)",
            borderRadius: 8,
          }}
        />
      )}
    </div>
  );
}

/** A still covering the stage: a `mock` stage, or one step's own image laid
 * over whatever it runs in. It takes the clicks, so nothing underneath can be
 * poked through it. */
export function StageStill({ image }: { image: StillImage }) {
  const fill = image.fit === "fill";
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#0f1115",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: fill ? 0 : 40,
      }}
    >
      {image.src && (
        <img
          src={image.src}
          alt=""
          style={
            fill
              ? { width: "100%", height: "100%", objectFit: "cover", display: "block" }
              : { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block", borderRadius: 10, boxShadow: "0 20px 50px -20px rgba(0,0,0,0.6)" }
          }
        />
      )}
    </div>
  );
}

/** Why there's nothing on the stage. `stageId` tells the two empty cases
 * apart: a walkthrough with no stages at all, and a step pointed at one that
 * has since been deleted or renamed. */
export function StageNotice({ blocked, src, stageId }: { blocked: Blocked; src: string; stageId?: string | null }) {
  const text =
    blocked === "no-stage" ? (
      stageId ? (
        <>
          This step runs in <strong>{stageId}</strong>, which this walkthrough no longer has. Point it at one of its stages, or add that
          one back.
        </>
      ) : (
        <>This walkthrough has no stages yet. Add one — code you built and serve from this site, a framed URL, or an image.</>
      )
    ) : blocked === "no-src" ? (
      <>This stage has no address yet.</>
    ) : blocked === "foreign" ? (
      <>
        <strong>{src}</strong> is on another origin, so it can't be driven from here. Play this walkthrough on the site that hosts the
        app, or make this stage an <strong>embed</strong>, which is shown rather than driven.
      </>
    ) : (
      <>This stage needs a wider window than this one.</>
    );
  return (
    <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 32, color: "#6f6a66", fontSize: 14, textAlign: "center" }}>
      <p style={{ maxWidth: 440, lineHeight: 1.6 }}>{text}</p>
    </div>
  );
}

// ─── Callouts ──────────────────────────────────────────────────────
// Labels anchored to something on the stage. The anchor comes from the caller
// — a measured mark, or an Area resolved against the bounds — but the bubble
// is always drawn at the stage's own scale: a demo shown at 0.4 would
// otherwise have callouts no one could read.

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

export function Callouts({ items, boxFor, bounds }: {
  items: Callout[];
  /** Where this callout points, in stage pixels, or null if it has nothing to
   * point at — an unmeasured mark, or an area on a stage with no size yet. */
  boxFor: (callout: Callout) => Box | null;
  bounds: { w: number; h: number };
}) {
  const placed = items
    .map((callout, i) => {
      const box = boxFor(callout);
      if (!box) return null;
      // An anchor scrolled out of the stage has nothing to point at.
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      if (cx < 0 || cy < 0 || cx > bounds.w || cy > bounds.h) return null;

      const side = sideFor(box, bounds, callout.placement);
      const dx = callout.offset?.x ?? 0;
      const dy = callout.offset?.y ?? 0;
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

      return { key: `${callout.mark ?? "area"}-${i}`, callout, edge, anchor: placedAt, shift };
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
