import { type CSSProperties, type ReactNode } from "react";
/** A pill CTA linking to a case study: red background + white text by default,
 * black on hover. Renders an <a> when `href` is given (full navigation), else a
 * <button> (SPA navigation via `onClick`). */
export declare function CaseStudyLink({ href, onClick, children, style }: {
    href?: string;
    onClick?: () => void;
    children: ReactNode;
    style?: CSSProperties;
}): import("react").JSX.Element;
