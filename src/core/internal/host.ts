/** The few runtime globals the core needs, typed without pulling in the DOM or Node libs. */
interface Host {
  setInterval?: (handler: () => void, milliseconds: number) => unknown;
  clearInterval?: (handle: unknown) => void;
  crypto?: { getRandomValues?: (array: Uint32Array) => Uint32Array };
}

/**
 * Reads the runtime globals lazily, at call time, so fake timers and stubs installed
 * after the module loaded are honoured.
 *
 * @returns The current global object, typed as the subset of it that the core uses.
 */
export function host(): Host {
  return globalThis as unknown as Host;
}
