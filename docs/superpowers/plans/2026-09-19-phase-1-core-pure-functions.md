# Hyrax Fase 1 (núcleo, funções puras): plano de implementação

Spec: `docs/superpowers/specs/2026-09-18-hyrax-revival-design.md` (seção 3). Fase anterior: `docs/superpowers/plans/2026-09-18-phase-0-foundation.md`.

**Objetivo.** Implementar as funções puras do entrypoint universal `@gabreusi/hyrax`: `number`, casing de `string`, `coalesce`,
`fabricate`, `isNumeric`/`toNumber`, `traceHierarchy`, `alias` e os tipos públicos. Cada uma com TSDoc completo, testes (incluindo
testes de propriedade e de tipos) e cobertura de 100%. Fecha o que a Fase 0 deixou anotado: `size-limit` e o ajuste do lint para
funções sobrecarregadas.

**Arquitetura.** Um arquivo por tema em `src/core/` (`number.ts`, `string.ts`, `nullish.ts`, `fabricate.ts`, `numeric.ts`, `tree.ts`,
`alias.ts`, `types.ts`), cada um com seu `*.test.ts` ao lado. Só `src/index.ts` os reúne, com exports nomeados explícitos. Nada aqui
toca DOM ou Node: a guarda de fronteira da Fase 0 continua valendo.

**Fora desta fase:** `Random`, `StringBuilder` e `Suspend` (Fase 2), `/dom` (Fase 3), `/react` (Fase 4), docs (Fase 5).

## Todo o plano foi validado antes de ser escrito

Implementei tudo num clone descartável e rodei `npm run check` completo (lint, formatação, typecheck, guarda de fronteira, testes com
cobertura, build, `publint`, `attw`, `size-limit`, smoke em Node ESM/CJS e Deno, com um consumidor TypeScript). Os arquivos deste plano
são os que passaram: **12 arquivos, 127 testes, cobertura 100% no `core`**, e a suíte de propriedades foi repetida 25 vezes com
sementes novas sem nenhuma falha. Os testes de cada tarefa foram escritos antes da implementação, e o RED de cada uma foi observado.

### O que a validação encontrou (já refletido nos arquivos abaixo)

| Achado | Onde | Consequência |
|---|---|---|
| **Zero com sinal.** `lerp(0, -0, 1)` dá `+0`, e `toBe` usa `Object.is`. O `fast-check` achou isso; o teste era exigente demais | `number.test.ts` | Propriedades comparam com `===`. Vale como regra do repo (CONTRIBUTING) |
| **camelCase/PascalCase não são idempotentes com palavras de uma letra** (`"A A"` → `"AA"` → relido como uma sigla `"Aa"`). É inerente ao formato, e o `_.camelCase` do lodash se comporta igual | `string.test.ts` | Idempotência só é afirmada para `snake_case` e `kebab-case`. Para camel/Pascal a propriedade é "divide de volta nas mesmas palavras" |
| **`traceHierarchy` rejeitava `parent?: Node`.** A restrição exigia a propriedade presente (herdado do código legado) | `tree.ts` | Restrição passa a `{ [P in K]?: N \| null \| undefined }`, aceitando `parent: Node \| null` e `parent?: Node` |
| `as NonNullable<...>` no `coalesce` era desnecessário (o `!= null` já estreita) | `nullish.ts` | Removido |
| **O lint só garante TSDoc na primeira assinatura de uma função sobrecarregada.** Com a 1ª documentada, a 2ª sem TSDoc passa | `eslint.config.js` | A regra agora cobre assinaturas (`TSDeclareFunction`) e dispensa a implementação. As demais overloads ficam por convenção (CONTRIBUTING) |
| O smoke test só provava `typeof noop`; um `.d.ts` quebrado passaria | `scripts/smoke.mjs` | Passa a compilar um consumidor TypeScript contra o tarball, em `nodenext` e `bundler`, com linhas `@ts-expect-error` |

### Decisões que o spec não fechava (tomadas aqui; revise se discordar)

1. **`isNumeric` rejeita espaços nas pontas** (`" 42"` é `false`; o consumidor deve fazer `trim()`). O spec só dizia "rejeita strings vazias ou só com espaço".
2. **`Numeric` inclui `bigint`** (`number | bigint | \`${number}\``), porque o spec diz que `isNumeric` aceita `bigint` e o guard precisa dizer a verdade.
3. **`lerp` usa `(1 - t) * a + t * b`**, que garante `lerp(a, b, 0) === a` e `lerp(a, b, 1) === b` exatamente.
4. **`AliasProperties` não é exportado da raiz.** O spec lista só `Nullable`, `Maybe`, `AnyString` e `Numeric` como tipos públicos, e o `.d.ts` já embute o auxiliar (o consumidor de tipos do smoke test prova isso).
5. **`AnyString` usa `string & Record<never, never>`** no lugar do `{} & string` legado, porque `{}` é proibido pela regra `no-empty-object-type`.
6. **`fabricate`: o contexto precisa ser um objeto que não seja função.** O despacho em runtime é `typeof primeiro === "function"`.
7. **`alias` ignora uma chave do dicionário que o objeto não tem no momento da criação** (herdado, coberto por teste legado). Uma propriedade opcional ausente nesse momento não recebe alias.

### Como executar

As **Tasks 3 a 9 são independentes** (cada uma cria só os próprios dois arquivos), então podem rodar em paralelo, por exemplo
em worktrees separadas. **Só a Task 10 toca `src/index.ts`.** Executadas em sequência, siga a ordem abaixo.

Todos os blocos de arquivo usam cercas de quatro crases porque o TSDoc contém blocos de três. Para sobrescrever um arquivo
existente, leia-o antes.

---

## Task 1: Branch, linha de base e lint para funções sobrecarregadas

**Files:** modificar `eslint.config.js`.

- [ ] **Step 1: Entrar na branch da fase e conferir a linha de base.** A branch `phase-1-core-pure-functions` já existe e tem este
      plano como primeiro commit (o PR da Fase 0 fez o mesmo).

```bash
cd /home/gabriel/Desktop/hyrax
git switch phase-1-core-pure-functions
npm ci
npm run check
```

Se a branch não existir (clone novo), crie-a a partir do `main` atualizado: `git switch main && git pull --ff-only origin main && git switch -c phase-1-core-pure-functions`.

Esperado: `npm run check` termina com código 0 (linha de base da Fase 0: 4 arquivos, 8 testes).

- [ ] **Step 2: Substituir `eslint.config.js`.** As duas mudanças em relação à Fase 0 estão em `jsdoc/require-jsdoc` (adiciona
      `exemptOverloadedImplementations` e o contexto `TSDeclareFunction`) e em `jsdoc/require-example` (passa a olhar assinaturas).

````js
// eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import jsdoc from "eslint-plugin-jsdoc";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist/**", "coverage/**", "docs/**", "test-fixtures/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  { files: ["**/*.{js,mjs}"], ...tseslint.configs.disableTypeChecked },
  { files: ["**/*.{js,mjs}"], languageOptions: { globals: globals.node } },
  {
    // Every exported symbol needs TSDoc with an @example (see spec section 6).
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "**/index.ts"],
    plugins: { jsdoc },
    rules: {
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          exemptOverloadedImplementations: true,
          require: { FunctionDeclaration: true, ClassDeclaration: true, MethodDefinition: true },
          contexts: ["ExportNamedDeclaration > VariableDeclaration", "TSDeclareFunction"],
        },
      ],
      "jsdoc/require-example": [
        "error",
        { contexts: ["FunctionDeclaration", "TSDeclareFunction"] },
      ],
    },
  },
  {
    files: ["src/react/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.flat.recommended.rules,
  },
  prettier,
);
````

- [ ] **Step 3: Provar o comportamento em arquivos temporários.**

```bash
cat > src/core/tmp-a.ts <<'EOF'
/** Documented but without an example. */
export function a(x: number): number;
export function a(x: number, y: number): number;
export function a(x: number, y?: number): number {
  return x + (y ?? 0);
}
EOF
cat > src/core/tmp-b.ts <<'EOF'
export function b(x: number): number {
  return x;
}
EOF
npx eslint src/core/tmp-a.ts src/core/tmp-b.ts 2>&1 | grep -E "^\s+[0-9]+:[0-9]+|✖"
rm src/core/tmp-a.ts src/core/tmp-b.ts
```

Esperado: `1:1  error  Missing JSDoc @example declaration  jsdoc/require-example` (arquivo `a`) e
`1:8  error  Missing JSDoc comment  jsdoc/require-jsdoc` (arquivo `b`). A implementação de `a` (3ª linha) **não** é acusada:
é o `exemptOverloadedImplementations`.

