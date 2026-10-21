import type { WalkthroughStep } from "./types.js";
/** An element's box in the demo's own viewport coordinates. */
export interface MarkRect {
    x: number;
    y: number;
    w: number;
    h: number;
}
export type MarkRects = Record<string, MarkRect>;
/** An element the author pointed at while picking a mark. `mark` is null when
 * the element carries no data-walkthrough id — which is the one thing the
 * builder most needs to be able to say. */
export interface PickHit {
    mark: string | null;
    label: string;
    rect: MarkRect;
}
export interface Driver {
    /** Resolves once the demo has a document to read. */
    ready(): Promise<void>;
    /** Put the product into the state this step describes.
     * `reseed` reloads the demo with the step's `?wt=` state; walking forward
     * leaves it off, so the reader keeps whatever they just did. */
    enter(step: WalkthroughStep, opts?: {
        reseed?: boolean;
    }): Promise<void>;
    /** Current geometry of the given marks. Missing marks are left out. */
    marks(ids: string[]): MarkRects;
    /** Scroll a mark into view inside the demo. */
    reveal(id: string): void;
    /** The route the demo is showing, as a hash ("#/settings"). */
    currentPath(): string;
    onClick(cb: (mark: string) => void): () => void;
    onPath(cb: (path: string) => void): () => void;
    onSignal(cb: (name: string, detail: unknown) => void): () => void;
    /** The demo scrolled, resized, or moved something: whatever `marks` returned
     * is now stale. Reports at most once a frame. */
    onLayout(cb: () => void): () => void;
    /** Which marks to watch closely. Their boxes are then followed as the demo
     * animates, re-renders and reflows, not just when it scrolls. */
    observe(ids: string[]): void;
    /** Authoring: swallow the demo's own interactions and report what's pointed
     * at instead, so a mark can be chosen by clicking it. */
    setPicking(on: boolean): void;
    onPick(cb: (hit: PickHit) => void): () => void;
    onHover(cb: (hit: PickHit | null) => void): () => void;
    reset(): Promise<void>;
    dispose(): void;
}
/** Drive a demo served from the player's own origin. */
export declare function sameOriginDriver(frame: HTMLIFrameElement, src: string): Driver;
