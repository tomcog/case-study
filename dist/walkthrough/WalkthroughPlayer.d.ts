import type { WalkthroughContent } from "./types.js";
import type { IngestedApp } from "../project.js";
/** The marks a step points at, as a list. */
export declare const marksOf: (mark?: string | string[]) => string[];
export declare function WalkthroughPlayer({ content, apps, startIndex, onExit }: {
    content: WalkthroughContent;
    /** The pool this walkthrough's steps draw from; a step stores an app's id,
     * and where that app is served from is the host's to say. */
    apps?: IngestedApp[];
    startIndex?: number;
    onExit?: () => void;
}): import("react").JSX.Element;