- [ ] **Step 4: Formatar, conferir e commitar.**

```bash
npx prettier --write eslint.config.js && npm run lint && npm run format:check
git add eslint.config.js
git commit -q -m "build: require TSDoc on overload signatures instead of implementations" \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Tipos públicos

**Files:** criar `src/core/types.test.ts` e `src/core/types.ts`.

- [ ] **Step 1: Escrever o teste primeiro.**

````ts
// src/core/types.test.ts
import { describe, expectTypeOf, it } from "vitest";
import type { AnyString, Maybe, Nullable, Numeric } from "./types";

describe("Nullable / Maybe", () => {
  it("add null (and undefined) to a type", () => {
    expectTypeOf<Nullable<string>>().toEqualTypeOf<string | null>();
    expectTypeOf<Maybe<string>>().toEqualTypeOf<string | null | undefined>();
  });
});

describe("AnyString", () => {
  it("accepts the literals and any other string", () => {
    expectTypeOf<"a">().toExtend<AnyString<"a" | "b">>();
    expectTypeOf<string>().toExtend<AnyString<"a" | "b">>();
  });

  it("does not accept non-strings", () => {
    expectTypeOf<number>().not.toExtend<AnyString<"a">>();
  });
});

describe("Numeric", () => {
  it("covers number, bigint and numeric template strings", () => {
    expectTypeOf<Numeric>().toEqualTypeOf<number | bigint | `${number}`>();
    expectTypeOf<"12.5">().toExtend<Numeric>();
    expectTypeOf<"abc">().not.toExtend<Numeric>();
  });
});
````

- [ ] **Step 2: Ver falhar (RED).** O teste só importa tipos, então o Vitest passa em runtime; quem falha é o `tsc`.

```bash
npm run typecheck 2>&1 | grep "types.test.ts" | head -3
```

Esperado: `error TS2307: Cannot find module './types' or its corresponding type declarations.`

- [ ] **Step 3: Implementar.**

````ts
// src/core/types.ts
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
````

- [ ] **Step 4: Ver passar (GREEN).**

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run --project core src/core/types.test.ts
```

Esperado: tudo sem erros, `Tests  4 passed (4)`.

- [ ] **Step 5: Commit.**

```bash
git add src/core/types.ts src/core/types.test.ts
git commit -q -m "feat: add Nullable, Maybe, AnyString and Numeric types" \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `clamp`, `lerp`, `ratio`, `remap`

**Files:** criar `src/core/number.test.ts` e `src/core/number.ts`.

- [ ] **Step 1: Escrever o teste primeiro.** Repare no `same`: as propriedades comparam com `===` porque `+0` e `-0` são o mesmo número
      aqui (achado da validação).

````ts
// src/core/number.test.ts
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { clamp, lerp, ratio, remap } from "./number";

/** `===` semantics: +0 and -0 are the same number for these functions. */
const same = (x: number, y: number) => x === y;

describe("clamp", () => {
  it("returns the value when it is inside the bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("returns the nearest bound when the value is outside", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("compares numbers, not strings", () => {
    // The legacy implementation sorted the bounds as strings ("100" < "5").
    expect(clamp(50, 5, 100)).toBe(50);
    expect(clamp(500, 5, 100)).toBe(100);
    expect(clamp(1, 5, 100)).toBe(5);
  });

  it("swaps the bounds when min is greater than max", () => {
    expect(clamp(5, 10, 0)).toBe(5);
    expect(clamp(50, 100, 5)).toBe(50);
    expect(clamp(-3, 10, 0)).toBe(0);
  });

  it("caps at max when only two arguments are given", () => {
    expect(clamp(5, 10)).toBe(5);
    expect(clamp(15, 10)).toBe(10);
    expect(clamp(-1e9, 10)).toBe(-1e9);
  });

  it("supports infinite bounds", () => {
    expect(clamp(5, -Infinity, Infinity)).toBe(5);
    expect(clamp(Infinity, 0, 10)).toBe(10);
  });

  it("propagates NaN", () => {
    expect(clamp(NaN, 0, 10)).toBeNaN();
  });

  it("keeps the result inside the (ordered) bounds and is idempotent", () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true }),
        fc.double({ noNaN: true }),
        fc.double({ noNaN: true }),
        (value, a, b) => {
          const result = clamp(value, a, b);
          expect(result).toBeGreaterThanOrEqual(Math.min(a, b));
          expect(result).toBeLessThanOrEqual(Math.max(a, b));
          expect(same(clamp(result, a, b), result)).toBe(true);
        },
      ),
    );
  });

  it("accepts both the 3-argument and the 2-argument form", () => {
    expectTypeOf(clamp(1, 2, 3)).toEqualTypeOf<number>();
    expectTypeOf(clamp(1, 2)).toEqualTypeOf<number>();
  });
});

describe("lerp", () => {
  it("interpolates between two numbers", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });

  it("extrapolates outside 0..1 (no clamp)", () => {
    expect(lerp(0, 10, 2)).toBe(20);
    expect(lerp(0, 10, -1)).toBe(-10);
  });

  it("is exact at the endpoints", () => {
    const finite = fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e9, max: 1e9 });
    fc.assert(
      fc.property(finite, finite, (a, b) => {
        expect(same(lerp(a, b, 0), a)).toBe(true);
        expect(same(lerp(a, b, 1), b)).toBe(true);
      }),
    );
  });
});

describe("ratio", () => {
  it("defaults to the range 0..100", () => {
    expect(ratio(50)).toBe(0.5);
    expect(ratio(0)).toBe(0);
    expect(ratio(100)).toBe(1);
  });

  it("takes the upper bound as second argument", () => {
    expect(ratio(30, 60)).toBe(0.5);
  });

  it("takes the lower bound as third argument", () => {
    expect(ratio(75, 100, 50)).toBe(0.5);
  });

  it("does not clamp", () => {
    expect(ratio(150)).toBe(1.5);
    expect(ratio(-50)).toBe(-0.5);
  });

  it("returns 0 for an empty range", () => {
    expect(ratio(5, 10, 10)).toBe(0);
  });

  it("is usable as a multiplier that preserves proportions", () => {
    const scale = ratio(30, 60);
    expect(200 * scale).toBe(100);
  });
});

describe("remap", () => {
  it("maps a value from one range to another", () => {
    expect(remap(5, [0, 10], [0, 100])).toBe(50);
    expect(remap(0.5, [0, 1], [10, 20])).toBe(15);
  });

  it("supports reversed ranges", () => {
    expect(remap(5, [10, 0], [0, 100])).toBe(50);
    expect(remap(0, [0, 10], [100, 0])).toBe(100);
  });

  it("extrapolates outside the input range", () => {
    expect(remap(20, [0, 10], [0, 100])).toBe(200);
  });

  it("returns the start of the output range when the input range is empty", () => {
    expect(remap(3, [2, 2], [7, 100])).toBe(7);
  });

  it("maps the ends of the input range to the ends of the output range", () => {
    const finite = fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 });
    fc.assert(
      fc.property(finite, finite, finite, finite, (a, b, c, d) => {
        fc.pre(a !== b);
        expect(same(remap(a, [a, b], [c, d]), c)).toBe(true);
        expect(same(remap(b, [a, b], [c, d]), d)).toBe(true);
      }),
    );
  });
});
````

- [ ] **Step 2: Ver falhar (RED).**

```bash
npx vitest run --project core src/core/number.test.ts 2>&1 | grep -E "Cannot find|Test Files"
```

Esperado: `Error: Cannot find module './number'` e `Test Files  1 failed (1)`.

- [ ] **Step 3: Implementar.**

````ts
// src/core/number.ts
/**
 * Restricts `value` to the range `[min, max]`. When `min` is greater than `max`
 * the bounds are swapped. `NaN` is returned as is.
 *
 * @example
 * ```ts
 * clamp(5, 0, 10); // => 5
 * clamp(-1, 0, 10); // => 0
 * clamp(11, 0, 10); // => 10
 * clamp(5, 10, 0); // => 5
 * ```
 *
 * @param value - The number to restrict.
 * @param min - One bound of the range.
 * @param max - The other bound of the range.
 * @returns `value` limited to the range.
 */
export function clamp(value: number, min: number, max: number): number;
/**
 * Caps `value` at `max`, with no lower bound.
 *
 * @example
 * ```ts
 * clamp(5, 10); // => 5
 * clamp(15, 10); // => 10
 * ```
 *
 * @param value - The number to cap.
 * @param max - The upper bound.
 * @returns `value`, or `max` when `value` is greater.
 */
export function clamp(value: number, max: number): number;
export function clamp(value: number, a: number, b?: number): number {
  const [lower, upper]: [number, number] =
    b === undefined ? [-Infinity, a] : a <= b ? [a, b] : [b, a];
  return Math.min(Math.max(value, lower), upper);
}

/**
 * Linear interpolation between `a` and `b`. Returns exactly `a` for `t = 0` and
 * exactly `b` for `t = 1`. Values of `t` outside `0..1` extrapolate.
 *
 * @example
 * ```ts
 * lerp(0, 10, 0.5); // => 5
 * lerp(10, 20, 0.25); // => 12.5
 * lerp(0, 10, 2); // => 20
 * ```
 *
 * @param a - The value at `t = 0`.
 * @param b - The value at `t = 1`.
 * @param t - The interpolation factor.
 * @returns The interpolated value.
 */
export function lerp(a: number, b: number, t: number): number {
  return (1 - t) * a + t * b;
}

/**
 * Where `value` sits inside the range `[min, max]`, as a fraction: `0` at `min`,
 * `1` at `max`. It is meant to be multiplied by other values to keep
 * proportions. It does not clamp, so the result can be negative or above `1`.
 * An empty range (`max === min`) gives `0`.
 *
 * @example
 * ```ts
 * ratio(50); // => 0.5
 * ratio(30, 60); // => 0.5
 * ratio(75, 100, 50); // => 0.5
 * ```
 *
 * @param value - The value to locate.
 * @param max - The upper end of the range.
 * @param min - The lower end of the range.
 * @returns The fraction of the range that `value` represents.
 */
export function ratio(value: number, max = 100, min = 0): number {
  const range = max - min;
  return range === 0 ? 0 : (value - min) / range;
}

/**
 * Maps `value` from one range to another. The ranges may be reversed and the
 * result is not clamped. When the input range is empty the start of the output
 * range is returned.
 *
 * @example
 * ```ts
 * remap(5, [0, 10], [0, 100]); // => 50
 * remap(0.5, [0, 1], [10, 20]); // => 15
 * remap(5, [10, 0], [0, 100]); // => 50
 * ```
 *
 * @param value - The value to map.
 * @param input - The `[min, max]` range `value` belongs to.
 * @param output - The `[min, max]` range to map into.
 * @returns The mapped value.
 */
export function remap(
  value: number,
  [inMin, inMax]: readonly [number, number],
  [outMin, outMax]: readonly [number, number],
): number {
  return lerp(outMin, outMax, ratio(value, inMax, inMin));
}
````

- [ ] **Step 4: Ver passar (GREEN).**

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run --project core src/core/number.test.ts
```

