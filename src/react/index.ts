/**
 * Hooks and components for React 18 and 19, built on `@gabreusi/hyrax/dom`. They render on the
 * server without a `document`, and the entrypoint is marked `"use client"`.
 *
 * @module @gabreusi/hyrax/react
 */
export { hx } from "./hx";
export type { HxExtraProps, HxProps, HxShortcutKey, HxType } from "./hx";
export { Portal } from "./Portal";
export type { PortalProps } from "./Portal";
export { useClickOutside } from "./useClickOutside";
export type { ClickOutsideRefs, UseClickOutsideOptions } from "./useClickOutside";
export { useDebouncedValue } from "./useDebouncedValue";
export { useEventListener } from "./useEventListener";
export { useForceUpdate } from "./useForceUpdate";
export { useHotkey } from "./useHotkey";
export type { UseHotkeyOptions } from "./useHotkey";
export { useInterval } from "./useInterval";
export type { UseIntervalOptions, UseIntervalResult } from "./useInterval";
export { useMediaQuery } from "./useMediaQuery";
export { useScrollLock } from "./useScrollLock";
export { useSize } from "./useSize";
export type { ElementSize } from "./useSize";
export { useStorage } from "./useStorage";
export type { SetStorage } from "./useStorage";
export { useSuspend } from "./useSuspend";
export { useVisible } from "./useVisible";
export type { MaybeRef, RefLike } from "./internal/refs";
