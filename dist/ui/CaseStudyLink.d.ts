import { type CSSProperties, type ReactNode } from "react";
/** A pill CTA linking to a case study: red background + white text by default,
 * black on hover; `ghost` is a white 1px outline with no fill instead. Renders an <a> when `href` is given (full navigation), else a
 * <button> (SPA navigation via `onClick`). */
export declare function CaseStudyLink({ href, onClick, children, style, ghost }: {
    href?: string;
    onClick?: (e: React.MouseEvent) => void;
    children: ReactNode;
    style?: CSSProperties;
    ghost?: boolean;
}): import("react").JSX.Element;
