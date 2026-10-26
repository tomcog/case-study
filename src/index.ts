// One project: a list of steps, each displaying a slide, an app, a URL or an
// image. See README.md for wiring it into an app.

export { ProjectPreviewCard as CaseStudyCard } from "./ui/ProjectPreviewCard.js";
export { CaseStudyProvider, useCaseStudyConfig } from "./config.js";
export type { CaseStudyConfig, CaseStudyAssets, ImageCaption } from "./config.js";

export { Stage, ScreenView, bleedBg, backdropFor, STAGE_W, STAGE_H } from "./core.js";
export type { Screen, ScreenLayout, Theme, Metric, OverviewItem, GalleryImage, ProjectPreview } from "./core.js";
export { SlideFields, SlideView, newScreen } from "./slide.js";

export { migrate, withAssetBase, loadProject, previewCard, projectSource, SCHEMA_VERSION } from "./project.js";
export type { ProjectSummary, ProjectSource, ProjectContent, IngestedApp } from "./project.js";
export { DEFAULT_ACCENT, DEFAULT_INK } from "./theme.js";

// Building blocks the host app may reuse in its own screens (e.g. a project index editor).
export { ImageField, Field, CopyInput, inputStyle } from "./editors.js";
export { CaseStudyThumb } from "./ui/CaseStudyThumb.js";
export type { ThumbFrame } from "./ui/CaseStudyThumb.js";
export { CaseStudyLink } from "./ui/CaseStudyLink.js";
export { Lightbox, LightboxTrigger } from "./ui/Lightbox.js";
export { LogoMark } from "./ui/LogoMark.js";
export { PhoneMockup } from "./ui/PhoneMockup.js";
export { ComputerFrame } from "./ui/ComputerFrame.js";
export { renderStyledText, splitPauses, stripPauses } from "./ui/renderStyledText.js";
export { Paragraphs, splitParagraphs, pausedParagraphs, built, pausedContainer, PARA_GAP } from "./core.js";

// The player and the builder: one of each, for every kind of step.
export { WalkthroughPlayer as ProjectPlayer } from "./walkthrough/WalkthroughPlayer.js";
export { WalkthroughBuilder as ProjectBuilder } from "./walkthrough/WalkthroughBuilder.js";
export { sameOriginDriver } from "./walkthrough/driver.js";

// Ask AI Tom: the player mounts these itself; exported so a host can use the same pieces.
export { AskFab } from "./ask/AskFab.js";
export { AskRail } from "./ask/AskRail.js";
export { AskChat, ASK_SUGGESTIONS } from "./ask/AskChat.js";
export type { AskChatProps } from "./ask/AskChat.js";
export { AskMark } from "./ask/AskMark.js";
export { DEFAULT_WALKTHROUGH, appRuns, bootsApp, contentOf, isLive, slideOf, stepLabel, stepMarks } from "./walkthrough/types.js";
export type { Driver, MarkRect, MarkRects, PickHit } from "./walkthrough/driver.js";
export type {
  WalkthroughContent as ProjectFile,
  WalkthroughStep as Step,
  StepContent,
  StepAction,
  AppRun,
  Area,
  StepAdvance,
  Spotlight,
  Callout,
} from "./walkthrough/types.js";
