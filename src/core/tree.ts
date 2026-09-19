/**
 * Follows the `key` link from `node` up to the root and returns the whole chain,
 * starting with `node`. The chain ends at the first node whose link is `null` or
 * `undefined`. It is iterative, so deep hierarchies do not overflow the stack.
 *
 * @example
 * ```ts
 * const alice = { name: "Alice", manager: null };
 * const bob = { name: "Bob", manager: alice };
 * const carol = { name: "Carol", manager: bob };
 *
 * traceHierarchy(carol, "manager").map((e) => e.name); // => ["Carol", "Bob", "Alice"]
 * ```
 *
 * @param node - Where to start.
 * @param key - The property that points to the superior node.
 * @returns The chain from `node` to the root.
 * @throws {RangeError} When the hierarchy contains a cycle.
 */
export function traceHierarchy<
  K extends PropertyKey,
  N extends { [P in K]?: N | null | undefined },
>(node: N, key: K): N[] {
  const chain: N[] = [];
  const seen = new Set<N>();
  let current: N | null | undefined = node;

  while (current != null) {
    if (seen.has(current)) {
      throw new RangeError(
        `Cycle detected while tracing "${String(key)}": a node was reached twice after ${chain.length} steps.`,
      );
    }
    seen.add(current);
    chain.push(current);
    current = current[key];
  }

  return chain;
}
