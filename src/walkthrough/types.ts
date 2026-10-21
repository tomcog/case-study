// ─── Walkthrough content ───────────────────────────────────────────
// A walkthrough is the second kind of project: a side panel of stepped copy
// next to a live product the reader actually clicks. The product is a demo
// build co-hosted with the project (projects/<id>/demo/), so the player can
// drive it directly — see driver.ts for that contract.
//
// The demo it points at has to hold up five rules:
//   1. data-walkthrough="<id>" on anything a step references (never selectors)
//   2. hash routes, so `enter.path` is an assignment and a path advance is a hashchange
//   3. boot from ?wt=<state> (sometimes empty), so any step is reachable by
//      reload, and treat the parameter's presence as "I am in a walkthrough"
//   4. fixtures, not network — deterministic for every reader
//   5. built with base "./" into projects/<id>/demo/

import type { ProjectPreview } from "../core.js";

export interface WalkthroughTarget {
  /** The demo's entry file, site-relative: "/projects/<id>/demo/index.html".
   * The player needs it same-origin; a cross-origin target can't be driven. */
  src: string;
  /** Viewport width to give the demo, in px. The stage scales to fit it. */
  width?: number;
  /** Below this stage width the player drops the frame for the copy alone. */
  minWidth?: number;
}

/** How the product gets into the state a step talks about. */
export interface StepEnter {
  /** Which demo this step runs in: a key of the walkthrough's `targets`, or
   * absent to stay in whichever app the steps before it named. */
  app?: string;
  /** A hash route inside the demo, e.g. "#/settings". */
  path?: string;
  /** A seed the demo understands, passed as ?wt=<state>. Only applied when the
   * step is arrived at out of order — walking forward keeps what the reader did.
   * ?wt= is sent either way, with no value when a step names no seed, so the
   * demo always knows it is in a walkthrough. */
  state?: string;
}

export interface Spotlight {
  /** One or more data-walkthrough ids. The first one is what gets revealed. */
  mark: string | string[];
  shape?: "rect" | "pill";
  /** Padding around the element, in demo px (default 6). */
  pad?: number;
  /** Block clicks everywhere but the marked element. */
  lock?: boolean;
}

export type StepAdvance =
  | { on: "manual"; label?: string }
  | { on: "click"; mark: string }
  | { on: "path"; path: string }
  | { on: "signal"; name: string }
  | { on: "any"; of: StepAdvance[] };

export interface WalkthroughStep {
  /** Stable id. Step state seeds and deep links key off it. */
  id: string;
  eyebrow?: string;
  title?: string;
  /** Panel copy, in the same inline markup as a screen's text fields. */
  body?: string;
  /** Panel illustration, and what stands in for the frame on a small screen. */
  imageUrl?: string;
  enter?: StepEnter;
  spotlight?: Spotlight;
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
  /** The demo the walkthrough opens in, and the one a step falls back to. */
  target: WalkthroughTarget;
  /** Further demos, by name, for a walkthrough that crosses more than one app.
   * A step picks one with `enter.app`. Each has to be same-origin too. */
  targets?: Record<string, WalkthroughTarget>;
  /** Which side the copy sits on (default "left"). */
  panelSide?: "left" | "right";
  steps: WalkthroughStep[];
}

/** What a new walkthrough starts as: one step, and no demo pointed at yet. */
export const DEFAULT_WALKTHROUGH: WalkthroughContent = {
  kind: "walkthrough",
  target: { src: "", width: 1280, minWidth: 900 },
  steps: [
    {
      id: "step-1",
      eyebrow: "Step one",
      title: "Start here",
      body: "Point this walkthrough at a demo, then describe what the reader should do first.",
      advance: { on: "manual" },
    },
  ],
};

/** The demo a step runs in: the nearest `enter.app` at or before it. A run of
 * steps through one app only has to name it once, and jumping straight to step
 * seven still resolves to the same app as walking there.
 *
 * Crossing into another app is always a fresh document, so the reader's work in
 * the app they are leaving doesn't carry over — each app boots from its seed. */
export function targetAt(content: WalkthroughContent, index: number): WalkthroughTarget {
  const app = appAt(content, index);
  return (app && content.targets?.[app]) || content.target;
}

/** The name a step resolves to, or null for the default demo. An unknown name
 * — "default" among them — means the default demo, which is how a step says
 * it comes back from a named one. */
export function appAt(content: WalkthroughContent, index: number): string | null {
  for (let i = Math.min(index, content.steps.length - 1); i >= 0; i--) {
    const app = content.steps[i]?.enter?.app;
    if (app) return content.targets?.[app] ? app : null;
  }
  return null;
}

/** Every demo the walkthrough can show, the default first. */
export function allTargets(content: WalkthroughContent): { name: string | null; target: WalkthroughTarget }[] {
  return [
    { name: null, target: content.target },
    ...Object.entries(content.targets ?? {}).map(([name, target]) => ({ name, target })),
  ];
}
