import type { WalkthroughContent } from "./types.js";
export declare function WalkthroughBuilder({ content, setContent, projectName, onClose }: {
    content: WalkthroughContent;
    setContent: (u: (prev: WalkthroughContent) => WalkthroughContent) => void;
    projectName?: string;
    /** Adds a "Done" button to the toolbar (e.g. back to a project list). */
    onClose?: () => void;
}): import("react").JSX.Element;
