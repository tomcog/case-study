import { type ReactNode } from "react";
export type ImageCaption = {
    title?: string;
    caption?: string;
};
export interface CaseStudyAssets {
    /** Store an uploaded image; resolve to the URL/path to save in the project, or null on failure. */
    upload?: (file: File) => Promise<string | null>;
    /** List the image library, as paths relative to `libraryUrl` (e.g. "folder/name.png"). */
    list?: () => Promise<string[]>;
    /** Turn a `list()` entry into the URL saved in the project. Default: `/images/${path}`. */
    libraryUrl?: (path: string) => string;
}
export interface CaseStudyConfig {
    assets?: CaseStudyAssets;
    /** Caption lookup for the full-size image viewer when a slide gives none. Called
     * as a hook, so it must be the same function on every render. */
    useImageCaption?: (src: string) => ImageCaption;
}
export declare function CaseStudyProvider({ children, ...config }: CaseStudyConfig & {
    children: ReactNode;
}): import("react").JSX.Element;
export declare function useCaseStudyConfig(): CaseStudyConfig;
export declare function useImageCaption(src: string): ImageCaption;
