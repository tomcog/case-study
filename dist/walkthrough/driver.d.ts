import type { WalkthroughStep } from "./types.js";
/** An element's box in the demo's own viewport coordinates. */
export interface MarkRect {
    x: number;
    y: number;
    w: number;
    h: number;
}
export type MarkRects = Record<string, MarkRect>;
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
    onClick(cb: (mark: string) => void): () => void;
    onPath(cb: (path: string) => void): () => void;
    onSignal(cb: (name: string, detail: unknown) => void): () => void;
    /** The demo scrolled or resized: whatever `marks` returned is now stale. */
    onLayout(cb: () => void): () => void;
    reset(): Promise<void>;
    dispose(): void;
}
/** Drive a demo served from the player's own origin. */
export declare function sameOriginDriver(frame: HTMLIFrameElement, src: string): Driver;
