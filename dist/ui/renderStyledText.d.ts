import { type ReactNode } from "react";
/**
 * Lightweight inline markup parser.
 *
 * Syntax:
 *   {text}        → red
 *   **text**      → bold
 *   {**text**}    → bold + red
 *   __text__      → bold + red  (legacy, same result)
 *   [label](url)  → link (red, underlined, opens in new tab)
 *   [text]        → middle gray
 *
 * A pause (`<pause 1 sec>`) isn't drawn at all: it is a beat in a slide's
 * build, read by splitPauses, and every place copy is drawn strips it.
 */
export declare function renderStyledText(text: string): ReactNode[];
/** Copy cut at its pauses: each run of text with the seconds the build waits
 * before it (0 for the first run, unless the copy opens on a pause). The space
 * an author leaves after a pause is dropped, so `<pause 1 sec> Title` reads as
 * `Title`. */
export declare function splitPauses(text: string): {
    wait: number;
    text: string;
}[];
/** Copy with its pauses taken out, for anywhere it is shown without a build. */
export declare const stripPauses: (text: string) => string;
