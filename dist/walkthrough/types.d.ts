import type { ProjectPreview } from "../core.js";
/** What is on the stage, which is really a statement about what the player can
 * do with it: read into it, or only show it. */
export type StageKind = "code" | "embed" | "mock";
export interface Stage {
    /** Stable id, which is what a step names. Renaming the label leaves it be. */
    id: string;
    /** What the builder calls it. Falls back to the id. */
    label?: string;
    kind: StageKind;
    /** A code stage's entry file, site-relative
     * ("/projects/<id>/demo/orders/index.html") and same-origin or it can't be
     * driven; an embed's URL; an image's file. */
    src: string;
    /** Viewport width to give a code stage or an embed, in px. The stage scales to fit it. */
    width?: number;
    /** Below this stage width the player drops the frame for the copy alone. */
    minWidth?: number;
    /** An image stage's framing: "center" shows it whole, "fill" crops it to the stage.
     * Default "center". */
    fit?: "center" | "fill";
}
/** Whether the player can read into this stage — marks, live geometry, and
 * advancing on what the reader does. Everything else is shown, not driven. */
export declare const isDriveable: (stage?: Stage | null) => boolean;
/** How the product gets into the state a step talks about. */
export interface StepEnter {
    /** Which stage this step runs in, by id. Absent stays in whichever stage the
     * steps before it named. */
    stage?: string;
    /** A hash route inside a code stage, e.g. "#/settings". Opaque stages have none. */
    path?: string;
    /** A seed the demo understands, passed as ?wt=<state>.
     *
     * Applied whenever the document is created — the first step, a jump, or
     * arriving in a stage that isn't the one on screen. It is left off only when
     * walking forward inside the stage the reader is already using, so their work
     * survives the step. That is why coming back to an app later lands where the
     * step points rather than where the reader left it: re-entry is a fresh
     * document, and a fresh document always takes the seed. */
    state?: string;
}
/** A rectangle on the stage, in fractions of its width and height (0–1).
 *
 * Opaque stages anchor to one of these rather than to a mark. Marks exist
 * because a live product reflows, scrolls and changes with its data, so a
 * position that was right when it was authored wouldn't stay right. A still
 * image and a frame we can't read into don't reflow — and can't be measured
 * anyway — so a rectangle is both safe and the only thing available. */
export interface Area {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface Spotlight {
    /** One or more data-walkthrough ids, on a driveable stage. The first one is
     * what gets revealed. */
    mark?: string | string[];
    /** Where to draw it on an opaque stage, which has no marks to find. */
    area?: Area;
    shape?: "rect" | "pill";
    /** Padding around the element, in demo px (default 6). Marks only. */
    pad?: number;
    /** Dim the rest of the stage (default true). Off leaves the product at full
     * strength with only the ring to draw the eye. */
    dim?: boolean;
    /** Block clicks everywhere but the marked element. Independent of `dim`:
     * the shield is there either way, it just isn't visible without it. */
    lock?: boolean;
}
/** A label pointing at something on the stage: a mark on a driveable one, a
 * rectangle on an opaque one. */
export interface Callout {
    mark?: string;
    area?: Area;
    /** The copy, in the same inline markup as the panel's. */
    text: string;
    /** Which side of the element it sits on. Flipped when it won't fit, and
     * chosen by whichever side has room when it isn't given. */
    placement?: "top" | "right" | "bottom" | "left";
    /** Nudge from that position, in stage pixels. */
    offset?: {
        x?: number;
        y?: number;
    };
}
/** A still laid over the stage for one step, to set the scene without leaving
 * the app. Whatever is underneath stays loaded, so the step after it picks up
 * where the reader left off — which is the whole difference between this and a
 * `mock` stage, where there is nothing underneath to come back to. */
export interface StillImage {
    src: string;
    /** "center" shows the image whole, centred and never scaled up; "fill"
     * covers the stage, cropping what doesn't fit. Default "center". */
    fit?: "center" | "fill";
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
    /** Cover the stage with an image for this one step. It takes the clicks, so
     * such a step advances on its button. */
    still?: StillImage;
    enter?: StepEnter;
    spotlight?: Spotlight;
    /** Labels pointing at parts of the stage, shown for as long as the step is. */
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
    /** Everything this walkthrough can put on the stage. Steps name one by id.
     * The order is the author's; the first is only where a walkthrough starts
     * before any step has named a stage, which is no more than a convenience for
     * the common case of there being one. */
    stages: Stage[];
    /** Which side the copy sits on (default "left"). */
    panelSide?: "left" | "right";
    steps: WalkthroughStep[];
}
/** What a new walkthrough starts as: one step, and no stage to put it on. */
export declare const DEFAULT_WALKTHROUGH: WalkthroughContent;
/** Every mark a step points at, spotlight and callouts together, in the order
 * they were authored and without repeats. Empty on an opaque stage, where the
 * same things are anchored by rectangle instead. */
export declare function stepMarks(step?: WalkthroughStep): string[];
/** The stage id a step runs in: the nearest `enter.stage` at or before it.
 *
 * Resolving by looking backwards rather than by remembering where the reader
 * has been is what makes jumping straight to step seven land in the same stage
 * as walking there. With no step naming one, it is the first stage — so a
 * walkthrough with a single stage never has to mention it. */
export declare function stageIdAt(content: WalkthroughContent, index: number): string | null;
/** The stage a step runs in, or null when it names one that no longer exists.
 * A missing stage is reported rather than quietly swapped for another: a step
 * pointed at the wrong app is worse than a step with nothing to show. */
export declare function stageAt(content: WalkthroughContent, index: number): Stage | null;
export interface StageRun {
    stageId: string | null;
    stage: Stage | null;
    /** Inclusive step indices. */
    from: number;
    to: number;
}
/** The steps grouped into the runs that share a stage. Derived, never stored:
 * a run is just "until some step names a different stage", so reordering steps
 * can't put the grouping out of step with the steps themselves. */
export declare function stageRuns(content: WalkthroughContent): StageRun[];
