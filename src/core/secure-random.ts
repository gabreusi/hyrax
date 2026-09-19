import { createCryptoEngine } from "./internal/engines";
import { RandomBase } from "./random-base";

const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function base64url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = ((bytes[i] as number) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += BASE64URL[(chunk >>> 18) & 63]! + BASE64URL[(chunk >>> 12) & 63]!;
    if (i + 1 < bytes.length) out += BASE64URL[(chunk >>> 6) & 63]!;
    if (i + 2 < bytes.length) out += BASE64URL[chunk & 63]!;
  }
  return out;
}

/**
 * A generator backed by `crypto.getRandomValues`, for ids, tokens and anything an attacker must not
 * be able to predict. It has the same methods as {@link Random}, but **no seed and no `state`**: it
 * cannot be replayed, by design. Create it with {@link Random.secure}.
 *
 * It has no limit on how many permutations `shuffle` can reach, and it never falls back to
 * `Math.random`: without `crypto`, creating one throws.
 *
 * @example
 * ```ts
 * const secure = Random.secure();
 * secure.token(); // e.g. "Kz0v...": 32 random bytes as base64url, for sessions and CSRF
 * secure.uuid(); // an unpredictable v4 UUID
 * ```
 */
export class SecureRandom extends RandomBase {
  /**
   * Creates a secure generator.
   *
   * @param options - `luck` bends the outcome methods, as in {@link Random}; it never touches
   *   `token`, `id`, `uuid` or `bytes`.
   * @throws {RangeError} When `luck` is not a finite number.
   * @throws {Error} When the runtime has no `crypto.getRandomValues`.
   */
  constructor(options: { luck?: number } = {}) {
    super(createCryptoEngine(), options.luck ?? 0);
  }

  /**
   * Another secure generator with the same luck. A secure generator has no seed, so there is
   * nothing to derive the child from and no keys to pass.
   *
   * @example
   * ```ts
   * const child = Random.secure({ luck: 1 }).fork();
   * ```
   *
   * @returns The new generator.
   */
  fork(): SecureRandom {
    return new SecureRandom({ luck: this.luck });
  }

  /**
   * A random string of `bytes` bytes as base64url with no padding (URL-safe), for session ids,
   * CSRF tokens and API keys. 32 bytes give 43 characters and 256 bits of entropy. Never touched by
   * luck.
   *
   * @example
   * ```ts
   * Random.secure().token(); // => "kZ3vQ...": 43 characters
   * Random.secure().token(16); // => 22 characters
   * ```
   *
   * @param bytes - How many random bytes (default `32`).
   * @returns The token.
   * @throws {RangeError} When `bytes` is not a non-negative integer.
   */
  token(bytes = 32): string {
    return base64url(this.bytes(bytes));
  }
}