Esperado: `Tests  23 passed (23)`.

- [ ] **Step 5: Commit.**

```bash
git add src/core/number.ts src/core/number.test.ts
git commit -q -m "feat: add clamp, lerp, ratio and remap" \
  -m "clamp compares numbers (the legacy version sorted bounds as strings), map becomes remap, percent becomes ratio." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Casing de strings

**Files:** criar `src/core/string.test.ts` e `src/core/string.ts`.

- [ ] **Step 1: Escrever o teste primeiro.** A seção de propriedades usa a formulação corrigida (idempotência só para
      snake/kebab; camel/Pascal "dividem de volta nas mesmas palavras").

````ts
// src/core/string.test.ts
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { splitWords, toCamelCase, toKebabCase, toPascalCase, toSnakeCase } from "./string";

describe("splitWords", () => {
  it("splits on anything that is not a letter, mark or digit", () => {
    expect(splitWords("hello world")).toEqual(["hello", "world"]);
    expect(splitWords("foo_bar-baz.qux")).toEqual(["foo", "bar", "baz", "qux"]);
    expect(splitWords("  padded   ")).toEqual(["padded"]);
  });

  it("splits at lower-to-upper case boundaries", () => {
    expect(splitWords("fooBar")).toEqual(["foo", "Bar"]);
    expect(splitWords("fooBarBaz")).toEqual(["foo", "Bar", "Baz"]);
  });

  it("keeps acronyms together and splits them from the next word", () => {
    expect(splitWords("XMLHttpRequest")).toEqual(["XML", "Http", "Request"]);
    expect(splitWords("parseHTMLString")).toEqual(["parse", "HTML", "String"]);
    expect(splitWords("Convert THIS text")).toEqual(["Convert", "THIS", "text"]);
  });

  it("keeps digits attached to the letters around them", () => {
    expect(splitWords("foo2bar")).toEqual(["foo2bar"]);
    expect(splitWords("version2")).toEqual(["version2"]);
    expect(splitWords("foo2Bar")).toEqual(["foo2", "Bar"]);
    expect(splitWords("HTML5Parser")).toEqual(["HTML5", "Parser"]);
  });

  it("handles Unicode letters and combining marks", () => {
    expect(splitWords("naïve café")).toEqual(["naïve", "café"]);
    expect(splitWords("café au lait")).toEqual(["café", "au", "lait"]);
    expect(splitWords("ÁrvoreGrande")).toEqual(["Árvore", "Grande"]);
  });

  it("returns an empty list when there are no words", () => {
    expect(splitWords("")).toEqual([]);
    expect(splitWords(" _-. ")).toEqual([]);
  });
});

describe("toCamelCase", () => {
  it("converts words to camelCase", () => {
    expect(toCamelCase("hello world")).toBe("helloWorld");
    expect(toCamelCase("Convert THIS text")).toBe("convertThisText");
    expect(toCamelCase("MAX_VALUE")).toBe("maxValue");
    expect(toCamelCase("XMLHttpRequest")).toBe("xmlHttpRequest");
  });

  it("preserves digits (the legacy implementation dropped them)", () => {
    expect(toCamelCase("foo2bar")).toBe("foo2bar");
    expect(toCamelCase("foo 2 bar")).toBe("foo2Bar");
    expect(toCamelCase("version 2")).toBe("version2");
  });

  it("handles Unicode", () => {
    expect(toCamelCase("ÁRVORE genial")).toBe("árvoreGenial");
    expect(toCamelCase("naïve café")).toBe("naïveCafé");
  });

  it("returns an empty string when there are no words", () => {
    expect(toCamelCase("")).toBe("");
    expect(toCamelCase("___")).toBe("");
  });
});

describe("toPascalCase", () => {
  it("converts words to PascalCase", () => {
    expect(toPascalCase("hello world")).toBe("HelloWorld");
    expect(toPascalCase("foo_bar")).toBe("FooBar");
    expect(toPascalCase("HTML5Parser")).toBe("Html5Parser");
  });
});

describe("toSnakeCase", () => {
  it("converts words to snake_case", () => {
    expect(toSnakeCase("helloWorld")).toBe("hello_world");
    expect(toSnakeCase("XMLHttpRequest")).toBe("xml_http_request");
    expect(toSnakeCase("foo2bar")).toBe("foo2bar");
    expect(toSnakeCase("foo2Bar")).toBe("foo2_bar");
  });
});

describe("toKebabCase", () => {
  it("converts words to kebab-case", () => {
    expect(toKebabCase("helloWorld")).toBe("hello-world");
    expect(toKebabCase("HTML5Parser")).toBe("html5-parser");
    expect(toKebabCase("Some Title Here")).toBe("some-title-here");
  });
});

describe("case conversions (properties)", () => {
  const anything = fc.stringMatching(/^[A-Za-z0-9 _.-]*$/);
  // Words of two or more characters that start with a letter: single-letter words
  // are ambiguous in camelCase ("a b" -> "aB"), and a digit-led word cannot be
  // told apart from the previous one ("foo 2go" -> "foo2go").
  const wordList = fc.array(fc.stringMatching(/^[a-z][a-z0-9]{1,5}$/), {
    minLength: 1,
    maxLength: 6,
  });

  it("snake_case and kebab-case are idempotent", () => {
    fc.assert(
      fc.property(anything, (input) => {
        for (const convert of [toSnakeCase, toKebabCase]) {
          const once = convert(input);
          expect(convert(once)).toBe(once);
        }
      }),
    );
  });

  it("camelCase and PascalCase split back into the original words", () => {
    fc.assert(
      fc.property(wordList, (words) => {
        const input = words.join(" ");
        for (const convert of [toCamelCase, toPascalCase]) {
          const back = splitWords(convert(input)).map((word) => word.toLowerCase());
          expect(back).toEqual(words);
        }
      }),
    );
  });

  it("snake_case and kebab-case agree on the underlying words", () => {
    fc.assert(
      fc.property(anything, (input) => {
        expect(toSnakeCase(input).split("_").join("-")).toBe(toKebabCase(input));
      }),
    );
  });
});
````

- [ ] **Step 2: Ver falhar (RED).**

```bash
npx vitest run --project core src/core/string.test.ts 2>&1 | grep -E "Cannot find|Test Files"
```

Esperado: `Error: Cannot find module './string'`.

- [ ] **Step 3: Implementar.**

````ts
// src/core/string.ts
/**
 * Splits a string into words. Word boundaries are any character that is not a
 * letter, combining mark or digit, plus the transitions between cases
 * (`fooBar`, `XMLHttp`). Digits stay attached to the letters around them, so
 * `foo2bar` is a single word.
 *
 * @example
 * ```ts
 * splitWords("fooBar_baz-2go"); // => ["foo", "Bar", "baz", "2go"]
 * splitWords("XMLHttpRequest"); // => ["XML", "Http", "Request"]
 * splitWords("foo2bar"); // => ["foo2bar"]
 * ```
 *
 * @param input - The string to split.
 * @returns The words, in their original casing.
 */
export function splitWords(input: string): string[] {
  return input
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1 $2")
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean);
}

function capitalize(word: string): string {
  const [first = "", ...rest] = word;
  return first.toUpperCase() + rest.join("").toLowerCase();
}

/**
 * Converts a string to `camelCase`.
 *
 * @example
 * ```ts
 * toCamelCase("hello world"); // => "helloWorld"
 * toCamelCase("MAX_VALUE"); // => "maxValue"
 * toCamelCase("foo2bar"); // => "foo2bar"
 * ```
 *
 * @param input - The string to convert.
 * @returns The `camelCase` string.
 */
export function toCamelCase(input: string): string {
  return splitWords(input)
    .map((word, index) => (index === 0 ? word.toLowerCase() : capitalize(word)))
    .join("");
}

/**
 * Converts a string to `PascalCase`.
 *
 * @example
 * ```ts
 * toPascalCase("hello world"); // => "HelloWorld"
 * toPascalCase("foo_bar"); // => "FooBar"
 * ```
 *
 * @param input - The string to convert.
 * @returns The `PascalCase` string.
 */
export function toPascalCase(input: string): string {
  return splitWords(input).map(capitalize).join("");
}

/**
 * Converts a string to `snake_case`.
 *
 * @example
 * ```ts
 * toSnakeCase("helloWorld"); // => "hello_world"
 * toSnakeCase("XMLHttpRequest"); // => "xml_http_request"
 * ```
 *
 * @param input - The string to convert.
 * @returns The `snake_case` string.
 */
export function toSnakeCase(input: string): string {
  return splitWords(input)
    .map((word) => word.toLowerCase())
    .join("_");
}

/**
 * Converts a string to `kebab-case`.
 *
 * @example
 * ```ts
 * toKebabCase("helloWorld"); // => "hello-world"
 * toKebabCase("HTML5Parser"); // => "html5-parser"
 * ```
 *
 * @param input - The string to convert.
 * @returns The `kebab-case` string.
 */
export function toKebabCase(input: string): string {
  return splitWords(input)
    .map((word) => word.toLowerCase())
    .join("-");
}
````

- [ ] **Step 4: Ver passar (GREEN).**

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run --project core src/core/string.test.ts
```

