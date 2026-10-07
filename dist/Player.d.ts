import type { Screen } from "./core.js";
export declare function Player({ screens, onExit, startIndex, logoSrc }: {
    screens: Screen[];
    onExit: () => void;
    startIndex?: number;
    logoSrc?: string;
}): import("react").JSX.Element;
