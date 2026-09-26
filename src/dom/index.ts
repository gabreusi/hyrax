/**
 * Utilities for the browser, with no framework. Every function is safe to import and call where
 * there is no `document` (server-side rendering): it returns its fallback or does nothing.
 *
 * @module @gabreusi/hyrax/dom
 */
export { copyText } from "./copyText";
export { getCSSVar } from "./getCSSVar";
export { listen } from "./listen";
export type { ListenOptions } from "./listen";
export { observeSize, onVisible } from "./observe";
export type { OnVisibleOptions } from "./observe";
export { onClickOutside } from "./onClickOutside";
export type {
  ClickOutsideOptions,
  ClickOutsideTarget,
  ClickOutsideTargets,
} from "./onClickOutside";
export { setCSSVar } from "./setCSSVar";
export type { CSSVarTarget, CSSVarValue } from "./setCSSVar";
export { readStorage, writeStorage } from "./storage";
export { toPixels } from "./toPixels";
