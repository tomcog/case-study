import type { Driver, MarkRect, MarkRects } from "./driver.js";
import type { WalkthroughTarget } from "./types.js";
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
};
/** Everything but the marked element, dimmed — and optionally click-proof. */
export declare function Spotlight({ box, shape, lock }: {
    box: Box | null;
    shape?: "rect" | "pill";
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
