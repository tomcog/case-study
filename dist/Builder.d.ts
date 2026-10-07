import type { CaseStudyContent } from "./core.js";
export declare function Builder({ content, setContent, projectName, isCaseStudy, onToggleCaseStudy, onClose }: {
    content: CaseStudyContent;
    setContent: (u: (prev: CaseStudyContent) => CaseStudyContent) => void;
    projectName?: string;
    /** Case-study flag shown in Project settings; the toggle is hidden when `onToggleCaseStudy` is omitted. */
    isCaseStudy?: boolean;
    onToggleCaseStudy?: () => void;
    /** Adds a "Done" button to the toolbar (e.g. back to a project list). */
    onClose?: () => void;
}): import("react").JSX.Element;
