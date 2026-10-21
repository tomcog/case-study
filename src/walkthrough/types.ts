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
  target: WalkthroughTarget;
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
