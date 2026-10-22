/** An element's box in the demo's own viewport coordinates. */
export interface MarkRect {
    x: number;
    y: number;
    w: number;
    h: number;
}
export type MarkRects = Record<string, MarkRect>;
/** Marks a target as a path rather than a mark id. */
export declare const PATH_PREFIX = "css:";
export declare const isPath: (target: string) => boolean;
/** An element the author pointed at while picking. `mark` is its mark id, or a
 * path when it has none; null only when no path could single it out. */
export interface PickHit {
    mark: string | null;
    label: string;
    rect: MarkRect;
}
export interface Driver {
    /** Resolves once the demo has a document to read. */
    ready(): Promise<void>;
    /** Put the app at this route. `reload` boots it fresh there, which is what a
     * step that starts a run does; without it the route is merely assigned, so
     * the reader keeps whatever they just did. */
    open(path?: string, opts?: {
        reload?: boolean;
    }): Promise<void>;
    /** Do to the app what a reader would, by mark. False when the mark isn't
     * there to act on, which the builder reports rather than failing silently. */
    click(mark: string): boolean;
    /** Put text in a marked field. Goes in through the property setter the
     * element's own framework listens on, then fires the events it expects, so
     * a React or Vue app updates its state rather than being painted over. */
    type(mark: string, text: string): boolean;
    /** Current geometry of the given marks. Missing marks are left out. */
    marks(ids: string[]): MarkRects;
    /** Scroll a mark into view inside the demo. */
    reveal(id: string): void;
    /** The route the demo is showing, as a hash ("#/settings"). */
    currentPath(): string;
    /** The reader clicked something. `hit` says whether the click landed on (or
     * inside) a given target, so a mark and a path are matched the same way. */
    onClick(cb: (hit: (target: string) => boolean) => void): () => void;
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
