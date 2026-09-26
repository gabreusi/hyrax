/**
 * `T` or `null`.
 *
 * @example
 * ```ts
 * const found: Nullable<string> = null;
 * ```
 */
export type Nullable<T> = T | null;

/**
 * `T`, `null` or `undefined`.
 *
 * @example
 * ```ts
 * const label: Maybe<string> = undefined;
 * ```
 */
export type Maybe<T> = T | null | undefined;

/**
 * A string that keeps editor autocompletion for the literals in `T` while still
 * accepting any other string.
 *
 * @example
 * ```ts
 * type Size = AnyString<"small" | "large">;
 * const a: Size = "small"; // autocompleted
 * const b: Size = "huge"; // still allowed
 * ```
 */
export type AnyString<T extends string = ""> = T | (string & Record<never, never>);

/**
 * A number, a bigint or a string holding a decimal number. This is the type
 * `isNumeric` narrows to.
 *
 * @example
 * ```ts
 * const values: Numeric[] = [1, 2n, "3.5"];
 * ```
 */
export type Numeric = number | bigint | `${number}`;

/**
 * A single `T` or a list of them, for parameters that take either. {@link toArray} turns it into
 * an array.
 *
 * @example
 * ```ts
 * function tag(names: Arrayable<string>) {}
 * tag("a");
 * tag(["a", "b"]);
 * ```
 */
export type Arrayable<T> = T | readonly T[];
