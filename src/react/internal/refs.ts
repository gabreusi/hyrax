/**
 * Anything with a `current` that is either the thing or `null`: what `useRef` returns, in React 18
 * and 19. Read-only on purpose, so both `RefObject` and `MutableRefObject` fit.
 */
export interface RefLike<T> {
  readonly current: T | null;
}

/** A thing, a ref to it, or nothing yet. */
export type MaybeRef<T> = T | RefLike<T> | null | undefined;

/**
 * The thing itself: a ref is read, anything else passes through. A ref is told apart from an event
 * target by `addEventListener` and not by `current`, because a page can define a global called
 * `current`, and `window` would then look like a ref.
 */
export function resolveRef<T extends object>(value: MaybeRef<T>): T | null {
  if (value == null) return null;
  return "addEventListener" in value ? (value as T) : (value as RefLike<T>).current;
}
