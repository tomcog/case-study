import type { Metric, OverviewItem, GalleryImage, ProjectPreview } from "./core.js";
/** A field of copy: a textarea where Return starts a new paragraph and
 * ⌘Return (Ctrl or Shift on other keyboards) breaks the line inside one,
 * keeping the tighter spacing. Paragraphs in core says how the two are stored
 * and drawn. Every copy field in the builders is one of these, so they all
 * break the same way; ids, URLs and numbers stay plain inputs. */
export declare function CopyInput(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>): import("react").JSX.Element;
export declare function MetricsEditor({ metrics, onChange }: {
    metrics: Metric[];
    onChange: (m: Metric[]) => void;
}): import("react").JSX.Element;
export declare function ImageField({ value, onChange, overlay, onOverlayChange, mono, onMonoChange, label }: {
    value: string;
    onChange: (v: string) => void;
    overlay?: boolean;
    onOverlayChange?: (v: boolean) => void;
    mono?: boolean;
    onMonoChange?: (v: boolean) => void;
    label?: string;
}): import("react").JSX.Element;
export declare function OverviewEditor({ items, onChange, label }: {
    items: OverviewItem[];
    onChange: (m: OverviewItem[]) => void;
    label?: string;
}): import("react").JSX.Element;
/** A numbered list, one input per item. The number is the item's position, so
 * it follows a move rather than the item. */
export declare function ListEditor({ items, onChange }: {
    items: string[];
    onChange: (m: string[]) => void;
}): import("react").JSX.Element;
export declare function GalleryEditor({ images, onChange }: {
    images: GalleryImage[];
    onChange: (m: GalleryImage[]) => void;
}): import("react").JSX.Element;
export declare function StatEditor({ stat, onChange }: {
    stat?: Metric;
    onChange: (m: Metric) => void;
}): import("react").JSX.Element;
export declare function Field({ label, children, collapsible }: {
    label: string;
    children: React.ReactNode;
    collapsible?: boolean;
}): import("react").JSX.Element;
export declare function ColorInput({ label, value, onChange }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}): import("react").JSX.Element;
export declare const inputStyle: React.CSSProperties;
export declare function PreviewCardSettings({ preview, onChange, onClose, isCaseStudy, onToggleCaseStudy }: {
    preview: ProjectPreview;
    onChange: (patch: Partial<ProjectPreview>) => void;
    onClose: () => void;
    isCaseStudy?: boolean;
    onToggleCaseStudy?: () => void;
}): import("react").JSX.Element;