Esperado: `Tests  16 passed (16)`.

- [ ] **Step 5: Commit.**

```bash
git add src/core/string.ts src/core/string.test.ts
git commit -q -m "feat: add splitWords and camel/pascal/snake/kebab case conversions" \
  -m "Digits are preserved (the legacy toCamelCase dropped them) and acronyms are handled." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `coalesce`

**Files:** criar `src/core/nullish.test.ts` e `src/core/nullish.ts`.

- [ ] **Step 1: Escrever o teste primeiro.**

````ts
// src/core/nullish.test.ts
import { describe, expect, expectTypeOf, it } from "vitest";
import { coalesce } from "./nullish";

describe("coalesce", () => {
  it("returns the first value that is not null or undefined", () => {
    expect(coalesce(null, undefined, "a", "b")).toBe("a");
  });

  it("treats falsy values as valid", () => {
    expect(coalesce(null, 0, 1)).toBe(0);
    expect(coalesce(undefined, "", "x")).toBe("");
    expect(coalesce(null, false, true)).toBe(false);
    expect(coalesce(undefined, NaN, 1)).toBeNaN();
  });

  it("returns null when every value is null or undefined", () => {
    expect(coalesce(null, undefined)).toBeNull();
    expect(coalesce()).toBeNull();
  });

  it("removes null and undefined from the return type, adding back null", () => {
    const value = coalesce(null as string | null, undefined as number | undefined);
    expectTypeOf(value).toEqualTypeOf<string | number | null>();
  });
});
````

- [ ] **Step 2: Ver falhar (RED).**

```bash
npx vitest run --project core src/core/nullish.test.ts 2>&1 | grep -E "Cannot find|Test Files"
```

Esperado: `Error: Cannot find module './nullish'`.

- [ ] **Step 3: Implementar.** Sem `as`: o `!= null` já estreita o tipo.

````ts
// src/core/nullish.ts
/**
 * Returns the first value that is neither `null` nor `undefined`, or `null` when
 * there is none. Falsy values such as `0`, `""` and `false` count as valid.
 *
 * @example
 * ```ts
 * coalesce(null, undefined, 0, "x"); // => 0
 * coalesce(null, undefined, "x"); // => "x"
 * coalesce(null, undefined); // => null
 * ```
 *
 * @param values - The candidates, in order of priority.
 * @returns The first non-nullish value, or `null`.
 */
export function coalesce<T extends readonly unknown[]>(
  ...values: T
): NonNullable<T[number]> | null {
  for (const value of values) {
    if (value != null) return value;
  }
  return null;
}
````

- [ ] **Step 4: Ver passar (GREEN).**

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run --project core src/core/nullish.test.ts
```

Esperado: `Tests  4 passed (4)`.

- [ ] **Step 5: Commit.**

```bash
git add src/core/nullish.ts src/core/nullish.test.ts
git commit -q -m "feat: add coalesce (replaces nvl)" \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `fabricate`

**Files:** criar `src/core/fabricate.test.ts` e `src/core/fabricate.ts`.

- [ ] **Step 1: Escrever o teste primeiro.** Repare que o TypeScript alarga o retorno `"yes" | "no"` para `string` numa função inferida, e o
      teste de tipos já afirma `string`.

````ts
// src/core/fabricate.test.ts
import { describe, expect, expectTypeOf, it } from "vitest";
import { fabricate } from "./fabricate";

describe("fabricate", () => {
  it("runs a callback with no parameters", () => {
    expect(fabricate(() => 42)).toBe(42);
  });

  it("runs a callback with parameters", () => {
    const sum = (a: number, b: number) => a + b;
    expect(fabricate(sum, [3, 4])).toBe(7);
  });

  it("runs a callback with a context as `this`", () => {
    const context = { multiplier: 2 };
    const result = fabricate(context, function (this: typeof context) {
      return this.multiplier * 5;
    });
    expect(result).toBe(10);
  });

  it("runs a callback with a context and parameters", () => {
    const context = { multiplier: 3 };
    const result = fabricate(
      context,
      function (this: typeof context, a: number, b: number) {
        return (a + b) * this.multiplier;
      },
      [4, 5],
    );
    expect(result).toBe(27);
  });

  it("initialises a const with early returns, without `let`", () => {
    const describeAge = (age: number) =>
      fabricate(() => {
        if (age < 13) return "child";
        if (age < 20) return "teen";
        return "adult";
      });
    expect(describeAge(8)).toBe("child");
    expect(describeAge(15)).toBe("teen");
    expect(describeAge(40)).toBe("adult");
  });

  it("returns the promise of an async callback untouched", async () => {
    const result = fabricate(async () => {
      await Promise.resolve();
      return 1;
    });
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBe(1);
  });

  it("propagates errors thrown by the callback", () => {
    expect(() =>
      fabricate(() => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
  });

  it("infers the return type in every form", () => {
    expectTypeOf(fabricate(() => 1)).toEqualTypeOf<number>();
    expectTypeOf(fabricate((a: string) => a.length, ["x"])).toEqualTypeOf<number>();
    expectTypeOf(
      fabricate({ n: 1 }, function (this: { n: number }) {
        return this.n > 0 ? "yes" : "no";
      }),
    ).toEqualTypeOf<string>();
  });
});
````

- [ ] **Step 2: Ver falhar (RED).**

```bash
npx vitest run --project core src/core/fabricate.test.ts 2>&1 | grep -E "Cannot find|Test Files"
```

Esperado: `Error: Cannot find module './fabricate'`.

- [ ] **Step 3: Implementar.** Quatro overloads, cada uma com TSDoc e `@example` (o editor mostra a doc da assinatura que o chamador
      usou).

````ts
// src/core/fabricate.ts
/**
 * Runs a callback and returns its result. It is a block expression: it lets you
 * initialise a `const` with early returns instead of declaring a `let`.
 *
 * @example
 * ```ts
 * const size = fabricate(() => {
 *   if (width < 600) return "small";
 *   if (width < 1200) return "medium";
 *   return "large";
 * });
 * ```
 *
 * @param callback - The function to run.
 * @returns Whatever `callback` returns (a promise is returned as is).
 */
export function fabricate<T>(callback: () => T): T;
/**
 * Runs a callback with the given parameters.
 *
 * @example
 * ```ts
 * const sum = (a: number, b: number) => a + b;
 * fabricate(sum, [3, 4]); // => 7
 * ```
 *
 * @param callback - The function to run.
 * @param params - The arguments passed to `callback`.
 * @returns Whatever `callback` returns.
 */
export function fabricate<T, P extends unknown[]>(callback: (...params: P) => T, params: P): T;
/**
 * Runs a callback with `context` as `this`. The context must be a non-function
 * object.
 *
 * @example
 * ```ts
 * const context = { multiplier: 2 };
 * fabricate(context, function (this: typeof context) {
 *   return this.multiplier * 5;
 * }); // => 10
 * ```
 *
 * @param context - The object bound as `this`.
 * @param callback - The function to run.
 * @returns Whatever `callback` returns.
 */
export function fabricate<T, C extends object>(context: C, callback: (this: C) => T): T;
/**
 * Runs a callback with `context` as `this` and the given parameters.
 *
 * @example
 * ```ts
 * const context = { multiplier: 3 };
 * fabricate(
 *   context,
 *   function (this: typeof context, a: number, b: number) {
 *     return (a + b) * this.multiplier;
 *   },
 *   [4, 5],
 * ); // => 27
 * ```
 *
 * @param context - The object bound as `this`.
 * @param callback - The function to run.
 * @param params - The arguments passed to `callback`.
 * @returns Whatever `callback` returns.
 */
export function fabricate<T, C extends object, P extends unknown[]>(
  context: C,
  callback: (this: C, ...params: P) => T,
  params: P,
): T;
export function fabricate(first: unknown, second?: unknown, third?: unknown): unknown {
  if (typeof first === "function") {
    const params = (second ?? []) as unknown[];
    return (first as (...params: unknown[]) => unknown)(...params);
  }
  const params = (third ?? []) as unknown[];
  return (second as (this: unknown, ...params: unknown[]) => unknown).call(first, ...params);
}
````

- [ ] **Step 4: Ver passar (GREEN).**

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run --project core src/core/fabricate.test.ts
```

