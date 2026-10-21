// ─── Walkthrough player ────────────────────────────────────────────
// Full-viewport, two panes: stepped copy beside the live product. The product
// is an iframe the player drives through a Driver, and the spotlight is drawn
// here in the parent from the element boxes the driver reports, so the
// highlight keeps this package's look rather than the product's.
//
// Unlike a case study there is no fixed canvas: the frame gets a real viewport
// width and the stage scales to fit it, so every reported box is multiplied by
// that scale on its way to the overlay.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { INK, RED } from "../theme.js";
import { renderStyledText } from "../ui/renderStyledText.js";
import { sameOriginDriver } from "./driver.js";
import type { Driver, MarkRect, MarkRects } from "./driver.js";
import type { StepAdvance, WalkthroughContent } from "./types.js";

const PANEL_W = 400;
const LINE = "#e6e4e1";
const MUTED = "#6f6a66";

const norm = (path: string) => `#${path.replace(/^#\/?/, "").replace(/\/$/, "")}`;

/** Listen for whatever completes this step. Returns an unsubscribe. */
function watch(driver: Driver, advance: StepAdvance, done: () => void): () => void {
  switch (advance.on) {
    case "click":
      return driver.onClick((mark) => mark === advance.mark && done());
    case "path":
      return driver.onPath((path) => norm(path) === norm(advance.path) && done());
    case "signal":
      return driver.onSignal((name) => name === advance.name && done());
    case "any": {
      const offs = advance.of.map((a) => watch(driver, a, done));
      return () => offs.forEach((off) => off());
    }
    default:
      return () => {};
  }
}

