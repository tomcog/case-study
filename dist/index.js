// One project: a list of steps, each displaying a slide, an app, a URL or an
// image. See README.md for wiring it into an app.
export { ProjectPreviewCard as CaseStudyCard } from "./ui/ProjectPreviewCard.js";
export { CaseStudyProvider, useCaseStudyConfig } from "./config.js";
export { Stage, ScreenView, bleedBg, backdropFor, STAGE_W, STAGE_H } from "./core.js";
export { SlideFields, SlideView, newScreen } from "./slide.js";
export { migrate, withAssetBase, loadProject, previewCard, projectSource, SCHEMA_VERSION } from "./project.js";
export { DEFAULT_ACCENT, DEFAULT_INK } from "./theme.js";
// Building blocks the host app may reuse in its own screens (e.g. a project index editor).
export { ImageField, Field, inputStyle } from "./editors.js";
export { CaseStudyThumb } from "./ui/CaseStudyThumb.js";
export { CaseStudyLink } from "./ui/CaseStudyLink.js";
export { Lightbox, LightboxTrigger } from "./ui/Lightbox.js";
export { LogoMark } from "./ui/LogoMark.js";
export { PhoneMockup } from "./ui/PhoneMockup.js";
export { ComputerFrame } from "./ui/ComputerFrame.js";
export { renderStyledText } from "./ui/renderStyledText.js";
// The player and the builder: one of each, for every kind of step.
export { WalkthroughPlayer as ProjectPlayer } from "./walkthrough/WalkthroughPlayer.js";
export { WalkthroughBuilder as ProjectBuilder } from "./walkthrough/WalkthroughBuilder.js";
export { sameOriginDriver } from "./walkthrough/driver.js";
export { DEFAULT_WALKTHROUGH, appRuns, bootsApp, contentOf, isLive, slideOf, stepLabel, stepMarks } from "./walkthrough/types.js";
//# sourceMappingURL=index.js.map