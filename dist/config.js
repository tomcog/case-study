import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext } from "react";
const ConfigContext = createContext({});
export function CaseStudyProvider({ children, ...config }) {
    return _jsx(ConfigContext.Provider, { value: config, children: children });
}
export function useCaseStudyConfig() {
    return useContext(ConfigContext);
}
const noCaption = () => ({});
export function useImageCaption(src) {
    const { useImageCaption: hook = noCaption } = useCaseStudyConfig();
    return hook(src);
}
//# sourceMappingURL=config.js.map