Esperado: `Tests  8 passed (8)`.

- [ ] **Step 5: Commit.**

```bash
git add src/core/fabricate.ts src/core/fabricate.test.ts
git commit -q -m "feat: add fabricate with four documented overloads" \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: `isNumeric` e `toNumber`

**Files:** criar `src/core/numeric.test.ts` e `src/core/numeric.ts`.

- [ ] **Step 1: Escrever o teste primeiro.** Os casos `it.each` usam `%s` no nome, porque `%j` não serializa `bigint`.

````ts
// src/core/numeric.test.ts
import { describe, expect, expectTypeOf, it } from "vitest";
import { isNumeric, toNumber } from "./numeric";
import type { Numeric } from "./types";

describe("isNumeric", () => {
  it.each([42, 0, -1.5, 1e3, 12n, "42", "-1.5", "+7", "1e3", ".5", "5.", "0", "007"])(
    "accepts %s",
    (value) => {
      expect(isNumeric(value)).toBe(true);
    },
  );

  it.each([
    NaN,
    Infinity,
    -Infinity,
    "",
    " ",
    " 42",
    "42 ",
    "0x10",
    "Infinity",
    "NaN",
    "1e999",
    "1_000",
    "1,5",
    "12px",
    "abc",
    null,
    undefined,
    {},
    [],
    true,
    Symbol("s"),
  ])("rejects %s", (value) => {
    expect(isNumeric(value)).toBe(false);
  });

  it("narrows to Numeric", () => {
    const value = "12" as unknown;
    if (isNumeric(value)) expectTypeOf(value).toEqualTypeOf<Numeric>();
  });
});

describe("toNumber", () => {
  it("converts numeric values", () => {
    expect(toNumber("42")).toBe(42);
    expect(toNumber(7n)).toBe(7);
    expect(toNumber(3.5)).toBe(3.5);
    expect(toNumber("1e3")).toBe(1000);
  });

  it("falls back to 0 for anything else", () => {
    expect(toNumber("abc")).toBe(0);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber(NaN)).toBe(0);
    expect(toNumber(Infinity)).toBe(0);
  });

  it("falls back when a bigint is too large for a finite number", () => {
    expect(toNumber(10n ** 400n)).toBe(0);
  });

  it("accepts a custom fallback", () => {
    expect(toNumber("abc", -1)).toBe(-1);
    expect(toNumber(null, NaN)).toBeNaN();
  });
});
````

- [ ] **Step 2: Ver falhar (RED).**

```bash
npx vitest run --project core src/core/numeric.test.ts 2>&1 | grep -E "Cannot find|Test Files"
```

Esperado: `Error: Cannot find module './numeric'`.

- [ ] **Step 3: Implementar.**

````ts
// src/core/numeric.ts
import type { Numeric } from "./types";

const DECIMAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/**
 * Checks whether a value is a finite number, a bigint or a string holding a
 * decimal number. Strings must not have surrounding whitespace (trim first),
 * and hexadecimal, `Infinity` and `NaN` are rejected.
 *
 * @example
 * ```ts
 * isNumeric(42); // => true
 * isNumeric("-1.5e3"); // => true
 * isNumeric("0x10"); // => false
 * isNumeric(" 42"); // => false
 * isNumeric(Infinity); // => false
 * ```
 *
 * @param value - The value to check.
 * @returns `true` when the value is numeric.
 */
export function isNumeric(value: unknown): value is Numeric {
  switch (typeof value) {
    case "number":
      return Number.isFinite(value);
    case "bigint":
      return true;
    case "string":
      return DECIMAL.test(value) && Number.isFinite(Number(value));
    default:
      return false;
  }
}

/**
 * Converts a numeric value to a number, or returns `fallback` when the value is
 * not numeric or does not fit a finite number.
 *
 * @example
 * ```ts
 * toNumber("42"); // => 42
 * toNumber(7n); // => 7
 * toNumber("abc"); // => 0
 * toNumber("abc", -1); // => -1
 * ```
 *
 * @param value - The value to convert.
 * @param fallback - What to return when `value` cannot be converted.
 * @returns The number, or `fallback`.
 */
export function toNumber(value: unknown, fallback = 0): number {
  if (!isNumeric(value)) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
````

- [ ] **Step 4: Ver passar (GREEN).**

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run --project core src/core/numeric.test.ts
```

Esperado: `Tests  39 passed (39)`.

- [ ] **Step 5: Commit.**