export function WalkthroughPlayer({ content, onExit }: { content: WalkthroughContent; onExit?: () => void }) {
  const { target, steps } = content;
  const reduced = useReducedMotion();

  const frameRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [i, setI] = useState(0);
  const [rects, setRects] = useState<MarkRects>({});
  const [nudge, setNudge] = useState(false);
  const arrivedFrom = useRef<number | null>(null); // null = nothing visited yet, so step 0 still seeds

  const step = steps[i];
  const finished = i >= steps.length;

  const markIds = useMemo(() => {
    const mark = step?.spotlight?.mark;
    if (!mark) return [] as string[];
    return Array.isArray(mark) ? mark : [mark];
  }, [step]);
  const markKey = markIds.join("|");

  // A demo on another origin can't be read from here, so say so rather than
  // showing a frame that silently never responds.
  const foreign = useMemo(() => {
    try {
      return new URL(target.src, window.location.href).origin !== window.location.origin;
    } catch {
      return true;
    }
  }, [target.src]);

  const [vw, setVw] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setVw(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const small = vw < (target.minWidth ?? 900);
  const framed = !small && !foreign && !!target.src;

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
      setStage({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [framed]);

  const measure = useCallback(() => {
    if (!driver) return;
    setRects(markIds.length ? driver.marks(markIds) : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver, markKey]);

  useEffect(() => {
    if (!driver) return;
    return driver.onLayout(measure);
  }, [driver, measure]);

  const next = useCallback(() => setI((n) => n + 1), []);

  useEffect(() => {
    if (!driver || !step) return;
    let live = true;
    // Walking forward keeps whatever the reader just did; any other arrival
    // (first mount, Back, a jump) reloads the demo from the step's seed.
    const reseed = arrivedFrom.current !== i - 1;
    arrivedFrom.current = i;
    setNudge(false);
    setRects({});

    const timers: number[] = [];
    void (async () => {
      await driver.enter(step, { reseed });
      if (!live) return;
      if (markIds[0]) driver.reveal(markIds[0]);
      measure();
      // Re-measure while the demo's own transitions and the smooth scroll settle.
      timers.push(window.setTimeout(measure, 140), window.setTimeout(measure, 460));
    })();

    const off = watch(driver, step.advance, () => live && next());
    const nudgeAt = window.setTimeout(() => live && setNudge(true), step.nudgeAfter ?? 12000);

    return () => {
      live = false;
      off();
      timers.forEach((t) => clearTimeout(t));
      clearTimeout(nudgeAt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver, i, step, markKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit?.();
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const width = target.width ?? stage.w;
  const scale = stage.w && width ? Math.min(1, stage.w / width) : 1;

  const box = useMemo(() => {
    const found = markIds.map((id) => rects[id]).filter(Boolean) as MarkRect[];
    if (!found.length) return null;
    const pad = step?.spotlight?.pad ?? 6;
    const x1 = Math.min(...found.map((r) => r.x)) - pad;
    const y1 = Math.min(...found.map((r) => r.y)) - pad;
    const x2 = Math.max(...found.map((r) => r.x + r.w)) + pad;
    const y2 = Math.max(...found.map((r) => r.y + r.h)) + pad;
    return { x: x1 * scale, y: y1 * scale, w: (x2 - x1) * scale, h: (y2 - y1) * scale };
  }, [rects, markKey, scale, step]);

  const restart = () => {
    arrivedFrom.current = null;
    setI(0);
  };

  const panel = (
    <div
      style={{
        width: small ? "100%" : PANEL_W,
        flex: "none",
        background: "#fff",
        borderRight: small || content.panelSide === "right" ? undefined : `1px solid ${LINE}`,
        borderLeft: content.panelSide === "right" && !small ? `1px solid ${LINE}` : undefined,
        display: "flex",
        flexDirection: "column",
        padding: "26px 28px 22px",
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: INK, letterSpacing: "-0.01em" }}>{content.title}</span>
        <span style={{ fontSize: 12, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
          {finished ? `${steps.length} of ${steps.length}` : `${i + 1} of ${steps.length}`}
        </span>
      </div>

      <div style={{ height: 3, background: LINE, borderRadius: 2, margin: "14px 0 26px", overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${((finished ? steps.length : i) / steps.length) * 100}%` }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 30 }}
          style={{ height: "100%", background: RED }}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step?.id ?? "__done"}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {step ? (
              <>
                {step.eyebrow && (
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: RED, marginBottom: 10 }}>
                    {step.eyebrow}
                  </div>
                )}
                {step.title && (
                  <h2 style={{ margin: "0 0 12px", fontSize: 23, lineHeight: 1.2, letterSpacing: "-0.02em", color: INK, fontWeight: 650 }}>
                    {step.title}
                  </h2>
                )}
                {step.body && (
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#45413d" }}>{renderStyledText(step.body)}</p>
                )}
                {step.imageUrl && (
                  <img src={step.imageUrl} alt="" style={{ display: "block", width: "100%", borderRadius: 10, marginTop: 18, border: `1px solid ${LINE}` }} />
                )}
              </>
            ) : (
              <>
                <h2 style={{ margin: "0 0 12px", fontSize: 23, lineHeight: 1.2, letterSpacing: "-0.02em", color: INK, fontWeight: 650 }}>
                  That's the walkthrough.
                </h2>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#45413d" }}>
                  The product stays where you left it — keep clicking around, or start again from the top.
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{ paddingTop: 22 }}>
        {step && step.advance.on === "manual" && (
          <button type="button" onClick={next} style={primary}>
            {step.advance.label ?? "Next"}
          </button>
        )}

        {step && step.advance.on !== "manual" && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: MUTED, minHeight: 38 }}>
            <motion.span
              animate={reduced ? {} : { opacity: [1, 0.25, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 7, height: 7, borderRadius: "50%", background: RED, flex: "none" }}
            />
            {framed ? "Your turn — do it in the app" : "Open this on a wider screen to try it"}
          </div>
        )}

        {!step && (
          <button type="button" onClick={restart} style={primary}>
            Start again
          </button>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14 }}>
          {i > 0 && (
            <button type="button" onClick={() => setI((n) => Math.max(0, n - 1))} style={ghost}>
              Back
            </button>
          )}
          {step && step.advance.on !== "manual" && nudge && (
            <button type="button" onClick={next} style={ghost}>
              Skip this step
            </button>
          )}
          {onExit && (
            <button type="button" onClick={onExit} style={{ ...ghost, marginLeft: "auto" }}>
              Exit
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const scrim = (part: React.CSSProperties) => (
    <div style={{ position: "absolute", background: "rgba(12,14,18,0.46)", pointerEvents: step?.spotlight?.lock ? "auto" : "none", ...part }} />
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: content.panelSide === "right" ? "row-reverse" : "row",
        background: "#f4f3f1",
        zIndex: 50,
      }}
    >
      {panel}

      {framed && (
        <div ref={stageRef} style={{ flex: 1, position: "relative", overflow: "hidden", background: "#0f1115" }}>
          <iframe
            ref={frameRef}
            title={content.title ?? "Product"}
            style={{
              width: width || "100%",
              height: scale ? stage.h / scale : "100%",
              border: 0,
              display: "block",
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          />

          {box && (
            <>
              {scrim({ left: 0, top: 0, width: "100%", height: Math.max(0, box.y) })}
              {scrim({ left: 0, top: box.y + box.h, width: "100%", bottom: 0 })}
              {scrim({ left: 0, top: box.y, width: Math.max(0, box.x), height: box.h })}
              {scrim({ left: box.x + box.w, top: box.y, right: 0, height: box.h })}
              <motion.div
                initial={false} // appear around the element, then travel between steps
                animate={{ left: box.x, top: box.y, width: box.w, height: box.h }}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                style={{
                  position: "absolute",
                  borderRadius: step?.spotlight?.shape === "pill" ? 999 : 10,
                  boxShadow: `0 0 0 2px ${RED}, 0 10px 30px -8px rgba(0,0,0,0.5)`,
                  pointerEvents: "none",
                }}
              />
            </>
          )}
        </div>
      )}

      {!framed && !small && (
        <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 32, color: MUTED, fontSize: 14, textAlign: "center" }}>
          <p style={{ maxWidth: 380, lineHeight: 1.6 }}>
            {!target.src ? (
              <>This walkthrough doesn't point at a demo yet. Set its <strong>target.src</strong> to a demo served from this site.</>
            ) : (
              <>
                This walkthrough drives a demo hosted alongside it. <strong>{target.src}</strong> is on another origin, so it can't be
                driven from here — play it on the site that hosts the demo.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

const primary: React.CSSProperties = {
  appearance: "none",
  border: 0,
  background: RED,
  color: "#fff",
  font: "inherit",
  fontSize: 14,
  fontWeight: 600,
  padding: "10px 16px",
  borderRadius: 8,
  cursor: "pointer",
};

const ghost: React.CSSProperties = {
  appearance: "none",
  border: 0,
  background: "none",
  color: MUTED,
  font: "inherit",
  fontSize: 13.5,
  padding: 0,
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 3,
};
