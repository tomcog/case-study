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
/** A label pointing at something in the demo. Anchored to a mark rather than
 * to coordinates: a live product reflows, scrolls and changes with its data,
 * so a position that was right when it was authored wouldn't stay right. */
export interface Callout {
    mark: string;
    /** The copy, in the same inline markup as the panel's. */
    text: string;
    /** Which side of the element it sits on. Flipped when it won't fit, and
     * chosen by whichever side has room when it isn't given. */
    placement?: "top" | "right" | "bottom" | "left";
    /** Nudge from that position, in demo pixels. */
    offset?: {
        x?: number;
        y?: number;
    };
}
export type StepAdvance = {
    on: "manual";
    label?: string;
} | {
    on: "click";
    mark: string;
} | {
    on: "path";
    path: string;
} | {
    on: "signal";
    name: string;
} | {
    on: "any";
    of: StepAdvance[];
};
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
    /** Labels pointing at parts of the demo, shown for as long as the step is. */
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
export declare const DEFAULT_WALKTHROUGH: WalkthroughContent;
/** Every mark a step points at, spotlight and callouts together, in the order
 * they were authored and without repeats. */
export declare function stepMarks(step?: WalkthroughStep): string[];
/** The demo a step runs in: the nearest `enter.app` at or before it. A run of
 * steps through one app only has to name it once, and jumping straight to step
 * seven still resolves to the same app as walking there.
 *
 * Crossing into another app is always a fresh document, so the reader's work in
 * the app they are leaving doesn't carry over — each app boots from its seed. */
export declare function targetAt(content: WalkthroughContent, index: number): WalkthroughTarget;
/** The name a step resolves to, or null for the default demo. An unknown name
 * — "default" among them — means the default demo, which is how a step says
 * it comes back from a named one. */
export declare function appAt(content: WalkthroughContent, index: number): string | null;
/** Every demo the walkthrough can show, the default first. */
export declare function allTargets(content: WalkthroughContent): {
    name: string | null;
    target: WalkthroughTarget;
}[];
