import type { Metric, OverviewItem, GalleryImage, ProjectPreview } from "./core.js";
export declare function MetricsEditor({ metrics, onChange }: {
    metrics: Metric[];
    onChange: (m: Metric[]) => void;
}): import("react").JSX.Element;
export declare function ImageField({ value, onChange, overlay, onOverlayChange, label }: {
    value: string;
    onChange: (v: string) => void;
    overlay?: boolean;
    onOverlayChange?: (v: boolean) => void;
    label?: string;
}): import("react").JSX.Element;
export declare function OverviewEditor({ items, onChange, label }: {
    items: OverviewItem[];
    onChange: (m: OverviewItem[]) => void;
    label?: string;
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
export declare const primaryBtn: React.CSSProperties;
export declare const ghostBtn: React.CSSProperties;
export declare function iconBtn(disabled: boolean): React.CSSProperties;
export declare function PreviewCardSettings({ preview, onChange, onClose, isCaseStudy, onToggleCaseStudy }: {
    preview: ProjectPreview;
    onChange: (patch: Partial<ProjectPreview>) => void;
    onClose: () => void;
    isCaseStudy?: boolean;
    onToggleCaseStudy?: () => void;
}): import("react").JSX.Element;