```bash
git add src/core/numeric.ts src/core/numeric.test.ts
git commit -q -m "feat: add isNumeric and a pure toNumber" \
  -m "isNumeric rejects Infinity, hex and padded strings. The CSS-unit half of the old toNumber moves to /dom in a later phase." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `traceHierarchy`

**Files:** criar `src/core/tree.test.ts` e `src/core/tree.ts`.

- [ ] **Step 1: Escrever o teste primeiro.** Os nós são `interface`s recursivas: a assinatura exige uma cadeia homogênea (o pai tem o
      mesmo tipo do filho), e o teste "stops at undefined" cobre a propriedade opcional `parent?: Node`.

````ts
// src/core/tree.test.ts
import { describe, expect, expectTypeOf, it } from "vitest";
import { traceHierarchy } from "./tree";

interface Employee {
  name: string;
  manager: Employee | null;
}

const alice: Employee = { name: "Alice", manager: null };
const bob: Employee = { name: "Bob", manager: alice };
const carol: Employee = { name: "Carol", manager: bob };

describe("traceHierarchy", () => {
  it("returns the node followed by each superior up to the root", () => {
    expect(traceHierarchy(carol, "manager")).toEqual([carol, bob, alice]);
  });

  it("returns only the node when it has no superior", () => {
    expect(traceHierarchy(alice, "manager")).toEqual([alice]);
  });

  it("stops at undefined as well as null", () => {
    interface Node {
      parent?: Node;
    }
    const orphan: Node = {};
    const child: Node = { parent: orphan };
    expect(traceHierarchy(child, "parent")).toEqual([child, orphan]);
  });

  it("works with any property key", () => {
    interface Up {
      up: Up | null;
    }
    const root: Up = { up: null };
    const leaf: Up = { up: root };
    expect(traceHierarchy(leaf, "up")).toEqual([leaf, root]);
  });

  it("does not overflow the stack on very deep hierarchies", () => {
    interface Link {
      parent: Link | null;
    }
    let node: Link = { parent: null };
    for (let i = 0; i < 100_000; i++) node = { parent: node };
    expect(traceHierarchy(node, "parent")).toHaveLength(100_001);
  });

  it("throws a RangeError when the hierarchy has a cycle", () => {
    interface Link {
      next: Link | null;
    }
    const a: Link = { next: null };
    const b: Link = { next: a };
    a.next = b;
    expect(() => traceHierarchy(a, "next")).toThrow(RangeError);
    expect(() => traceHierarchy(a, "next")).toThrow(/cycle/i);
  });

  it("throws when a node points to itself", () => {
    interface Link {
      next: Link | null;
    }
    const self: Link = { next: null };
    self.next = self;
    expect(() => traceHierarchy(self, "next")).toThrow(RangeError);
  });

  it("returns an array of the node type", () => {
    expectTypeOf(traceHierarchy(carol, "manager")).toEqualTypeOf<Employee[]>();
  });
});
````

- [ ] **Step 2: Ver falhar (RED).**

```bash
npx vitest run --project core src/core/tree.test.ts 2>&1 | grep -E "Cannot find|Test Files"
```

Esperado: `Error: Cannot find module './tree'`.

- [ ] **Step 3: Implementar.**

````ts
// src/core/tree.ts
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
````

- [ ] **Step 4: Ver passar (GREEN).**

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run --project core src/core/tree.test.ts
```

Esperado: `Tests  8 passed (8)`. O teste de 100 mil níveis roda sem estourar a pilha (a versão legada era recursiva).

- [ ] **Step 5: Commit.**

```bash
git add src/core/tree.ts src/core/tree.test.ts
git commit -q -m "feat: add an iterative traceHierarchy that throws on cycles" \
  -m "Accepts both parent: Node | null and parent?: Node. A cycle raises RangeError." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: `alias`

**Files:** criar `src/core/alias.test.ts` e `src/core/alias.ts`.

- [ ] **Step 1: Escrever o teste primeiro.** Inclui a regressão do bug legado (`aliased.toString` devolvia `undefined`).

````ts
// src/core/alias.test.ts
import { beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import { alias } from "./alias";

describe("alias", () => {
  interface Person {
    name: string;
    age: number;
    city?: string;
  }

  const model: Person = { name: "Alice", age: 30 };
  const aliasDictionary = {
    name: ["aliasName"] as const,
    age: ["years", "old"] as const,
  };

  let person: Person;
  let aliased: Person & { aliasName: string; years: number; old: number };

  beforeEach(() => {
    person = { ...model };
    aliased = alias(person, aliasDictionary);
  });

  it("reads through alias keys", () => {
    expect(aliased.aliasName).toBe("Alice");
    expect(aliased.years).toBe(30);
    expect(aliased.old).toBe(30);
  });

  it("still reads the original keys", () => {
    expect(aliased.name).toBe("Alice");
    expect(aliased.age).toBe(30);
  });

  it("writes through alias keys to the original object", () => {
    aliased.aliasName = "Bob";
    aliased.years = 40;
    expect(person.name).toBe("Bob");
    expect(person.age).toBe(40);
    expect(aliased.name).toBe("Bob");
  });

  it("writes through original keys and reads back through aliases", () => {
    aliased.name = "Charlie";
    aliased.age = 35;
    expect(aliased.aliasName).toBe("Charlie");
    expect(aliased.old).toBe(35);
  });

  it("does not affect non-aliased properties", () => {
    aliased.city = "Wonderland";
    expect(aliased.city).toBe("Wonderland");
    expect(person.city).toBe("Wonderland");
  });

  it("ignores dictionary entries for keys the object does not have", () => {
    const extended = alias(person, { ...aliasDictionary, nonExistent: ["ghost"] as const });
    expect((extended as unknown as Record<string, unknown>).ghost).toBeUndefined();
    expect(extended.name).toBe("Alice");
  });

  it("ignores dictionary entries whose alias list is undefined", () => {
    const partial = alias(person, { name: undefined, age: ["years"] as const });
    expect(partial.years).toBe(30);
    expect(partial.name).toBe("Alice");
  });

  it("passes symbol keys through untouched", () => {
    const tag = Symbol("tag");
    const tagged = Object.assign(person, { [tag]: "hello" });
    const wrapped = alias(tagged, aliasDictionary);
    expect(wrapped[tag]).toBe("hello");
    expect(tag in wrapped).toBe(true);
  });

  it("ignores an alias identical to its own key", () => {
    const same = alias(person, { name: ["name"] as const });
    expect(same.name).toBe("Alice");
  });

  it("does not resolve inherited Object.prototype members as aliases", () => {
    // The legacy implementation looked aliases up in a plain object, so
    // `aliased.toString` found Object.prototype.toString and returned undefined.
    expect(Reflect.get(aliased, "toString")).toBe(Reflect.get(Object.prototype, "toString"));
    expect(Reflect.get(aliased, "constructor")).toBe(Object);
  });

  it("makes aliases visible to the `in` operator", () => {
    expect("aliasName" in aliased).toBe(true);
    expect("name" in aliased).toBe(true);
    expect("nope" in aliased).toBe(false);
  });

  it("deletes the original property when an alias is deleted", () => {
    delete (aliased as Partial<typeof aliased>).aliasName;
    expect("name" in person).toBe(false);
  });

  it("does not list aliases as own keys", () => {
    expect(Object.keys(aliased).sort()).toEqual(["age", "name"]);
  });

  it("throws when the same alias is mapped to two keys", () => {
    expect(() => alias(person, { name: ["x"] as const, age: ["x"] as const })).toThrow(
      /Alias "x" is mapped to both "name" and "age"/,
    );
  });

  it("throws when an alias collides with an existing property", () => {
    expect(() => alias(person, { age: ["name"] as const })).toThrow(/collides/);
    expect(() => alias(person, { age: ["toString"] as const })).toThrow(/collides/);
  });

  it("adds the alias keys to the type", () => {
    expectTypeOf(aliased.aliasName).toEqualTypeOf<string>();
    expectTypeOf(aliased.years).toEqualTypeOf<number>();
  });
});
````

- [ ] **Step 2: Ver falhar (RED).**

```bash
npx vitest run --project core src/core/alias.test.ts 2>&1 | grep -E "Cannot find|Test Files"
```

Esperado: `Error: Cannot find module './alias'`.

- [ ] **Step 3: Implementar.** O mapa de aliases é um `Map` (sem protótipo herdado), o que elimina o bug legado.

````ts
// src/core/alias.ts
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
````

- [ ] **Step 4: Ver passar (GREEN).**

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run --project core src/core/alias.test.ts
```

Esperado: `Tests  16 passed (16)`.

- [ ] **Step 5: Commit.**

```bash
git add src/core/alias.ts src/core/alias.test.ts
git commit -q -m "feat: rebuild alias on a Map, with has/delete traps and collision errors" \
  -m "Fixes aliased.toString returning undefined (aliases were looked up in a plain object)." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Barrel da raiz e teste da superfície pública

**Files:** substituir `src/index.ts` e `src/index.test.ts`.

- [ ] **Step 1: Escrever o teste primeiro.** Ele congela a lista exata de exports: adicionar ou remover um é uma decisão de API e
      exige editar a lista de propósito.

````ts
// src/index.test.ts
import { describe, expect, it } from "vitest";
import * as root from "./index";

describe("@gabreusi/hyrax (root entrypoint)", () => {
  it("loads in a plain Node environment, without DOM globals", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });

  it("has named exports only (no default export or aggregate object)", () => {
    expect("default" in root).toBe(false);
  });

  it("exposes exactly the intended public API", () => {
    // Adding or removing an export is an API decision: update this list on purpose.
    expect(Object.keys(root).sort()).toEqual([
      "alias",
      "clamp",
      "coalesce",
      "fabricate",
      "isNumeric",
      "lerp",
      "noop",
      "ratio",
      "remap",
      "splitWords",
      "toCamelCase",
      "toKebabCase",
      "toNumber",
      "toPascalCase",
      "toSnakeCase",
      "traceHierarchy",
    ]);
  });
});
````

- [ ] **Step 2: Ver falhar (RED).**

```bash
npx vitest run --project core src/index.test.ts 2>&1 | grep -E "exposes exactly|Test Files|Tests "
```

Esperado: o teste `exposes exactly the intended public API` falha (a raiz ainda só exporta `noop`).

- [ ] **Step 3: Implementar.**

````ts
// src/index.ts
export { alias } from "./core/alias";
export { clamp, lerp, ratio, remap } from "./core/number";
export { coalesce } from "./core/nullish";
export { fabricate } from "./core/fabricate";
export { isNumeric, toNumber } from "./core/numeric";
export { noop } from "./core/noop";
export { splitWords, toCamelCase, toKebabCase, toPascalCase, toSnakeCase } from "./core/string";
export { traceHierarchy } from "./core/tree";
export type { AnyString, Maybe, Nullable, Numeric } from "./core/types";
````

- [ ] **Step 4: Ver passar (GREEN) e rodar a suíte inteira.**

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run --coverage
```

