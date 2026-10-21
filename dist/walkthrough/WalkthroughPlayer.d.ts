import type { WalkthroughContent } from "./types.js";
/** The marks a step points at, as a list. */
export declare const marksOf: (mark?: string | string[]) => string[];
export declare function WalkthroughPlayer({ content, startIndex, onExit }: {
    content: WalkthroughContent;
    startIndex?: number;
    onExit?: () => void;
}): import("react").JSX.Element;
