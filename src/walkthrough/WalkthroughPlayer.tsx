// ─── Walkthrough player ────────────────────────────────────────────
// Full-viewport, two panes: stepped copy beside whatever the step is about.
// A driveable stage is an iframe reached through a Driver, and the spotlight is
// drawn here in the parent from the boxes the driver reports, so the highlight
// keeps this package's look rather than the product's. An opaque stage reports
// nothing, so it is shown, its overlays are positioned by Area, and the reader
// moves on with the panel's button. The stage itself (frame, scaling, overlay)
// is shared with the builder — see stage.tsx. Exit, Back and Next sit in one
// toolbar pinned to the viewport's lower left, the same on every step, slides
// included.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { Segment, SegmentedControl, Toolbar } from "@tomcoggia/ui";
import { INK, RED } from "../theme.js";
import { SlideView } from "../slide.js";
import { Paragraphs } from "../core.js";
import { CaseStudyLink } from "../ui/CaseStudyLink.js";
import type { Screen } from "../core.js";
import { Callouts, STAGE_BG, Spotlight, StageNotice, StageStill, areaBox, spotlightBox, toBox, useApp } from "./stage.js";
import type { Box } from "./stage.js";
import type { Driver } from "./driver.js";
import { bootsApp, contentOf, contentsOf, currentEntry, stepMarks } from "./types.js";
import type { Callout, ContentsEntry, StepAction, StepAdvance, WalkthroughContent } from "./types.js";
import type { IngestedApp } from "../project.js";
import { useCaseStudyConfig } from "../config.js";
import { AskFab, FAB_CLEAR } from "../ask/AskFab.js";
import { AskRail } from "../ask/AskRail.js";

const PANEL_W = 360;
const LINE = "#e6e4e1";
const MUTED = "#6f6a66";
/** The player's page, which the copy panel sits on rather than over: the library's
 * page under a rail or panel. */
const PAGE_BG = "var(--ui-surface-pale, #f5f5f5)";

const norm = (path: string) => `#${path.replace(/^#\/?/, "").replace(/\/$/, "")}`;

/** The marks a step points at, as a list. */
export const marksOf = (mark?: string | string[]) => (!mark ? [] : Array.isArray(mark) ? mark : [mark]);