Esperado: `Test Files  12 passed (12)`, `Tests  127 passed (127)`, sem linhas de cobertura listadas (todos os arquivos em 100%) e
sem erro de `threshold`.

- [ ] **Step 5: Commit.**

```bash
git add src/index.ts src/index.test.ts
git commit -q -m "feat: export the core functions from the root entrypoint" \
  -m "The API-surface test pins the exact list of exports." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: `size-limit`

**Files:** modificar `package.json` (scripts, `size-limit`, devDependencies) e `package-lock.json`.

- [ ] **Step 1: Instalar e configurar.** São dois limites: o núcleo inteiro e **uma função só** (o teste real de tree-shaking).

```bash
npm install -D size-limit @size-limit/preset-small-lib
npm pkg set scripts.size="size-limit"
npm pkg set --json size-limit='[{"name":"root entrypoint, everything","path":"dist/index.js","import":"*","limit":"1.5 kB"},{"name":"root entrypoint, clamp only","path":"dist/index.js","import":"{ clamp }","limit":"150 B"}]'
npm pkg set scripts.check="npm run lint && npm run format:check && npm run typecheck && npm run check:boundary && npm run test:coverage && npm run build && npm run check:package && npm run size && npm run smoke"
npx prettier --write package.json
```

- [ ] **Step 2: Medir.**

```bash
npm run build && npm run size
```

Esperado (valores medidos no clone de validação; podem variar poucos bytes):
`root entrypoint, everything ... Size: 1.05 kB` e `root entrypoint, clamp only ... Size: 76 B`, ambos abaixo do limite. Importar só `clamp`
custar ~76 B contra ~1 kB do núcleo inteiro prova que o tree-shaking funciona (`sideEffects: false`).

- [ ] **Step 3: Provar que estourar o limite quebra.**

```bash
cp package.json /tmp/package.json.bak
sed -i 's/"limit": "150 B"/"limit": "50 B"/' package.json
npm run size 2>&1 | grep -E "exceeded"; echo "exit=${PIPESTATUS[0]}"
cp /tmp/package.json.bak package.json
```

Esperado: `Package size limit has exceeded by ... B` e `exit=1`. Depois do `cp`, `git diff package.json` não mostra o limite
de 50 B.

- [ ] **Step 4: Commit.**

```bash
git add package.json package-lock.json
git commit -q -m "build: enforce a bundle-size budget with size-limit" \
  -m "Two budgets: the whole core entrypoint and a single function, which guards tree-shaking." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Smoke test com consumidor TypeScript, CI e CONTRIBUTING

**Files:** substituir `scripts/smoke.mjs`, `.github/workflows/ci.yml` e `CONTRIBUTING.md`.

- [ ] **Step 1: Substituir `scripts/smoke.mjs`.** Agora confere comportamento real (`clamp(15, 10) === 10` em ESM e CJS) e compila
      um consumidor TypeScript contra o tarball instalado, em `nodenext` e `bundler`. O passo de tipos usa o TypeScript do próprio
      repositório e é pulado onde as dependências não estão instaladas (a matriz de Node do CI instala só o tarball).

````js
// scripts/smoke.mjs
// Installs the library tarball into a clean directory and imports every
// entrypoint through ESM and CJS, exactly as a consumer would.
//
//   node scripts/smoke.mjs [path/to/tarball.tgz]   (packs the repo when omitted)
//   HYRAX_SMOKE_RUNTIMES=deno,bun node scripts/smoke.mjs   (also checks those runtimes)
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const NAME = "@gabreusi/hyrax";
const entrypoints = [NAME, `${NAME}/dom`, `${NAME}/react`];

// A real TypeScript consumer of the public API. `@ts-expect-error` lines make the
// compile fail if the types ever become looser than intended.
const CONSUMER = `
import { alias, clamp, fabricate, isNumeric, toCamelCase, traceHierarchy } from "${NAME}";
import type { Maybe, Numeric } from "${NAME}";

const aliased = alias({ name: "Alice", age: 30 }, { age: ["years"] as const });
export const years: number = aliased.years;
export const limited: number = clamp(15, 0, 10);
export const camel: string = toCamelCase("hello world");
export const made: string = fabricate(() => "x");
export const maybe: Maybe<string> = undefined;

const input: unknown = "12";
if (isNumeric(input)) {
  const numeric: Numeric = input;
  void numeric;
}

interface Node { parent: Node | null }
declare const node: Node;
export const chain: Node[] = traceHierarchy(node, "parent");

// @ts-expect-error clamp only accepts numbers
clamp("1", 0, 2);
// @ts-expect-error unknown alias
void aliased.nope;
`;

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

