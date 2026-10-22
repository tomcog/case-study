import type { Screen } from "./core.js";
export declare function newScreen(): Screen;
/** A slide on screen: the stage scaled to its parent, the bleed and backdrop
 * that fill the letterbox margins, and the screen drawn on the canvas. Every
 * place a slide appears goes through here — the player, the builder's canvas
 * and the project list's thumbnail — so a slide can't look like three
 * slightly different things depending on who drew it.
 *
 * `play` runs the entrance; a builder leaves it off, because the slide is
 * being edited rather than arrived at. `reduced` picks the reduced-motion
 * variants. */
export declare function SlideView({ screen, play, reduced, logoSrc, onAnnotationMove }: {
    screen: Screen;
    play?: boolean;
    reduced?: boolean;
    logoSrc?: string;
    /** Dragging a showcase annotation to a new spot on its image. Only the
     * annotated layout has any, and ScreenView hands it to that layout alone,
     * so a caller doesn't have to know which one that is. */
    onAnnotationMove?: (id: string, x: number, y: number) => void;
}): import("react").JSX.Element;
/** Everything about one slide: its layout and the fields that layout uses.
 * Lifted out of the builder so a step displaying a slide edits it with exactly
 * the same controls, rather than a second set that drifts. */
export declare function SlideFields({ screen, update, logoSrc }: {
    screen: Screen;
    update: (patch: Partial<Screen>) => void;
    logoSrc?: string;
}): import("react").JSX.Element;
