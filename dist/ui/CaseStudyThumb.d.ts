export type ThumbFrame = "none" | "computer" | "iphone";
/** Renders a case-study thumbnail image, optionally wrapped in a device frame.
 * "none" → the bare image; "computer" → a monitor; "iphone" → the PhoneMockup
 * (its native 294px width scaled to `phoneWidth`). */
export declare function CaseStudyThumb({ src, frame, phoneWidth, fill }: {
    src?: string;
    frame?: ThumbFrame;
    phoneWidth?: number;
    fill?: boolean;
}): import("react").JSX.Element;