const dir = mkdtempSync(join(tmpdir(), "hyrax-smoke-"));
try {
  let tarball = process.argv[2] && resolve(process.argv[2]);
  if (!tarball) {
    // `npm pack --json` prints an array up to npm 11 and an object keyed by package name on npm 12.
    const packed = JSON.parse(
      run("npm", ["pack", "--json", "--pack-destination", dir], process.cwd()),
    );
    const { filename } = Array.isArray(packed) ? packed[0] : Object.values(packed)[0];
    tarball = join(dir, filename);
  }

  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "smoke", private: true }));
  // react/react-dom are optional peers; /react needs them once it has real code.
  run("npm", ["install", "--no-audit", "--no-fund", tarball, "react", "react-dom"], dir);

  for (const id of entrypoints) {
    run("node", ["--input-type=module", "-e", `await import("${id}");`], dir);
    run("node", ["-e", `require("${id}");`], dir);
  }

  const esm = run(
    "node",
    ["--input-type=module", "-e", `import { clamp } from "${NAME}"; console.log(clamp(15, 10));`],
    dir,
  ).trim();
  const cjs = run("node", ["-e", `console.log(require("${NAME}").clamp(15, 10));`], dir).trim();
  if (esm !== "10" || cjs !== "10") {
    throw new Error(`clamp(15, 10) gave ${esm} (ESM) / ${cjs} (CJS), expected 10 / 10`);
  }

  // Type-check a consumer against the installed package. Needs the repo's own
  // TypeScript, so it is skipped where dependencies are not installed.
  const tsc = resolve(process.cwd(), "node_modules/typescript/lib/tsc.js");
  const typed = existsSync(tsc);
  if (typed) {
    writeFileSync(join(dir, "consumer.mts"), CONSUMER);
    for (const [module, moduleResolution] of [
      ["nodenext", "nodenext"],
      ["esnext", "bundler"],
    ]) {
      run(
        "node",
        [
          tsc,
          "--noEmit",
          "--strict",
          "--target",
          "es2022",
          "--module",
          module,
          "--moduleResolution",
          moduleResolution,
          "consumer.mts",
        ],
        dir,
      );
    }
  }

  const runtimes = (process.env.HYRAX_SMOKE_RUNTIMES ?? "").split(",").filter(Boolean);
  const code = `${entrypoints.map((id, i) => `import * as m${i} from "${id}";`).join("")}
    if (m0.clamp(15, 10) !== 10) throw new Error("clamp broken");`;
  for (const runtime of runtimes) {
    if (runtime === "deno") run("deno", ["eval", "--node-modules-dir=manual", code], dir);
    else if (runtime === "bun") run("bun", ["-e", code], dir);
    else throw new Error(`Unknown runtime: ${runtime}`);
  }

  console.log(
    `Smoke test passed: ${entrypoints.length} entrypoints x (ESM + CJS)` +
      (typed ? " + consumer types" : "") +
      (runtimes.length ? ` + ${runtimes.join(", ")}` : ""),
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
````

- [ ] **Step 2: Rodar, e provar que o teste de tipos pode falhar.**

```bash
npm run build
npm run smoke
sed 's#^export const camel: string = toCamelCase("hello world");#export const camel: number = toCamelCase("hello world");#' scripts/smoke.mjs > scripts/smoke.bad.mjs
node scripts/smoke.bad.mjs 2>&1 | grep -E "TS2322" | head -1; rm scripts/smoke.bad.mjs
HYRAX_SMOKE_RUNTIMES=deno node scripts/smoke.mjs
```

Esperado: a primeira execução termina em `Smoke test passed: 3 entrypoints x (ESM + CJS) + consumer types`; a variante com o tipo
errado acusa `error TS2322: Type 'string' is not assignable to type 'number'`; a execução com Deno termina em
`... + consumer types + deno`. Se o Deno não estiver instalado, pule a última linha.

- [ ] **Step 3: Substituir `.github/workflows/ci.yml`.** A única mudança é o job `build`: roda `npm run size` e o smoke test sobre o
      tarball já com dependências instaladas (o que ativa a checagem de tipos do consumidor).

````yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  quality:
    name: Lint, format, types
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
      - run: npm run typecheck
      - run: npm run check:boundary

  test:
    name: Test (Node ${{ matrix.node }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node: [22, 24, 26]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npm run test:coverage

  test-react-18:
    name: Test /react (React 18)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm install --no-save react@18 react-dom@18 @types/react@18 @types/react-dom@18
      - run: npx vitest run --project react

  build:
    name: Build and validate the package
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm run check:package
      - run: npm run size
      - run: mkdir pack && npm pack --pack-destination pack
      # Dependencies are installed here, so this run also type-checks a consumer.
      - run: node scripts/smoke.mjs pack/*.tgz
      - uses: actions/upload-artifact@v7
        with:
          name: tarball
          path: pack/*.tgz
          if-no-files-found: error

  smoke:
    name: Smoke test (Node ${{ matrix.node }})
    needs: build
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node: [20, 22, 24, 26]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.node }}
      - uses: actions/download-artifact@v8
        with:
          name: tarball
          path: pack
      - run: node scripts/smoke.mjs pack/*.tgz

  runtimes:
    name: Smoke test (Deno and Bun, best effort)
    needs: build
    runs-on: ubuntu-latest
    continue-on-error: true
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
      - uses: oven-sh/setup-bun@v2
      - uses: actions/download-artifact@v8
        with:
          name: tarball
          path: pack
      - run: node scripts/smoke.mjs pack/*.tgz
        env:
          HYRAX_SMOKE_RUNTIMES: deno,bun
````

- [ ] **Step 4: Substituir `CONTRIBUTING.md`.** Ganha a linha do `npm run size`, a descrição nova do `smoke` e a seção *Writing TSDoc*
      (convenção de `@example`, doc por overload e a regra do zero com sinal).

````markdown
# Contributing

## Setup

Use Node 24 (`nvm use`, see `.nvmrc`; Node 22 or newer works) and install with `npm ci`.

## Commands

| Command                  | What it does                                                                     |
| ------------------------ | -------------------------------------------------------------------------------- |
| `npm test`               | Runs the tests (`core` in Node, `dom` and `react` in happy-dom)                  |
| `npm run test:coverage`  | Same, with coverage. `src/core` must stay at 95% or above                        |
| `npm run lint`           | ESLint. Every exported symbol needs TSDoc with an `@example`                     |
| `npm run typecheck`      | Type-checks each entrypoint and the tests                                        |
| `npm run check:boundary` | Fails if `src/core` starts compiling against DOM globals                         |
| `npm run build`          | Builds `dist/` (ESM, CJS and type declarations)                                  |
| `npm run check:package`  | `publint` and Are the Types Wrong on the built package                           |
| `npm run size`           | Enforces the bundle-size budget (whole entrypoint and one function)              |
| `npm run smoke`          | Installs the packed tarball, imports every entrypoint and type-checks a consumer |
| `npm run check`          | Everything above, in CI order                                                    |

## Rules of the repo

- `src/core` is universal: no `window`, `document` or Node-only APIs. The compiler enforces it (no DOM lib there).
- Only named exports. No default export and no aggregate object.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `build:`, `ci:`, `test:`, `chore:`).

## Writing TSDoc

Every exported function and type gets a summary, `@param`, `@returns` and an `@example`. The lint rule enforces
the summary and the `@example`; the rest is on review.

- Document **each overload** separately, since editors show the doc of the signature the caller matched. The
  linter only guarantees the first one, so check the others by hand.
- Write examples as one statement per line with the result in a trailing `// => value` comment. A later phase
  runs these examples as tests, so keep them exact.
- Signed zero is not a meaningful difference in `number` helpers: compare with `===`, not `Object.is`, in tests.
````

- [ ] **Step 5: Formatar e commitar.**

```bash
npx prettier --write scripts .github CONTRIBUTING.md && npm run format:check
git add scripts/smoke.mjs .github/workflows/ci.yml CONTRIBUTING.md
git commit -q -m "test: type-check a real consumer in the smoke test; document TSDoc rules" \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: Verificação final e PR

- [ ] **Step 1: Instalação limpa, como o CI faz.**

```bash
rm -rf node_modules dist coverage
npm ci
npm run check
```

Esperado: código 0, passando por lint, `format:check`, `typecheck`, guarda de fronteira, `Test Files  12 passed (12)` /
`Tests  127 passed (127)`, `publint` (`All good!`), `size-limit` (dois limites) e
`Smoke test passed: 3 entrypoints x (ESM + CJS) + consumer types`.

- [ ] **Step 2: Estabilidade dos testes de propriedade.** Rode a suíte do `core` várias vezes; cada execução usa sementes novas.

```bash
fails=0; for i in $(seq 1 15); do npx vitest run --project core >/dev/null 2>&1 || fails=$((fails+1)); done; echo "falhas: $fails de 15"
```

Esperado: `falhas: 0 de 15`. Qualquer falha é um contraexemplo real do `fast-check`: leia a semente e o contraexemplo na saída de
`npx vitest run --project core`, e decida se o defeito é da função ou do teste (foi assim que apareceram o zero com sinal e a
idempotência de camelCase).

- [ ] **Step 3: Conferir a árvore.**

```bash
git status --short && git log --oneline main..HEAD
```

Esperado: nenhum arquivo pendente e 12 commits (Tasks 1 a 12, um por task).

- [ ] **Step 4: Checklist de aceitação da Fase 1.**

  - [ ] `npm run check` passa a partir de instalação limpa
  - [ ] A raiz exporta exatamente: `alias`, `clamp`, `coalesce`, `fabricate`, `isNumeric`, `lerp`, `noop`, `ratio`, `remap`,
        `splitWords`, `toCamelCase`, `toKebabCase`, `toNumber`, `toPascalCase`, `toSnakeCase`, `traceHierarchy` (mais os tipos
        `AnyString`, `Maybe`, `Nullable`, `Numeric`), e nada mais (o teste da superfície pública garante)
  - [ ] Cobertura de `src/core` em 100% e sem regressão no limite de 95%
  - [ ] Todo símbolo exportado tem TSDoc com `@example` (o lint garante para a 1ª assinatura de cada função)
  - [ ] `size-limit` passa; importar só `clamp` custa uma fração do núcleo inteiro
  - [ ] O consumidor TypeScript do smoke test compila em `nodenext` e em `bundler`
  - [ ] Nenhum `window`/`document` no `core` (guarda de fronteira verde)

- [ ] **Step 5: Parar aqui e pedir autorização ao usuário** antes de `git push` e de abrir o PR. O `gh` está autenticado como
      `gpsign` com permissão `ADMIN` em `gabreusi/hyrax`; o push da Fase 0 funcionou sem trocar de conta. Depois do push, acompanhe
      o CI com `gh pr checks <número> --watch` e confira, no log do job `runtimes`, a linha final do smoke em vez de confiar no ícone
      (o job é `continue-on-error`).

---

## Notas para as próximas fases

1. **Fase 2 (`Suspend`, `Random`).** O `core` compila só com `lib: ["ES2022"]`, então `setInterval`, `clearInterval` e `crypto` **não têm
   tipos ali**. Precisam de uma declaração ambiente mínima em `src/core/` que conviva com a lib DOM quando o `core` é importado por
   `/dom`. O `MethodDefinition` do `jsdoc/require-jsdoc` deve ser conferido contra métodos `private` das classes.
2. **Fase 3 (`/dom`).** O `toNumber("2em")` legado (que resolvia unidades CSS) vira `toPixels`; a parte pura já está em `numeric.ts`.
3. **Fase 5 (docs).** O script de exemplos vai ler os blocos `@example` com o formato `expr; // => valor`. Os exemplos de hoje já
   seguem essa convenção, mas os de `fabricate` e `alias` têm blocos multilinha que o script precisará tratar.
4. **Tipo `AliasProperties`** não sai da raiz (decisão 4). Se um consumidor pedir para nomeá-lo, reavalie.
