import type { Driver, MarkRect, MarkRects } from "./driver.js";
import type { Area, Callout } from "./types.js";
export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}
/** What shows behind the app: the margins beside one held to its max width,
 * and anything an app leaves transparent. White, since that is what most
 * apps assume they are drawn on. */
export declare const STAGE_BG = "#fff";
/** Why there is no app running, when there isn't. */
export type Blocked = "no-app" | "foreign" | "small";
/** The box around one or more demo rects, in stage pixels — which are app
 * pixels, since the frame is never scaled. */
export declare function toBox(rects: MarkRect[], pad?: number): Box | null;
/** An Area resolved against the stage it sits on. Fractions in, pixels out. */
export declare function areaBox(area: Area | undefined, bounds: {
    w: number;
    h: number;
}): Box | null;
/** Mount the app, keep it measured, and report its marks' geometry.
 *
 * `src` is the ingested app's entry, or undefined for a step running nothing.
 * The frame is keyed by it upstream, so arriving at a different app is always
 * a fresh document rather than whatever the last one left behind. */
export declare function useApp(src: string | undefined, marks: string[], size?: {
    minWidth?: number;
    maxWidth?: number;
    minWindow?: number;
}): {
    frameRef: import("react").RefObject<HTMLIFrameElement | null>;
    stageRef: import("react").RefObject<HTMLDivElement | null>;
    driver: Driver | null;
    rects: MarkRects;
    measure: () => void;
    live: boolean;
    blocked: Blocked | null;
    frameStyle: import("react").CSSProperties;
    bounds: {
        w: number;
        h: number;
    };
    contentW: number;
    offsetX: number;
    scrollX: number;
};
/** A glow around the marked element, with the rest of the stage optionally
 * dimmed and optionally click-proof. The two are independent: the shield that
 * blocks clicks is the same four panels that do the dimming, so `lock` without
 * `dim` just makes them invisible.
 *
 * The glow is the Figma's `Highlight` (978:3268): a ring whose hole is the
 * element, filled with the accent fading linearly from `strength` at the
 * hole's edge to nothing `spread` px out. A circle is drawn exactly that way,
 * as a radial gradient. A rect or a pill follows the element's box, which a
 * radial gradient can't, so it is a box-shadow instead — an outer shadow is
 * never painted inside its own box, which is the hole. */
export declare function Spotlight({ box, shape, spread, strength, pulse, dim, lock, stageW }: {
    box: Box | null;
    shape?: "rect" | "pill" | "circle";
    spread?: number;
    strength?: number;
    pulse?: boolean;
    dim?: boolean;
    lock?: boolean;
    /** The stage's full content width, which is the app's rather than the
     * pane's when the two differ. The shields span that, so an app wider than
     * its pane stays dimmed and locked across the part scrolled out of sight.
     * Without it they fall back to the visible pane. */
    stageW?: number;
}): import("react").JSX.Element | null;
/** What the author is about to pick, outlined as they move over the demo. */
export declare function HoverOutline({ box, ok }: {
    box: Box | null;
    ok: boolean;
}): import("react").JSX.Element | null;
/** Drag a rectangle on the stage. This is how an opaque stage gets pointed at:
 * there is nothing to click for a mark, so the author draws the box instead.
 * Reported as fractions, so it survives the stage being any size later. */
export declare function AreaDraw({ bounds, onDone, onCancel }: {
    bounds: {
        w: number;
        h: number;
    };
    onDone: (area: Area) => void;
    onCancel: () => void;
}): import("react").JSX.Element;
/** An image covering the frame. It takes the clicks, so the app underneath
 * keeps running but can't be poked through it. */
export declare function StageStill({ image }: {
    image: {
        src: string;
        fit?: "center" | "fill";
    };
}): import("react").JSX.Element;
/** Why there's nothing running. Only shown when the step displays its app and
 * has none to display — an image or an embed needs no app at all. */
export declare function StageNotice({ blocked, src }: {
    blocked: Blocked;
    src?: string;
}): import("react").JSX.Element;
export declare function Callouts({ items, boxFor, bounds, scrollX }: {
    items: Callout[];
    /** Where this callout points, in stage pixels, or null if it has nothing to
     * point at — an unmeasured mark, or an area on a stage with no size yet. */
    boxFor: (callout: Callout) => Box | null;
    /** The visible pane. */
    bounds: {
        w: number;
        h: number;
    };
    /** How far the pane is scrolled sideways. Stage pixels run across the whole
     * app, but whether a callout fits, and where its bubble is clamped to, is a
     * question about the part of it in view — so the placing is done in the
     * view's pixels and shifted back. */
    scrollX?: number;
}): import("react").JSX.Element | null;
