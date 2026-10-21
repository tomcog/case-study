import type { Screen } from "./core.js";
export declare function newScreen(): Screen;
/** Everything about one slide: its layout and the fields that layout uses.
 * Lifted out of the builder so a step displaying a slide edits it with exactly
 * the same controls, rather than a second set that drifts. */
export declare function SlideFields({ screen, update, logoSrc }: {
    screen: Screen;
    update: (patch: Partial<Screen>) => void;
    logoSrc?: string;
}): import("react").JSX.Element;
