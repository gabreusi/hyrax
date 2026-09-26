/**
 * The universal entrypoint: it runs in Node, browsers, Deno and Bun, with no DOM and no React.
 *
 * @module @gabreusi/hyrax
 */
export { alias } from "./core/alias";
export { toArray } from "./core/array";
export { attempt } from "./core/attempt";
export type { Attempted } from "./core/attempt";
export { clamp, inRange, lerp, ratio, remap, snap, wrap } from "./core/number";
export { coalesce } from "./core/nullish";
export { fabricate } from "./core/fabricate";
export { isNumeric, toBoolean, toNumber } from "./core/numeric";
export { noop } from "./core/noop";
export { Random, random } from "./core/random";
export type { RandomOptions, RandomState } from "./core/random";
export type { SecureRandom } from "./core/secure-random";
export {
  splitWords,
  toCamelCase,
  toConstantCase,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
  toTitleCase,
  truncate,
} from "./core/string";
export type { TruncateOptions } from "./core/string";
export { StringBuilder } from "./core/string-builder";
export type { StringBuilderOptions } from "./core/string-builder";
export { Suspend } from "./core/suspend";
export type { SuspendCallback, SuspendOptions } from "./core/suspend";
export { traceHierarchy } from "./core/tree";
export type { AnyString, Arrayable, Maybe, Nullable, Numeric } from "./core/types";
