// Case study builder + player. See README.md for wiring it into an app.
export { Player as CaseStudyPlayer } from "./Player.js";
export { Builder as CaseStudyBuilder } from "./Builder.js";
export { ProjectPreviewCard as CaseStudyCard } from "./ui/ProjectPreviewCard.js";
export { CaseStudyProvider, useCaseStudyConfig } from "./config.js";
export { Stage, ScreenView, bleedBg, backdropFor, DEFAULT_CONTENT, STAGE_W, STAGE_H } from "./core.js";
export { migrate, withAssetBase, loadProject, previewCard, projectSource, isWalkthrough, SCHEMA_VERSION } from "./project.js";
export { DEFAULT_ACCENT, DEFAULT_INK } from "./theme.js";
// Building blocks the host app may reuse in its own screens (e.g. a project index editor).
export { ImageField, Field, inputStyle, primaryBtn, ghostBtn } from "./editors.js";
export { CaseStudyThumb } from "./ui/CaseStudyThumb.js";
export { CaseStudyLink } from "./ui/CaseStudyLink.js";
export { Lightbox, LightboxTrigger } from "./ui/Lightbox.js";
export { LogoMark } from "./ui/LogoMark.js";
export { PhoneMockup } from "./ui/PhoneMockup.js";
export { ComputerFrame } from "./ui/ComputerFrame.js";
export { renderStyledText } from "./ui/renderStyledText.js";
// Walkthroughs: a side panel of stepped copy beside a live demo of the product.
export { WalkthroughPlayer } from "./walkthrough/WalkthroughPlayer.js";
export { WalkthroughBuilder } from "./walkthrough/WalkthroughBuilder.js";
export { sameOriginDriver } from "./walkthrough/driver.js";
export { DEFAULT_WALKTHROUGH } from "./walkthrough/types.js";
//# sourceMappingURL=index.js.map