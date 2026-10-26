import { type RefObject } from "react";
export declare const ASK_SUGGESTIONS: string[];
export interface AskChatProps {
    /** The project's id: the endpoint reads its document by it, and the
     * conversation is kept per project. */
    projectId: string;
    /** Ids of the project's steps, in order, so a step chip can find its step. */
    stepIds: string[];
    /** Where the reader is, sent with each question so "this" has an answer. */
    stepIndex: number;
    /** Go to a step the answer offered. */
    onStep: (index: number) => void;
    suggestions?: string[];
    inputRef?: RefObject<HTMLTextAreaElement | null>;
}
export declare function AskChat({ projectId, stepIds, stepIndex, onStep, suggestions, inputRef }: AskChatProps): import("react").JSX.Element;
