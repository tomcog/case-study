import type { WalkthroughContent } from "./types.js";
import type { IngestedApp } from "../project.js";
export declare function WalkthroughBuilder({ content, setContent, apps, projectName, onClose }: {
    content: WalkthroughContent;
    setContent: (u: (prev: WalkthroughContent) => WalkthroughContent) => void;
    /** The shared pool of ingested apps a step can run. The builder only picks
     * from it: the pool is shared by every project, so ingesting, renaming,
     * resizing, hiding and deleting belong to whoever owns it, not to one
     * project's editor. Hidden apps aren't offered, but a step already running
     * one keeps running it and still says so. */
    apps?: IngestedApp[];
    projectName?: string;
    /** Adds a "Done" button to the toolbar (e.g. back to a project list). */
    onClose?: () => void;
}): import("react").JSX.Element;