/** Listen for whatever completes this step. Returns an unsubscribe. */
function watch(driver: Driver, advance: StepAdvance, done: () => void): () => void {
  switch (advance.on) {
    case "click":
      return driver.onClick((hit) => hit(advance.mark) && done());
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

/** Run the step's actions in order, stopping if the step moves on under us. */
async function perform(driver: Driver, actions: StepAction[], live: () => boolean) {
  for (const action of actions) {
    if (!live()) return;
    if (action.do === "wait") await new Promise((r) => setTimeout(r, action.ms));
    else if (action.do === "click") driver.click(action.mark);
    else driver.type(action.mark, action.text);
  }
}

export function WalkthroughPlayer({ content, apps = [], startIndex = 0, projectId, onExit }: {
  content: WalkthroughContent;
  /** The pool this walkthrough's steps draw from; a step stores an app's id,
   * and where that app is served from is the host's to say. */
  apps?: IngestedApp[];
  startIndex?: number;
  /** The project's id, which Ask AI Tom asks about. With the host's `ask`
   * endpoint and `content.ask.enabled`, the player shows the FAB. */
  projectId?: string;
  onExit?: () => void;
}) {
  const { steps } = content;
  const reduced = useReducedMotion();

  const [i, setI] = useState(startIndex);
  // Whether the player has drawn anything yet. A slide it opens on fades in
  // and builds like any other; one it crosses to from an app rides the
  // crossfade between the two chromes instead (SlideLayer).
  const opened = useRef(false);
  useEffect(() => { opened.current = true; }, []);
  const [nudge, setNudge] = useState(false);

  const step = steps[i];
  const finished = i >= steps.length;

  // Spotlight and callouts are measured together.
  const markIds = useMemo(() => stepMarks(step), [step]);
  const markKey = markIds.join("|");

  // The app this step runs, and what it displays over it. Changing the app
  // swaps the document; displaying something else leaves it running underneath.
  const app = useMemo(() => apps.find((a) => a.id === step?.app), [apps, step?.app]);
  const shown = contentOf(step);
  const demo = useApp(app?.src, markIds, app);
  const { driver, measure } = demo;

  // Ask AI Tom: on where the host and the project both say so.
  const { ask } = useCaseStudyConfig();
  const askOn = !!ask && !!projectId && !!content.ask?.enabled;
  const [askOpen, setAskOpen] = useState(false);
  const askOpenRef = useRef(false);
  askOpenRef.current = askOpen;
  const closeAsk = useCallback(() => setAskOpen(false), []);

  const next = useCallback(() => setI((n) => n + 1), []);
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);
  // Read by the key handler, which is bound once; `manual` is recomputed every
  // render, so it has to be reachable rather than captured.
  const canGoOn = useRef(false);

  useEffect(() => {
    if (!step) return;
    let live = true;
    setNudge(false);

    const timers: number[] = [];
    let off = () => {};
    if (driver) {
      // A step that names a different app than the one before it boots that
      // app at its screen. Within a run nothing reloads, so whatever the reader
      // did on the last step is still there on this one; a step there that
      // names a screen routes the app to it, and one that doesn't leaves it be.
      const boots = bootsApp(steps, i);
      void (async () => {
        await driver.open(step.start, { reload: boots });
        if (!live) return;
        if (step.actions?.length) await perform(driver, step.actions, () => live);
        if (!live) return;
        if (markIds[0]) driver.reveal(markIds[0]);
        measure();
        // Re-measure while the app's own transitions and the smooth scroll settle.
        timers.push(window.setTimeout(measure, 140), window.setTimeout(measure, 460));
      })();
      off = watch(driver, step.advance, () => live && next());
    }

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
    // The same keys do the same thing on every step. Forward is offered only
    // where the panel would offer it: a step waiting on the reader has no Next
    // button, so the arrow doesn't quietly skip it either.
    const onKey = (e: KeyboardEvent) => {
      // While the rail is open the keys are its: Esc closes it, and the arrows
      // move the caret in its field rather than the walkthrough.
      if (askOpenRef.current) return;
      if (e.key === "Escape") onExit?.();
      if (e.key === "ArrowLeft") back();
      if (e.key === "ArrowRight" && canGoOn.current) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit, back, next]);

  // A spotlight is anchored either way: to measured marks on a driveable
  // stage, or to a rectangle on one that can only be shown.
  const box = useMemo(() => spotlightBox(step?.spotlight, demo.rects, demo.bounds), [step?.spotlight, demo.rects, demo.bounds]);

  const calloutBox = (callout: Callout): Box | null => {
    if (callout.area) return areaBox(callout.area, demo.bounds);
    const rect = callout.mark ? demo.rects[callout.mark] : undefined;
    return rect ? toBox([rect], 0) : null;
  };

  const restart = () => setI(0);

  // The project's contents, for a step that shows it.
  const contents = useMemo(() => contentsOf(steps), [steps]);

  const narrow = demo.blocked === "small";
  // A slide is the whole viewport: it is composed copy, so a panel beside it
  // would be saying the same thing twice.
  const slide = shown.kind === "slide" ? shown.screen : null;
  // Nothing can be observed through an image or an embed, so a step showing
  // one can only be left by its button, whatever it was authored to wait for.
  const watching = !!driver && shown.kind === "app";
  const manual = !watching || step?.advance.on === "manual";
  // Forward is offered where the panel used to offer it: on a step that moves
  // on by its button, or once a step waiting on the reader has nudged them.
  const canNext = !!step && (manual || nudge);
  canGoOn.current = canNext;
  const manualLabel = step?.advance.on === "manual" ? (step.advance.label ?? "Next") : "Next";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: content.panelSide === "right" ? "row-reverse" : "row",
        background: PAGE_BG,
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: narrow ? "100%" : PANEL_W,
          flex: "none",
          background: PAGE_BG,
          display: "flex",
          flexDirection: "column",
          // The panel's foot is the toolbar's row: its button sits level with
          // the toolbar, at the other end. Where the Ask AI Tom FAB takes the
          // lower right instead — a panel on the right or one taking the whole
          // width — the foot stays clear of it.
          padding: `26px 28px ${askOn && (narrow || content.panelSide === "right") ? 22 + FAB_CLEAR : TOOLBAR_INSET}px`,
          overflowY: "auto",
        }}
      >
        <div style={{ flex: 1, minHeight: 0 }}>
          {/* Over a running app the eyebrow holds still while the copy under
              it changes: it names where the reader is, which stays put. */}
          {step?.eyebrow && shown.kind === "app" && (
            <div style={eyebrow}>
              <Paragraphs text={step.eyebrow} />
            </div>
          )}
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
                  {step.eyebrow && shown.kind !== "app" && (
                    <div style={eyebrow}>
                      <Paragraphs text={step.eyebrow} />
                    </div>
                  )}
                  {step.title && (
                    <h2 style={{ margin: "0 0 12px", fontSize: 23, lineHeight: 1.2, letterSpacing: "-0.02em", color: INK, fontWeight: 650 }}>
                      <Paragraphs text={step.title} />
                    </h2>
                  )}
                  {step.body && (
                    <div style={{ fontSize: 15, lineHeight: 1.6, color: "#45413d" }}><Paragraphs text={step.body} styled /></div>
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

        {/* Below the copy rather than in it, so it holds still from one step
            that shows it to the next, as the eyebrow does. */}
        {step?.showContents && !slide && contents.length > 0 && (
          <Contents title={content.contentsTitle} entries={contents} current={currentEntry(contents, i)} onJump={setI} />
        )}

        <div style={foot}>
          {/* The same pill as a slide's Next, and as optional as one. */}
          {step && manual && step.advance.on === "manual" && step.advance.button !== false && (
            <CaseStudyLink onClick={next} style={pill}>
              {manualLabel}
            </CaseStudyLink>
          )}

          {step && !manual && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: MUTED }}>
              <motion.span
                animate={reduced ? {} : { opacity: [1, 0.25, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                style={{ width: 7, height: 7, borderRadius: "50%", background: RED, flex: "none" }}
              />
              Your turn — do it in the app
            </div>
          )}

          {!step && (
            <CaseStudyLink onClick={restart} style={pill}>
              Start again
            </CaseStudyLink>
          )}
        </div>
      </div>

      {(demo.live || shown.kind !== "app") && !narrow && (
        // The stage sits above the panel and casts the library's soft shadow
        // onto it, so the panel reads as the page underneath rather than a
        // column beside it.
        <div
          ref={demo.stageRef}
          style={{
            flex: 1,
            position: "relative",
            zIndex: 1,
            overflowX: "auto",
            overflowY: "hidden",
            background: STAGE_BG,
            boxShadow: "var(--ui-shadow-float-1, 0 0 17px 0 rgb(0 0 0 / 0.1))",
          }}
        >
          {/* The app sits underneath whatever the step displays, so it keeps
              running while an image or an embed covers it. Keyed by its src,
              so arriving at a different app is always a fresh document. */}
          {demo.live && app && <iframe key={app.src} ref={demo.frameRef} title={app.label} style={demo.frameStyle} />}

          {shown.kind === "image" && <StageStill image={shown} />}
          {shown.kind === "embed" && (
            <iframe
              key={shown.url}
              src={shown.url}
              title={content.title ?? "Embedded page"}
              allowFullScreen
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
            />
          )}

          <Spotlight box={box} shape={step?.spotlight?.shape} spread={step?.spotlight?.spread} strength={step?.spotlight?.strength} pulse={step?.spotlight?.pulse} dim={step?.spotlight?.dim} lock={step?.spotlight?.lock} stageW={demo.contentW} />
          {step?.callouts?.length ? <Callouts items={step.callouts} boxFor={calloutBox} bounds={demo.bounds} scrollX={demo.scrollX} /> : null}
        </div>
      )}

      {/* Only a step that means to show its app complains about not having
          one, and only about what the reader can do something about: a step
          running no app is an unfilled field, so its stage is left empty. The
          builder is where the author hears about that. */}
      {shown.kind === "app" && !demo.live && !narrow && demo.blocked !== "no-app" && <StageNotice blocked={demo.blocked!} src={app?.src} />}

      {/* A slide covers the whole viewport, panel included. It is drawn over
          the frame rather than instead of it, so the app underneath keeps
          running and the next step picks the reader up where they left off.
          Crossing between the two chromes is a crossfade: the slide's push
          transitions belong between slides, and this is not that. */}
      <AnimatePresence initial={false}>
        {slide && (
          <motion.div
            key="slide"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.01 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.995 }}
            transition={{ duration: reduced ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
            onClick={next}
            style={{ position: "absolute", inset: 0, zIndex: 2, cursor: "pointer", background: PAGE_BG }}
          >
            <SlideLayer slide={slide} crossing={opened.current} reduced={!!reduced} logoSrc={content.preview?.logo} footnote={i === 0 ? NAV_HINT : undefined} onNext={next} />

            {/* A slide has no panel to carry the count, so it sits at the
                foot of the slide; the toolbar does the moving. */}
            <span style={slideCount}>
              {i + 1} of {steps.length}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Last, so it sits over the panel, the stage and a slide alike. */}
      <Toolbar aria-label="Walkthrough" style={toolbarAt}>
        {onExit && (
          <SegmentedControl size="sm" tone="white" actions aria-label="Leave">
            <Segment icon={<ExternalLink />} onClick={onExit}>
              Exit
            </Segment>
          </SegmentedControl>
        )}
        <SegmentedControl size="sm" tone="white" actions aria-label="Back">
          <Segment icon={<ArrowLeft />} hideLabel disabled={i === 0} onClick={back}>
            Previous step
          </Segment>
        </SegmentedControl>
        <SegmentedControl size="sm" tone="white" actions aria-label="Next">
          {/* The way on, so it carries the accent: the one control the reader
              is most likely looking for. */}
          <Segment icon={<ArrowRight />} hideLabel disabled={!canNext} onClick={next} style={{ background: RED, color: "#fff" }}>
            Next step
          </Segment>
        </SegmentedControl>
      </Toolbar>

      {askOn && (
        <>
          <AskFab onClick={() => setAskOpen(true)} hidden={askOpen} />
          <AskRail
            open={askOpen}
            onClose={closeAsk}
            title={content.title}
            projectId={projectId!}
            stepIds={steps.map((s) => s.id)}
            stepIndex={Math.min(i, steps.length - 1)}
            suggestions={content.ask?.suggestions}
            // Going to a step means seeing it: the rail steps aside.
            onStep={(to) => {
              setAskOpen(false);
              setI(to);
            }}
          />
        </>
      )}
    </div>
  );
}


/** The project's contents: a jump to each listed step, with the section the
 * reader is in marked. */
function Contents({ title, entries, current, onJump }: { title?: string; entries: ContentsEntry[]; current: number; onJump: (index: number) => void }) {
  const heading = title?.trim();
  return (
    <nav aria-label={heading || "Contents"} style={{ marginTop: 26 }}>
      {heading && (
        <div style={{ ...eyebrow, color: MUTED, fontSize: 12 }}>
          <Paragraphs text={heading} />
        </div>
      )}
      <ol style={{ listStyle: "none", margin: 0, padding: 0, borderLeft: `1px solid ${LINE}` }}>
        {entries.map((entry, n) => {
          const here = n === current;
          return (
            <li key={entry.index}>
              <button
                type="button"
                onClick={() => onJump(entry.index)}
                aria-current={here ? "step" : undefined}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  font: "inherit",
                  fontSize: 14,
                  lineHeight: 1.35,
                  fontWeight: here ? 650 : 450,
                  color: here ? INK : MUTED,
                  background: "none",
                  border: 0,
                  // The marker sits on the list's rule, so the current entry
                  // reads as the rule lit at that point.
                  borderLeft: `2px solid ${here ? RED : "transparent"}`,
                  marginLeft: -1,
                  padding: "6px 0 6px 14px",
                  cursor: here ? "default" : "pointer",
                }}
              >
                <Paragraphs text={entry.label} />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// The toolbar's corner: its inset from the viewport's edges, and how much of
// the panel's foot that leaves it (an sm control is 24 tall, the bar's own
// inset 4 on each side).
const eyebrow: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: RED,
  marginBottom: 10,
};

const TOOLBAR_INSET = 16;
const TOOLBAR_H = 32;

/** The panel's foot: the toolbar's row, with what moves the reader on at the
 * end the toolbar leaves free. */
const foot: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  minHeight: TOOLBAR_H,
  marginTop: 22,
};
/** The slide's Next pill, as tall as the toolbar so the two share a line. */
const pill: React.CSSProperties = { fontFamily: "inherit", height: TOOLBAR_H, padding: "0 16px", boxSizing: "border-box" };

const toolbarAt: React.CSSProperties = {
  position: "absolute",
  left: TOOLBAR_INSET,
  bottom: TOOLBAR_INSET,
  // Over the stage (1) and a slide (2) alike.
  zIndex: 3,
};

/** What the first slide says at its foot, since a deck gives no other sign of
 * how to move through it. */
const NAV_HINT = "Use on-screen or keyboard arrow keys to navigate";

/** Seconds one slide's background takes to crossfade into the next's. */
const SLIDE_FADE = 1;

/** The slides, one over the next. One slide to the next crossfades over
 * SLIDE_FADE: the incoming slide is laid over the outgoing one and fades in
 * while the old one stays opaque beneath it, so the backgrounds blend without
 * the backdrop showing through between them. The content makes its own
 * entrance on top of that, every time — the slide the player opens on
 * included, which fades in from the backdrop. The one exception is the slide
 * the layer opens on when `crossing` from an app: the layer's own crossfade
 * already brings it in, so it only builds. */
function SlideLayer({ slide, crossing, reduced, logoSrc, footnote, onNext }: { slide: Screen; crossing: boolean; reduced: boolean; logoSrc?: string; footnote?: string; onNext: () => void }) {
  const [crossedTo] = useState(crossing ? slide.id : null);
  return (
    // Never `initial={false}` here: it would hold back the build inside too.
    <AnimatePresence>
      <motion.div
        key={slide.id}
        initial={slide.id === crossedTo ? false : { opacity: 0, zIndex: 1 }}
        animate={{ opacity: 1, zIndex: 1 }}
        // Leaving is a wait, not a fade: the old slide has to stay up
        // for as long as the new one takes to cover it. Its opacity
        // only drops once the incoming one is fully opaque.
        exit={{ opacity: 0, zIndex: 0, transition: { delay: reduced ? 0 : SLIDE_FADE, duration: 0.01 } }}
        transition={{ duration: reduced ? 0 : SLIDE_FADE, ease: "linear" }}
        style={{ position: "absolute", inset: 0 }}
      >
        <SlideView screen={slide} play reduced={reduced} logoSrc={logoSrc} footnote={footnote} onNext={onNext} />
      </motion.div>
    </AnimatePresence>
  );
}

const slideCount: React.CSSProperties = {
  position: "absolute",
  zIndex: 2,
  left: "50%",
  bottom: 22,
  transform: "translateX(-50%)",
  fontSize: 12,
  color: MUTED,
  fontVariantNumeric: "tabular-nums",
};
