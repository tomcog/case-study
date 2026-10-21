import type { Driver, MarkRect, MarkRects } from "./driver.js";
import type { Callout, WalkthroughTarget } from "./types.js";
export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}
/** Why the demo can't be driven here, when it can't. */
export type Blocked = "no-demo" | "foreign" | "small";
/** The box around one or more demo rects, in stage pixels. */
export declare function toBox(rects: MarkRect[], scale: number, pad?: number): Box | null;
/** Mount the demo, keep it measured, and report the marks' geometry. */
export declare function useDemo(target: WalkthroughTarget, marks: string[]): {
    frameRef: import("react").RefObject<HTMLIFrameElement | null>;
    stageRef: import("react").RefObject<HTMLDivElement | null>;
    driver: Driver | null;
    rects: MarkRects;
    scale: number;
    measure: () => void;
    framed: boolean;
    blocked: Blocked | null;
    frameStyle: import("react").CSSProperties;
    bounds: {
        w: number;
        h: number;
    };
};
/** A ring around the marked element, with the rest of the demo optionally
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
/** Why there's no live demo to show. */
export declare function DemoNotice({ blocked, src }: {
    blocked: Blocked;
    src: string;
}): import("react").JSX.Element;
export declare function Callouts({ items, rects, scale, bounds }: {
    items: Callout[];
    rects: MarkRects;
    scale: number;
    bounds: {
        w: number;
        h: number;
    };
}): import("react").JSX.Element | null;
