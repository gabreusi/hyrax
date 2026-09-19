type AliasFor<T, K extends keyof T, V extends readonly string[]> = {
  [P in V[number]]: T[K];
};

type UnionToIntersection<U> = (U extends object ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

/** The alias keys that `alias` adds to the type of the object. */
export type AliasProperties<
  T,
  D extends Partial<Record<keyof T, readonly string[]>>,
> = UnionToIntersection<
  {
    [K in keyof D & keyof T]: D[K] extends readonly string[] ? AliasFor<T, K, D[K]> : object;
  }[keyof D & keyof T]
>;

/**
 * Wraps an object in a proxy that answers to extra names. Reading, writing,
 * `in` and `delete` on an alias act on the original property. Aliases are
 * virtual: they do not show up in `Object.keys`. Declare the alias lists
 * `as const` so their names are inferred.
 *
 * Entries of the dictionary whose key the object does not have are ignored, and
 * so is an alias equal to its own key. An alias used for two keys, or equal to
 * another property of the object, throws.
 *
 * @example
 * ```ts
 * const person = { name: "Alice", age: 30 };
 * const aliased = alias(person, {
 *   name: ["fullName"] as const,
 *   age: ["years", "old"] as const,
 * });
 *
 * aliased.fullName; // => "Alice"
 * aliased.years = 31;
 * person.age; // => 31
 * ```
 *
 * @param obj - The object to wrap. It is not copied: writes reach it.
 * @param dictionary - Maps each key of `obj` to the alias names it answers to.
 * @returns A proxy of `obj` that also answers to the aliases.
 * @throws {Error} When an alias is mapped twice or collides with a property.
 */
export function alias<T extends object, D extends Partial<Record<keyof T, readonly string[]>>>(
  obj: T,
  dictionary: Readonly<D>,
): T & AliasProperties<T, D> {
  const inverse = new Map<string, keyof T>();

  for (const key of Object.keys(dictionary) as Array<keyof T & keyof D>) {
    if (!(key in obj)) continue;

    for (const name of dictionary[key] ?? []) {
      if (name === key) continue;

      const owner = inverse.get(name);
      if (owner !== undefined) {
        throw new Error(
          `Alias "${name}" is mapped to both "${String(owner)}" and "${String(key)}".`,
        );
      }
      if (name in obj) {
        throw new Error(`Alias "${name}" for "${String(key)}" collides with an existing property.`);
      }

      inverse.set(name, key);
    }
  }

  const resolve = (property: string | symbol): string | symbol | number =>
    (typeof property === "string" ? inverse.get(property) : undefined) ?? property;

  return new Proxy(obj, {
    get: (target, property, receiver) => Reflect.get(target, resolve(property), receiver),
    set: (target, property, value, receiver) =>
      Reflect.set(target, resolve(property), value, receiver),
    has: (target, property) => Reflect.has(target, resolve(property)),
    deleteProperty: (target, property) => Reflect.deleteProperty(target, resolve(property)),
  }) as T & AliasProperties<T, D>;
}
