/** Options for {@link StringBuilder}. */
export interface StringBuilderOptions {
  /** What goes between the parts. Defaults to a single space. */
  separator?: string;
  /** Skip a part that is already in the builder. Defaults to `false`. */
  unique?: boolean;
}

/**
 * Builds a string out of parts, with conditional branches. It is a good fit for things like
 * CSS class lists, where each part depends on some state.
 *
 * Empty parts are ignored. A part's prefix is applied once, and `unique` and `remove` work
 * on the final text (prefix included).
 *
 * Conditions chain like `if` / `else if` / `else`: every `if` starts a new chain, `elif` and
 * `else` run only while no earlier branch of the chain matched, and an `else` closes it.
 * Plain `append` and `remove` calls in the middle of a chain do not affect it.
 *
 * @example
 * ```ts
 * const classes = new StringBuilder()
 *   .append("btn")
 *   .if(isPrimary, "primary", "btn--")
 *   .elif(isDanger, "danger", "btn--")
 *   .else("default", "btn--")
 *   .build(); // => "btn btn--primary"
 * ```
 */
export class StringBuilder {
  #parts: string[] = [];
  readonly #seen = new Set<string>();
  readonly #separator: string;
  readonly #unique: boolean;
  #matched = false;

  /**
   * Creates an empty builder.
   *
   * @param options - The separator and whether parts must be unique.
   */
  constructor({ separator = " ", unique = false }: StringBuilderOptions = {}) {
    this.#separator = separator;
    this.#unique = unique;
  }

  /**
   * Adds a part. An empty `text` is ignored, and so is a repeated one when `unique` is on.
   *
   * @example
   * ```ts
   * new StringBuilder().append("world", "hello ").build(); // => "hello world"
   * ```
   *
   * @param text - The part to add.
   * @param prefix - Text put in front of `text` (default: none).
   * @returns This builder, for chaining.
   */
  append(text: string, prefix = ""): this {
    if (!text) return this;
    const part = prefix + text;
    if (this.#unique && this.#seen.has(part)) return this;
    this.#seen.add(part);
    this.#parts.push(part);
    return this;
  }

  /**
   * Removes every part equal to `text`. Compare against the final text, so a part added with a
   * prefix is removed with the prefix included.
   *
   * @example
   * ```ts
   * new StringBuilder().append("x", "a-").remove("a-x").build(); // => ""
   * ```
   *
   * @param text - The final text of the part to remove.
   * @returns This builder, for chaining.
   */
  remove(text: string): this {
    this.#parts = this.#parts.filter((part) => part !== text);
    this.#seen.delete(text);
    return this;
  }

  /**
   * Starts a new conditional chain and adds `text` when `condition` is truthy.
   *
   * @example
   * ```ts
   * new StringBuilder().if(isOpen, "open").build();
   * ```
   *
   * @param condition - Any value; truthy means the branch matches.
   * @param text - The part to add when it matches.
   * @param prefix - Text put in front of `text` (default: none).
   * @returns This builder, for chaining.
   */
  if(condition: unknown, text: string, prefix?: string): this {
    this.#matched = Boolean(condition);
    return this.#matched ? this.append(text, prefix) : this;
  }

  /**
   * Adds `text` when no earlier branch of the chain matched and `condition` is truthy.
   *
   * @example
   * ```ts
   * new StringBuilder().if(a, "a").elif(b, "b").build();
   * ```
   *
   * @param condition - Any value; truthy means the branch matches.
   * @param text - The part to add when it matches.
   * @param prefix - Text put in front of `text` (default: none).
   * @returns This builder, for chaining.
   */
  elif(condition: unknown, text: string, prefix?: string): this {
    if (this.#matched) return this;
    return this.if(condition, text, prefix);
  }

  /**
   * Adds `text` when no earlier branch of the chain matched, and closes the chain. Without a
   * preceding `if` it simply adds `text`.
   *
   * @example
   * ```ts
   * new StringBuilder().if(a, "a").else("fallback").build();
   * ```
   *
   * @param text - The part to add.
   * @param prefix - Text put in front of `text` (default: none).
   * @returns This builder, for chaining.
   */
  else(text: string, prefix?: string): this {
    if (this.#matched) return this;
    this.#matched = true;
    return this.append(text, prefix);
  }

  /**
   * Joins the parts.
   *
   * @example
   * ```ts
   * new StringBuilder().append("a").append("b").build("-"); // => "a-b"
   * ```
   *
   * @param separator - Overrides the builder's separator for this call.
   * @returns The joined string.
   */
  build(separator: string = this.#separator): string {
    return this.#parts.join(separator);
  }

  /**
   * The same as {@link StringBuilder.build}, with the builder's own separator, so a builder
   * works inside template literals.
   *
   * @example
   * ```ts
   * `${new StringBuilder().append("a").append("b")}`; // => "a b"
   * ```
   *
   * @returns The joined string.
   */
  toString(): string {
    return this.build();
  }
}
