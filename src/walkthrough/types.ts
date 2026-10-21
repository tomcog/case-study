// ─── Walkthrough content ───────────────────────────────────────────
// A walkthrough is the second kind of project: a side panel of stepped copy
// beside whatever that copy is about. Every step says three things for itself,
// and they are independent of one another:
//
//   app      which ingested app is RUNNING, or none. A step that names the
//            same app as the step before it keeps that app's document alive,
//            so whatever the reader did carries forward. Naming a different
//            one throws the old document away and boots the new app.
//   content  what is VISIBLE: that app, a framed URL, or an image. An image
//            over a running app hides it without stopping it, so the step
//            after can pick the reader up where they left off.
//   actions  what the step DOES to the running app as it opens: click a mark,
//            type into one. The app is same-origin, so this needs nothing of
//            it beyond the marks a highlight already needs.
//
// Every step stores its own `app` — there is no "same as before" value. A new
// step copies the previous step's as its starting value and is independent
// after, so moving a step never silently re-homes the ones around it, and the
// control can always say truthfully what the step it belongs to is running.
//
// A "run" is then just consecutive steps holding the same app, which is what
// the rail bands. It is derived every time and never stored: there is nothing
// to get out of step with the steps themselves.
//
// An ingested app has to hold up three rules, and ingesting one means making
// them true of it:
//   1. data-walkthrough="<id>" on anything a step points at or acts on (never
//      CSS selectors, which rot)
//   2. hash routes, so a starting screen is an assignment rather than a load
//   3. built with base "./", since it is served from its own folder

import type { ProjectPreview } from "../core.js";

/** What a step shows. The app named by `WalkthroughStep.app` keeps running
 * whichever of these is on screen. */
export type StepContent =
  /** The running app itself. Nothing to show if the step names no app. */
  | { kind: "app" }
  /** Any URL in a frame — a Figma prototype, a live site. The reader can click
   * inside it; nothing outside it can see them do it, so a step on one is
   * anchored by area and left by the panel's button. */
  | { kind: "embed"; url: string; width?: number; minWidth?: number }
  /** A still. Same anchoring and the same way out as an embed. */
  | { kind: "image"; src: string; fit?: "center" | "fill" };

/** Something the step does to the running app as it opens, in order.
 *
 * Both reach the app the way a reader would — through its DOM, by mark — so
 * neither needs anything added to the app. `wait` is for the gap a click
 * opens: a menu's options don't exist until the menu does. */
export type StepAction =
  | { do: "click"; mark: string }
  | { do: "type"; mark: string; text: string }
  | { do: "wait"; ms: number };

/** A rectangle on the stage, in fractions of its width and height (0–1).
 *
 * An embed and an image anchor to one of these rather than to a mark. Marks
 * exist because a live app reflows, scrolls and changes with its data, so a
 * position that was right when it was authored wouldn't stay right. Neither of
 * those reflows — and neither can be measured anyway — so a rectangle is both
 * safe and the only thing available. */
export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Spotlight {
  /** One or more data-walkthrough ids, when the app is what's on screen. The
   * first is what gets revealed. */
  mark?: string | string[];
  /** Where to draw it over an embed or an image, which have no marks. */
  area?: Area;
  shape?: "rect" | "pill";
  /** Padding around the element, in app px (default 6). Marks only. */
  pad?: number;
  /** Dim the rest of the frame (default true). Off leaves the app at full
   * strength with only the ring to draw the eye. */
  dim?: boolean;
  /** Block clicks everywhere but the marked element. Independent of `dim`:
   * the shield is there either way, it just isn't visible without it. */
  lock?: boolean;
}

/** A label pointing at something on screen: a mark on a running app, a
 * rectangle on an embed or an image. */
export interface Callout {
  mark?: string;
  area?: Area;
  /** The copy, in the same inline markup as the panel's. */
  text: string;
  /** Which side of the element it sits on. Flipped when it won't fit, and
   * chosen by whichever side has room when it isn't given. */
  placement?: "top" | "right" | "bottom" | "left";
  /** Nudge from that position, in frame pixels. */
  offset?: { x?: number; y?: number };
}

