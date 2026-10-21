import type { WalkthroughContent } from "./types.js";
import type { IngestedApp } from "../project.js";
export declare function WalkthroughBuilder({ content, setContent, apps, onIngestApp, onPatchApp, onDeleteApp, projectName, onClose }: {
    content: WalkthroughContent;
    setContent: (u: (prev: WalkthroughContent) => WalkthroughContent) => void;
    /** The shared pool of ingested apps a step can run. */
    apps?: IngestedApp[];
    /** Managing the pool means touching the host's filesystem, so the host does
     * it. Given these, the builder shows the Apps panel; without them it only
     * picks from what it was handed. */
    onIngestApp?: (path: string, label: string) => Promise<unknown>;
    onPatchApp?: (id: string, patch: Partial<IngestedApp>) => Promise<unknown>;
    onDeleteApp?: (id: string) => Promise<unknown>;
    projectName?: string;
    /** Adds a "Done" button to the toolbar (e.g. back to a project list). */
    onClose?: () => void;
}): import("react").JSX.Element;
