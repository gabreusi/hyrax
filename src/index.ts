/**
 * The universal entrypoint: it runs in Node, browsers, Deno and Bun, with no DOM and no React.
 *
 * @module @gabreusi/hyrax
 */
export { alias } from "./core/alias";
export { clamp, lerp, ratio, remap } from "./core/number";
export { coalesce } from "./core/nullish";
export { fabricate } from "./core/fabricate";
export { isNumeric, toNumber } from "./core/numeric";
export { noop } from "./core/noop";
export { Random, random } from "./core/random";
export type { RandomOptions, RandomState } from "./core/random";
export type { SecureRandom } from "./core/secure-random";
export { splitWords, toCamelCase, toKebabCase, toPascalCase, toSnakeCase } from "./core/string";
export { StringBuilder } from "./core/string-builder";
export type { StringBuilderOptions } from "./core/string-builder";
export { Suspend } from "./core/suspend";
export type { SuspendCallback, SuspendOptions } from "./core/suspend";
export { traceHierarchy } from "./core/tree";
export type { AnyString, Maybe, Nullable, Numeric } from "./core/types";