export type StepAdvance =
  | { on: "manual"; label?: string }
  | { on: "click"; mark: string }
  | { on: "path"; path: string }
  | { on: "signal"; name: string }
  | { on: "any"; of: StepAdvance[] };

export interface WalkthroughStep {
  /** Stable id. Deep links key off it. */
  id: string;
  eyebrow?: string;
  title?: string;
  /** Panel copy, in the same inline markup as a screen's text fields. */
  body?: string;
  /** Panel illustration, and what stands in for the frame on a small screen. */
  imageUrl?: string;

  /** The ingested app running behind this step, by id. Absent is "none": no
   * app at all, which is a choice rather than a fallback. */
  app?: string;
  /** Which screen the app opens on, as a hash route ("#/orders"). Only means
   * anything on a step that boots the app — one whose `app` differs from the
   * step before it. On the rest the app is already open and the reader may
   * have moved around in it, so sending them back would undo their work. */
  start?: string;
  /** What this step shows. Defaults to the running app. */
  content?: StepContent;
  /** Performed on the running app as the step opens, in order. */
  actions?: StepAction[];

  spotlight?: Spotlight;
  /** Labels pointing at parts of what's on screen, shown for as long as the
   * step is. */
  callouts?: Callout[];
  advance: StepAdvance;
  /** ms to wait before the panel offers a way past this step (default 12000). */
  nudgeAfter?: number;
}

export interface WalkthroughContent {
  kind: "walkthrough";
  schemaVersion?: number;
  title?: string;
  draft?: boolean;
  preview?: ProjectPreview;
  /** Which side the copy sits on (default "left"). */
  panelSide?: "left" | "right";
  steps: WalkthroughStep[];
}

/** What a new walkthrough starts as: one step, running nothing. */
export const DEFAULT_WALKTHROUGH: WalkthroughContent = {
  kind: "walkthrough",
  steps: [
    {
      id: "step-1",
      eyebrow: "Step one",
      title: "Start here",
      body: "Pick an app for this step to run, then describe what the reader should do first.",
      advance: { on: "manual" },
    },
  ],
};

/** What a step shows, defaulted. */
export const contentOf = (step?: WalkthroughStep): StepContent => step?.content ?? { kind: "app" };

/** Whether what's on screen can be read into — marks, live geometry, advancing
 * on what the reader does. Only a running app can; an embed is another origin
 * and an image is a picture. */
export const isLive = (step?: WalkthroughStep): boolean => !!step?.app && contentOf(step).kind === "app";

/** Whether this step boots its app rather than inheriting a running one. The
 * first step always boots; after that it is a step whose app differs from the
 * one before it. */
export function bootsApp(steps: WalkthroughStep[], index: number): boolean {
  const step = steps[index];
  if (!step?.app) return false;
  return index === 0 || steps[index - 1]?.app !== step.app;
}

export interface AppRun {
  /** The ingested app's id, or null for the steps running nothing. */
  app: string | null;
  /** Inclusive step indices. */
  from: number;
  to: number;
}

/** The steps grouped into the runs that share an app. Derived, never stored:
 * a run is just "consecutive steps holding the same app", so reordering steps
 * can't put the grouping out of step with them. */
export function appRuns(steps: WalkthroughStep[]): AppRun[] {
  const out: AppRun[] = [];
  steps.forEach((step, i) => {
    const app = step.app ?? null;
    const last = out[out.length - 1];
    if (last && last.app === app) last.to = i;
    else out.push({ app, from: i, to: i });
  });
  return out;
}

/** Every mark a step points at, spotlight and callouts together, in the order
 * they were authored and without repeats. Empty unless the app is on screen,
 * where the same things are anchored by rectangle instead. */
export function stepMarks(step?: WalkthroughStep): string[] {
  const mark = step?.spotlight?.mark;
  const ids = !mark ? [] : Array.isArray(mark) ? [...mark] : [mark];
  for (const callout of step?.callouts ?? []) {
    if (callout.mark && !ids.includes(callout.mark)) ids.push(callout.mark);
  }
  return ids;
}
