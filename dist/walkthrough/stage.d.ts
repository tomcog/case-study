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
export type StageMode = "demo" | "embed" | "mock" | "blocked";
/** The box around one or more demo rects, in stage pixels. */
export declare function toBox(rects: MarkRect[], scale: number, pad?: number): Box | null;
/** An Area resolved against the stage it sits on. Fractions in, pixels out. */
export declare function areaBox(area: Area | undefined, bounds: {
    w: number;
    h: number;
}): Box | null;
/** Mount the stage, keep it measured, and — where it can be read — report the
 * marks' geometry. */
export declare function useStage(stage: Stage | null, marks: string[]): {
    frameRef: import("react").RefObject<HTMLIFrameElement | null>;
    stageRef: import("react").RefObject<HTMLDivElement | null>;
    driver: Driver | null;
    rects: MarkRects;
    scale: number;
    measure: () => void;
    mode: StageMode;
    driveable: boolean;
    blocked: Blocked | null;
    frameStyle: import("react").CSSProperties;
    bounds: {
        w: number;
        h: number;
    };
};
/** A ring around the marked element, with the rest of the stage optionally
 * dimmed and optionally click-proof. The two are independent: the shield that
 * blocks clicks is the same four panels that do the dimming, so `lock` without
 * `dim` just makes them invisible. */
export declare function Spotlight({ box, shape, dim, lock }: {
    box: Box | null;
    shape?: "rect" | "pill";
    dim?: boolean;
    lock?: boolean;
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
/** A still covering the stage: a `mock` stage, or one step's own image laid
 * over whatever it runs in. It takes the clicks, so nothing underneath can be
 * poked through it. */
export declare function StageStill({ image }: {
    image: StillImage;
}): import("react").JSX.Element;
/** Why there's nothing on the stage. `stageId` tells the two empty cases
 * apart: a walkthrough with no stages at all, and a step pointed at one that
 * has since been deleted or renamed. */
export declare function StageNotice({ blocked, src, stageId }: {
    blocked: Blocked;
    src: string;
    stageId?: string | null;
}): import("react").JSX.Element;
export declare function Callouts({ items, boxFor, bounds }: {
    items: Callout[];
    /** Where this callout points, in stage pixels, or null if it has nothing to
     * point at — an unmeasured mark, or an area on a stage with no size yet. */
    boxFor: (callout: Callout) => Box | null;
    bounds: {
        w: number;
        h: number;
    };
}): import("react").JSX.Element | null;
