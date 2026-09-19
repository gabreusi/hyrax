# Hyrax Fase 2 (núcleo, classes): plano de implementação

Spec: `docs/superpowers/specs/2026-09-18-hyrax-revival-design.md` (seção 4). Fases anteriores: `docs/superpowers/plans/2026-09-18-phase-0-foundation.md` e `docs/superpowers/plans/2026-09-19-phase-1-core-pure-functions.md`.

**Objetivo.** Reescrever as três classes do núcleo: `Random` (PRNG com seed), `StringBuilder` e `Suspend`. Todas universais (sem
`window`, `document` nem tipos do Node), com TSDoc completo, testes (incluindo propriedades, tempo simulado e vetores de
determinismo) e cobertura de 100%. Fecha o que a Fase 0 anotou: os tipos de timer e `crypto` no `core`, e o ajuste do lint para
membros privados.

**Arquitetura.** Um arquivo por classe em `src/core/` (`random.ts`, `string-builder.ts`, `suspend.ts`), cada um com seu `*.test.ts`. Um
helper interno, `src/core/internal/host.ts`, dá acesso tipado a `setInterval`, `clearInterval` e `crypto` via `globalThis`, lidos no
momento da chamada. Só `src/index.ts` reúne tudo.

**Fora desta fase:** `/dom` (Fase 3), `/react` (Fase 4), docs (Fase 5), release (Fase 6).

## Ponto de partida

Esta fase parte do `main` com a Fase 1 já mergeada (PR #25). Se o PR #25 ainda estiver aberto, crie a branch a partir de
`phase-1-core-pure-functions`: como o merge do #25 é um commit de merge, os commits da Fase 1 passam a fazer parte do `main` e o PR
desta fase mostra só os commits novos.

## Todo o plano foi validado antes de ser escrito

Implementei tudo num clone descartável e rodei `npm run check` completo. Os arquivos deste plano são os que passaram: **15 arquivos,
224 testes, cobertura 100% no `core`**, suíte repetida 15 vezes sem nenhuma falha. Cada classe teve o teste escrito antes da
implementação, com o RED observado, e depois **reintroduzi cada bug legado no código para provar que os testes de regressão o
pegam** (o `last` do `Suspend`, o `Math.round` do `Random.int` e o prefixo do `StringBuilder`): cada mutação quebrou exatamente os
testes esperados. Por fim, repeti os passos do plano num clone novo.

### O que a validação encontrou (já refletido nos arquivos abaixo)

| Achado | Consequência |
|---|---|
| **Timers e `crypto` não têm tipos no `core`** (`lib: ["ES2022"]`, sem `@types/node`). A nota da Fase 0 sugeria declarações ambiente | Em vez disso, `internal/host.ts` lê as globais via `globalThis`, tipadas à mão. Compila sem DOM, não conflita com as libs DOM/Node quando o `core` é importado por `/dom`, e é lido a cada chamada (timers falsos e `vi.stubGlobal` funcionam) |
| **O lint exigia `@example` em funções internas** (`cyrb128`, `createEngine`, `unit`) | `jsdoc/require-example` passa a olhar só declarações exportadas (`ExportNamedDeclaration > ...`), e `src/core/internal/**` fica isento |
| Membros privados (`#campo`, `private`) **não** exigem TSDoc; construtor, getters e métodos públicos exigem | Confirmado por experimento; resolve a dúvida anotada na Fase 0. Uma classe precisa de `@example` no próprio bloco (a regra agora cobre `ClassDeclaration` exportada) |
| **`int(0, -1)` troca os limites** (aceita ordem invertida), então `from([])` e `pop([])` sorteariam entre `-1` e `0` | `from` e `pop` tratam array vazio **antes** de chamar `int` |
| `date()` sobre décadas com uma fonte de 32 bits só alcança ~4 bilhões de valores (saltos de ~400 ms) | `Random` combina duas amostras de 32 bits num `float` de 53 bits; há teste que prova que a resolução é de 1 ms |
| A ordenação padrão de `Object.keys(...).sort()` põe maiúsculas antes de minúsculas, e a lista do teste da superfície pública estava em ordem "humana" | O teste ordena os dois lados |
| `console.log(${SEEDED})` com uma sequência de instruções é sintaxe inválida | O trecho de referência do smoke é uma expressão única (IIFE) |
| `restrict-template-expressions` acusa `${builder}` no teste do `StringBuilder` | Exceção pontual, com o motivo escrito ao lado (o template literal é o comportamento testado) |

### Decisões que o spec não fechava (tomadas aqui; revise se discordar)

1. **`Suspend` exige `0 < interval < threshold`** (`RangeError`). Um `threshold` menor ou igual ao `interval` dispararia sempre.
2. **`elapsed` é o intervalo desde a checagem anterior** (inclui o `interval`), como no código legado.
3. **Erros de listeners:** todos os listeners rodam; depois o erro sobe como um único erro não capturado (ou um `AggregateError`
   se houve vários). Um listener que falha não impede os outros.
4. **`Suspend.on` depois de `dispose()` lança erro**, e `dispose()` pode ser chamado várias vezes.
5. **`Random.int` arredonda limites fracionários para dentro** (`1.2..2.8` vale `2`), aceita ordem invertida e lança `RangeError`
   quando não há inteiro no intervalo.
6. **`float` perde o parâmetro `digits`** do `number` legado.
7. **Seed:** sem argumento vem de `crypto.getRandomValues` (ou `Math.random` onde `crypto` falta) e fica em `seed`. Um número vale
   como a sua forma em string (`new Random(42)` é `new Random("42")`).
8. **`from` sobre string percorre pontos de código**, não unidades UTF-16.
9. **`Random` descarta 12 saídas depois de semear**, e isso faz parte do contrato de determinismo, como o algoritmo.
10. **`StringBuilder`:** `else` fecha a cadeia; `if(true, "")` conta como acerto mesmo com texto vazio; texto vazio é ignorado.
11. **Tipos exportados:** `StringBuilderOptions`, `SuspendOptions` e `SuspendCallback`, porque aparecem nas assinaturas públicas (o spec
    listava só `Nullable`, `Maybe`, `AnyString` e `Numeric`).
12. **A instância `random` é criada no import**, marcada `/* @__PURE__ */` para continuar tree-shakeable (medido: importar só
    `clamp` continua custando 76 B).
13. **`date()` usa "agora" como limite superior padrão**, então só é reproduzível se os dois limites forem passados (documentado).

### Como executar

Depois das Tasks 1 e 2, as **Tasks 3, 4 e 5 são independentes** (cada uma cria só os próprios arquivos) e podem rodar em paralelo.
**Só a Task 6 toca `src/index.ts`.** Executadas em sequência, siga a ordem abaixo. Os blocos de arquivo usam cercas de quatro crases
porque o TSDoc contém blocos de três. Para sobrescrever um arquivo existente, leia-o antes.

---

## Task 1: Branch, linha de base e lint para classes e código interno

**Files:** modificar `eslint.config.js`.

- [ ] **Step 1: Criar a branch e conferir a linha de base.**

```bash
cd /home/gabriel/Desktop/hyrax
git switch phase-2-core-classes   # já contém este plano; em um clone novo: git switch main && git pull --ff-only origin main && git switch -c phase-2-core-classes
npm ci
npm run check
```

Esperado: `npm run check` termina com código 0 (linha de base da Fase 1: 12 arquivos, 127 testes).

- [ ] **Step 2: Substituir `eslint.config.js`.** Mudanças em relação à Fase 1: o bloco de TSDoc ignora `**/internal/**`, e
      `jsdoc/require-example` passa a olhar só declarações **exportadas** (funções, assinaturas de overload e classes).

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
    ignores: ["**/*.test.{ts,tsx}", "**/index.ts", "**/internal/**"],
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
        {
          contexts: [
            "ExportNamedDeclaration > FunctionDeclaration",
            "ExportNamedDeclaration > TSDeclareFunction",
            "ExportNamedDeclaration > ClassDeclaration",
          ],
        },
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
cat > src/core/tmp-c.ts <<'EOF'
/** A class documented without an example. */
export class NoExample {
  /** Documented method. @returns One. */
  one(): number {
    return 1;
  }
}

function internalHelper(): number {
  return 1;
}
export const used = internalHelper();
EOF
npx eslint src/core/tmp-a.ts src/core/tmp-b.ts src/core/tmp-c.ts 2>&1 | grep -E "^/|^\s+[0-9]+:[0-9]+|✖"
rm src/core/tmp-a.ts src/core/tmp-b.ts src/core/tmp-c.ts
```

Esperado (4 erros): `tmp-a.ts 1:1 Missing JSDoc @example`; `tmp-b.ts 1:8 Missing JSDoc comment`; `tmp-c.ts 1:1 Missing JSDoc @example`
(a classe) e `tmp-c.ts 12:8 Missing JSDoc comment` (o `export const`). A função `internalHelper`, não exportada, **não** é acusada.

- [ ] **Step 4: Formatar, conferir e commitar.**

```bash
npx prettier --write eslint.config.js && npm run lint && npm run format:check
git add eslint.config.js
git commit -q -m "build: require examples only on exported symbols and exempt internal/" \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `internal/host.ts`, acesso tipado a timers e `crypto`

**Files:** criar `src/core/internal/host.ts`.

- [ ] **Step 1: Criar o helper.** Não tem teste próprio: é exercitado pelos testes de `Random` e `Suspend` (Tasks 3 e 5), e a
      cobertura de 100% do `core` garante que nenhuma linha dele fica de fora.

````ts
// src/core/internal/host.ts
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
````

- [ ] **Step 2: Provar que compila no `core`, que não tem DOM nem `@types/node`.**

```bash
npx tsc -p tsconfig.core.json && echo "core: ok"
npm run lint && npm run format:check
```

Esperado: `core: ok`, sem erros de lint.

- [ ] **Step 3: Commit.**

```bash
git add src/core/internal/host.ts
git commit -q -m "feat: add an internal typed accessor for timers and crypto" \
  -m "Reads globalThis at call time, so it compiles without the DOM or Node libs and honours fake timers." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `Random`

**Files:** criar `src/core/random.test.ts` e `src/core/random.ts`.

- [ ] **Step 1: Escrever o teste primeiro.** A seção `keeps its published output vectors` fixa as saídas do algoritmo: **mudá-las é
      uma quebra de versão major**. Os testes de uniformidade usam sementes fixas, então são determinísticos.

````ts
// src/core/random.test.ts
import fc from "fast-check";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { Random, random } from "./random";

afterEach(() => {
  vi.unstubAllGlobals();
});

const draws = (rng: Random, count: number, take: (rng: Random) => unknown) =>
  Array.from({ length: count }, () => take(rng));

describe("determinism", () => {
  it("produces the same sequence for the same seed", () => {
    const take = (rng: Random) => [rng.float(), rng.int(1, 100), rng.boolean(), rng.id(6)];
    expect(draws(new Random("hyrax"), 20, take)).toEqual(draws(new Random("hyrax"), 20, take));
  });

  it("produces different sequences for different seeds", () => {
    const take = (rng: Random) => rng.float();
    expect(draws(new Random("a"), 5, take)).not.toEqual(draws(new Random("b"), 5, take));
  });

  it("treats a numeric seed as its string form", () => {
    expect(new Random(42).float()).toBe(new Random("42").float());
    expect(new Random(42).seed).toBe("42");
  });

  it("exposes the seed it was created with", () => {
    expect(new Random("hyrax").seed).toBe("hyrax");
  });

  it("generates a different seed for every unseeded instance", () => {
    const seeds = new Set(Array.from({ length: 50 }, () => new Random().seed));
    expect(seeds.size).toBe(50);
  });

  it("falls back to Math.random when crypto is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    const a = new Random();
    const b = new Random();
    expect(a.seed).toMatch(/^[0-9a-f]{32}$/);
    expect(a.seed).not.toBe(b.seed);
  });

  // Changing the algorithm is a breaking change: these vectors must never move.
  it("keeps its published output vectors", () => {
    const rng = new Random("hyrax");
    expect(draws(rng, 4, (r) => r.float())).toEqual([
      0.2514027896226875, 0.38468355137943655, 0.17461975251297168, 0.3892833269885583,
    ]);
    expect(draws(rng, 8, (r) => r.int(1, 100))).toEqual([99, 70, 84, 81, 26, 63, 48, 15]);
    expect(rng.id(12)).toBe("GaDZWfgd9m4q");
    expect(rng.uuid()).toBe("1108c5b6-fa02-4744-8ff8-56c074279105");
  });
});

describe("float", () => {
  it("returns values in [min, max)", () => {
    fc.assert(
      fc.property(fc.string(), (seed) => {
        const rng = new Random(seed);
        for (let i = 0; i < 20; i++) {
          const value = rng.float(-5, 5);
          expect(value).toBeGreaterThanOrEqual(-5);
          expect(value).toBeLessThan(5);
        }
      }),
    );
  });

  it("defaults to the range [0, 1)", () => {
    const value = new Random("x").float();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });

  it("accepts reversed bounds", () => {
    const value = new Random("x").float(10, 0);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(10);
  });

  it("rejects non-finite bounds", () => {
    expect(() => new Random("x").float(0, Infinity)).toThrow(RangeError);
    expect(() => new Random("x").float(NaN, 1)).toThrow(RangeError);
  });
});

describe("int", () => {
  it("is inclusive on both ends", () => {
    const rng = new Random("ends");
    const seen = new Set(draws(rng, 500, (r) => r.int(1, 3)));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it("always stays inside the bounds", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer({ min: -1000, max: 1000 }),
        fc.nat(1000),
        (seed, min, span) => {
          const value = new Random(seed).int(min, min + span);
          expect(value).toBeGreaterThanOrEqual(min);
          expect(value).toBeLessThanOrEqual(min + span);
          expect(Number.isInteger(value)).toBe(true);
        },
      ),
    );
  });

  it("does not favour any value (no half-weight endpoints)", () => {
    const rng = new Random("uniform");
    const tally = new Array<number>(10).fill(0);
    for (let i = 0; i < 100_000; i++) {
      const value = rng.int(0, 9);
      tally[value] = (tally[value] ?? 0) + 1;
    }
    for (const count of tally) {
      expect(count).toBeGreaterThan(9_500);
      expect(count).toBeLessThan(10_500);
    }
  });

  it("rounds fractional bounds inward", () => {
    const rng = new Random("inward");
    expect(new Set(draws(rng, 200, (r) => r.int(1.2, 2.8)))).toEqual(new Set([2]));
  });

  it("accepts reversed bounds", () => {
    const value = new Random("x").int(5, 1);
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(5);
  });

  it("throws when there is no integer in the range", () => {
    expect(() => new Random("x").int(1.2, 1.8)).toThrow(RangeError);
    expect(() => new Random("x").int(NaN, 3)).toThrow(RangeError);
    expect(() => new Random("x").int(0, Infinity)).toThrow(RangeError);
  });
});

describe("boolean", () => {
  it("never returns true at chance 0 and always at chance 1", () => {
    const rng = new Random("edge");
    expect(draws(rng, 200, (r) => r.boolean(0)).every((v) => v === false)).toBe(true);
    expect(draws(rng, 200, (r) => r.boolean(1)).every((v) => v === true)).toBe(true);
  });

  it("is roughly balanced at the default chance", () => {
    const rng = new Random("balance");
    const trues = draws(rng, 10_000, (r) => r.boolean()).filter(Boolean).length;
    expect(trues).toBeGreaterThan(4_700);
    expect(trues).toBeLessThan(5_300);
  });

  it("rejects chances outside 0..1 (so boolean(50) cannot silently mean always)", () => {
    expect(() => new Random("x").boolean(50)).toThrow(RangeError);
    expect(() => new Random("x").boolean(-0.1)).toThrow(RangeError);
    expect(() => new Random("x").boolean(NaN)).toThrow(RangeError);
  });
});

describe("from", () => {
  it("picks an element of an array", () => {
    const list = ["a", "b", "c"];
    const rng = new Random("from");
    for (let i = 0; i < 50; i++) expect(list).toContain(rng.from(list));
  });

  it("picks a code point of a string", () => {
    const rng = new Random("str");
    const seen = new Set(draws(rng, 200, (r) => r.from("😀ab")));
    expect(seen).toEqual(new Set(["😀", "a", "b"]));
  });

  it("picks a value of an object", () => {
    const rng = new Random("obj");
    const seen = new Set(draws(rng, 200, (r) => r.from({ x: 1, y: 2 })));
    expect(seen).toEqual(new Set([1, 2]));
  });

  it("returns undefined for an empty source", () => {
    const rng = new Random("empty");
    expect(rng.from([])).toBeUndefined();
    expect(rng.from("")).toBeUndefined();
    expect(rng.from({})).toBeUndefined();
  });

  it("types the result after the source", () => {
    const rng = new Random("types");
    expectTypeOf(rng.from([1, 2, 3])).toEqualTypeOf<number | undefined>();
    expectTypeOf(rng.from("abc")).toEqualTypeOf<string | undefined>();
    expectTypeOf(rng.from({ a: true })).toEqualTypeOf<boolean | undefined>();
  });
});

describe("pop", () => {
  it("removes and returns a random element", () => {
    const list = [1, 2, 3, 4];
    const popped = new Random("pop").pop(list);
    expect(list).toHaveLength(3);
    expect(list).not.toContain(popped);
  });

  it("empties the array, one element at a time", () => {
    const list = [1, 2, 3];
    const rng = new Random("all");
    const out = [rng.pop(list), rng.pop(list), rng.pop(list)];
    expect(out.sort()).toEqual([1, 2, 3]);
    expect(list).toEqual([]);
  });

  it("removes the drawn position, even when values repeat", () => {
    const list = [7, 7, 7];
    new Random("dup").pop(list);
    expect(list).toEqual([7, 7]);
  });

  it("returns undefined for an empty array", () => {
    expect(new Random("x").pop([])).toBeUndefined();
  });
});

describe("shuffle", () => {
  it("returns a permutation without touching the input", () => {
    fc.assert(
      fc.property(fc.string(), fc.array(fc.integer(), { maxLength: 30 }), (seed, input) => {
        const copy = [...input];
        const out = new Random(seed).shuffle(input);
        expect(input).toEqual(copy);
        expect([...out].sort((a, b) => a - b)).toEqual([...input].sort((a, b) => a - b));
      }),
    );
  });

  it("is deterministic for a seed", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(new Random("s").shuffle(input)).toEqual(new Random("s").shuffle(input));
  });

  it("actually reorders", () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    expect(new Random("mix").shuffle(input)).not.toEqual(input);
  });

  it("reaches every permutation with about the same frequency", () => {
    const rng = new Random("perms");
    const counts = new Map<string, number>();
    for (let i = 0; i < 6_000; i++) {
      const key = rng.shuffle([1, 2, 3]).join("");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(850);
      expect(count).toBeLessThan(1_150);
    }
  });
});

describe("date", () => {
  it("returns a date between the bounds, inclusive", () => {
    const rng = new Random("date");
    const from = new Date("2020-01-01").getTime();
    const to = new Date("2020-12-31").getTime();
    for (let i = 0; i < 100; i++) {
      const time = rng.date("2020-01-01", "2020-12-31").getTime();
      expect(time).toBeGreaterThanOrEqual(from);
      expect(time).toBeLessThanOrEqual(to);
    }
  });

  it("accepts numbers and Date objects as bounds", () => {
    const rng = new Random("kinds");
    const date = rng.date(new Date(1000), 2000);
    expect(date.getTime()).toBeGreaterThanOrEqual(1000);
    expect(date.getTime()).toBeLessThanOrEqual(2000);
  });

  it("covers spans much longer than 2^32 milliseconds without gaps", () => {
    const rng = new Random("wide");
    const times = draws(rng, 200, (r) => r.date(0, "2100-01-01").getTime()) as number[];
    // With a 32-bit source every value would be a multiple of ~400 ms; a 53-bit source is not.
    expect(times.some((t) => t % 2 !== 0)).toBe(true);
  });

  it("defaults to the range from the epoch to now", () => {
    const before = Date.now();
    const time = new Random("default").date().getTime();
    expect(time).toBeGreaterThanOrEqual(0);
    expect(time).toBeLessThanOrEqual(Math.max(before, Date.now()));
  });

  it("rejects invalid bounds", () => {
    expect(() => new Random("x").date("not a date")).toThrow(RangeError);
    expect(() => new Random("x").date(0, NaN)).toThrow(RangeError);
  });
});

describe("id", () => {
  it("has the requested length and uses the default alphanumeric alphabet", () => {
    const rng = new Random("id");
    expect(rng.id()).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(rng.id(25)).toMatch(/^[A-Za-z0-9]{25}$/);
    expect(rng.id(0)).toBe("");
  });

  it("includes the digit 0 (the legacy alphabet skipped it)", () => {
    const rng = new Random("zero");
    expect(rng.id(2_000)).toContain("0");
  });

  it("supports a custom alphabet, including non-BMP code points", () => {
    const rng = new Random("alphabet");
    expect(rng.id(200, "ab")).toMatch(/^[ab]{200}$/);
    expect(Array.from(rng.id(50, "😀😁"))).toHaveLength(50);
  });

  it("rejects bad lengths and an empty alphabet", () => {
    const rng = new Random("x");
    expect(() => rng.id(-1)).toThrow(RangeError);
    expect(() => rng.id(1.5)).toThrow(RangeError);
    expect(() => rng.id(5, "")).toThrow(RangeError);
  });
});

describe("uuid", () => {
  it("is a valid version 4 UUID", () => {
    const rng = new Random("uuid");
    for (let i = 0; i < 100; i++) {
      expect(rng.uuid()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  it("is deterministic for a seed and unique across draws", () => {
    expect(new Random("u").uuid()).toBe(new Random("u").uuid());
    const rng = new Random("many");
    expect(new Set(draws(rng, 2_000, (r) => r.uuid())).size).toBe(2_000);
  });
});

describe("random (the shared instance)", () => {
  it("is an unseeded Random", () => {
    expect(random).toBeInstanceOf(Random);
    const value = random.int(1, 6);
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(6);
  });
});
````

- [ ] **Step 2: Ver falhar (RED).**

```bash
npx vitest run --project core src/core/random.test.ts 2>&1 | grep -E "Cannot find|Test Files"
```

Esperado: `Error: Cannot find module './random'`.

- [ ] **Step 3: Implementar.** Repare que `from` e `pop` tratam array vazio antes de chamar `int` (que troca limites invertidos), e
      que `unit` combina duas amostras de 32 bits num `float` de 53 bits.

````ts
// src/core/random.ts
import { host } from "./internal/host";

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** cyrb128: hashes a string into four 32-bit words (public domain, by bryc). */
function cyrb128(text: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** sfc32: a small, fast 128-bit generator that returns unsigned 32-bit integers. */
function createEngine(seed: string): () => number {
  let [a, b, c, d] = cyrb128(seed);
  const next = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let i = 0; i < 12; i++) next();
  return next;
}

/** Combines two 32-bit draws into a float in [0, 1) with 53 bits of precision. */
function unit(next: () => number): number {
  const high = next() >>> 5;
  const low = next() >>> 6;
  return (high * 67108864 + low) / 9007199254740992;
}

function createSeed(): string {
  const words = new Uint32Array(4);
  const crypto = host().crypto;
  if (crypto?.getRandomValues) {
    crypto.getRandomValues(words);
  } else {
    for (let i = 0; i < words.length; i++) words[i] = Math.floor(Math.random() * 4294967296);
  }
  return Array.from(words, (word) => word.toString(16).padStart(8, "0")).join("");
}

/**
 * A seedable pseudo-random number generator. The same seed and the same sequence of
 * calls always give the same results, in any runtime, which makes it good for tests,
 * fixtures and reproducible simulations.
 *
 * It is **not cryptographically secure**: never use it for tokens or secrets.
 *
 * The algorithm (sfc32 seeded through cyrb128) is part of the public contract:
 * changing it is a breaking change.
 *
 * @example
 * ```ts
 * const rng = new Random("fixture-42");
 * rng.int(1, 6); // the same die roll every time
 * rng.from(["a", "b", "c"]);
 * rng.shuffle([1, 2, 3, 4]);
 * ```
 */
export class Random {
  /** The seed this generator was created with. Pass it to `new Random(seed)` to replay a run. */
  readonly seed: string;

  readonly #next32: () => number;

  /**
   * Creates a generator. Without a seed, one is drawn from `crypto` (or `Math.random`
   * where `crypto` is missing) and exposed as {@link Random.seed}.
   *
   * @param seed - Any string or number. A number is used as its string form, so
   *   `new Random(42)` equals `new Random("42")`.
   */
  constructor(seed?: string | number) {
    this.seed = seed === undefined ? createSeed() : String(seed);
    this.#next32 = createEngine(this.seed);
  }

  /**
   * A float in `[min, max)`. The bounds may be given in either order.
   *
   * @example
   * ```ts
   * new Random("x").float(); // => a number in [0, 1)
   * new Random("x").float(10, 20); // => a number in [10, 20)
   * ```
   *
   * @param min - One bound (default `0`).
   * @param max - The other bound (default `1`).
   * @returns The random float.
   * @throws {RangeError} When a bound is not finite.
   */
  float(min = 0, max = 1): number {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new RangeError(`float() needs finite bounds, got ${min} and ${max}.`);
    }
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return low + unit(this.#next32) * (high - low);
  }

  /**
   * An integer between `min` and `max`, **both included**, with no bias. The bounds may be
   * given in either order, and fractional bounds are rounded inward (`1.2..2.8` means `2`).
   *
   * @example
   * ```ts
   * new Random("x").int(1, 6); // => 1, 2, 3, 4, 5 or 6
   * ```
   *
   * @param min - One bound.
   * @param max - The other bound.
   * @returns The random integer.
   * @throws {RangeError} When the range holds no integer or is not finite.
   */
  int(min: number, max: number): number {
    const low = Math.ceil(Math.min(min, max));
    const high = Math.floor(Math.max(min, max));
    if (!Number.isFinite(low) || !Number.isFinite(high) || low > high) {
      throw new RangeError(`int() found no integer between ${min} and ${max}.`);
    }
    return low + Math.floor(unit(this.#next32) * (high - low + 1));
  }

  /**
   * `true` with the given probability.
   *
   * @example
   * ```ts
   * new Random("x").boolean(); // 50% true
   * new Random("x").boolean(0.75); // 75% true
   * ```
   *
   * @param chance - The probability of `true`, from `0` to `1` (default `0.5`).
   * @returns The random boolean.
   * @throws {RangeError} When `chance` is outside `0..1`. A percentage such as `50` is an
   *   error, not "always true".
   */
  boolean(chance = 0.5): boolean {
    if (!(chance >= 0 && chance <= 1)) {
      throw new RangeError(`boolean() needs a chance between 0 and 1, got ${chance}.`);
    }
    return unit(this.#next32) < chance;
  }

  /**
   * A random element of an array, a random character (code point) of a string, or a random
   * value of an object.
   *
   * @example
   * ```ts
   * new Random("x").from([10, 20, 30]); // => 10, 20 or 30
   * ```
   *
   * @param source - The array to pick from.
   * @returns An element, or `undefined` when the source is empty.
   */
  from<T>(source: readonly T[]): T | undefined;
  /**
   * A random character (code point) of a string.
   *
   * @example
   * ```ts
   * new Random("x").from("abc"); // => "a", "b" or "c"
   * ```
   *
   * @param source - The string to pick from.
   * @returns A character, or `undefined` when the string is empty.
   */
  from(source: string): string | undefined;
  /**
   * A random value of an object.
   *
   * @example
   * ```ts
   * new Random("x").from({ a: 1, b: 2 }); // => 1 or 2
   * ```
   *
   * @param source - The object whose values to pick from.
   * @returns A value, or `undefined` when the object has none.
   */
  from<T>(source: Readonly<Record<string, T>>): T | undefined;
  from(source: string | readonly unknown[] | Readonly<Record<string, unknown>>): unknown {
    const items: readonly unknown[] =
      typeof source === "string"
        ? Array.from(source)
        : Array.isArray(source)
          ? (source as readonly unknown[])
          : Object.values(source);
    if (items.length === 0) return undefined;
    return items[this.int(0, items.length - 1)];
  }

  /**
   * Removes a random element from `array` (mutating it) and returns it.
   *
   * @example
   * ```ts
   * const deck = [1, 2, 3];
   * new Random("x").pop(deck); // => one of them, now missing from `deck`
   * ```
   *
   * @param array - The array to take an element from.
   * @returns The removed element, or `undefined` when the array is empty.
   */
  pop<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array.splice(this.int(0, array.length - 1), 1)[0];
  }

  /**
   * A shuffled copy of `array` (Fisher-Yates). Every permutation is equally likely and the
   * input is left untouched.
   *
   * @example
   * ```ts
   * new Random("x").shuffle([1, 2, 3, 4]); // => e.g. [3, 1, 4, 2]
   * ```
   *
   * @param array - The items to shuffle.
   * @returns A new, shuffled array.
   */
  shuffle<T>(array: readonly T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const held = copy[i] as T;
      copy[i] = copy[j] as T;
      copy[j] = held;
    }
    return copy;
  }

  /**
   * A date between `after` and `before`, both included, at millisecond resolution. The
   * defaults are the Unix epoch and now, so pass both bounds for a reproducible result.
   *
   * @example
   * ```ts
   * new Random("x").date("2020-01-01", "2020-12-31"); // => a date in 2020
   * ```
   *
   * @param after - The earliest date (default: the epoch).
   * @param before - The latest date (default: now).
   * @returns The random date.
   * @throws {RangeError} When a bound is not a valid date.
   */
  date(after: number | string | Date = 0, before: number | string | Date = Date.now()): Date {
    const from = new Date(after).getTime();
    const to = new Date(before).getTime();
    if (Number.isNaN(from) || Number.isNaN(to)) {
      throw new RangeError("date() needs valid date bounds.");
    }
    return new Date(this.int(from, to));
  }

  /**
   * A random string of characters from `alphabet`. Not unique and not secret: two calls can
   * return the same string.
   *
   * @example
   * ```ts
   * new Random("x").id(); // => e.g. "aZ3kQ9pLm0"
   * new Random("x").id(4, "01"); // => e.g. "1001"
   * ```
   *
   * @param length - How many characters (default `10`).
   * @param alphabet - The characters to draw from (default: letters and digits).
   * @returns The string.
   * @throws {RangeError} When `length` is not a non-negative integer or the alphabet is empty.
   */
  id(length = 10, alphabet: string = ALPHANUMERIC): string {
    if (!Number.isInteger(length) || length < 0) {
      throw new RangeError(`id() needs a non-negative integer length, got ${length}.`);
    }
    const characters = Array.from(alphabet);
    if (characters.length === 0) throw new RangeError("id() needs a non-empty alphabet.");
    let id = "";
    for (let i = 0; i < length; i++) id += characters[this.int(0, characters.length - 1)];
    return id;
  }

  /**
   * A version 4 UUID drawn from this generator, so it is reproducible for a given seed.
   * Not suitable where unpredictability matters.
   *
   * @example
   * ```ts
   * new Random("x").uuid(); // => "3f2b8c1e-9a47-4d0e-8b5a-6c1d2e7f9a03" (the same for this seed)
   * ```
   *
   * @returns The UUID, in lowercase.
   */
  uuid(): string {
    const view = new DataView(new ArrayBuffer(16));
    for (let offset = 0; offset < 16; offset += 4) view.setUint32(offset, this.#next32());
    view.setUint8(6, (view.getUint8(6) & 0x0f) | 0x40);
    view.setUint8(8, (view.getUint8(8) & 0x3f) | 0x80);
    const hex = Array.from({ length: 16 }, (_, i) =>
      view.getUint8(i).toString(16).padStart(2, "0"),
    );
    return [hex.slice(0, 4), hex.slice(4, 6), hex.slice(6, 8), hex.slice(8, 10), hex.slice(10)]
      .map((part) => part.join(""))
      .join("-");
  }
}

/**
 * A ready-to-use, unseeded {@link Random}, for when you do not need reproducibility.
 *
 * @example
 * ```ts
 * random.int(1, 6); // a different result on every run
 * ```
 */
export const random: Random = /* @__PURE__ */ new Random();
````

- [ ] **Step 4: Ver passar (GREEN).**

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run --project core src/core/random.test.ts
```

Esperado: `Tests  45 passed (45)`.

- [ ] **Step 5: Provar que o teste de uniformidade pega o viés legado.** Troque temporariamente o corpo de `int`, rode e confira que
      quebra, depois restaure.

```bash
cp src/core/random.ts /tmp/random.bak
sed -i 's|return low + Math.floor(unit(this.#next32) \* (high - low + 1));|return Math.round(low + unit(this.#next32) * (high - low));|' src/core/random.ts
npx vitest run --project core src/core/random.test.ts 2>&1 | grep -E "^ +×"
cp /tmp/random.bak src/core/random.ts && git status --short
```

Esperado: falham `keeps its published output vectors`, `does not favour any value (no half-weight endpoints)` e
`reaches every permutation with about the same frequency`; depois do `cp`, `git status` mostra só os arquivos novos desta task.

- [ ] **Step 6: Commit.**

```bash
git add src/core/random.ts src/core/random.test.ts
git commit -q -m "feat: rebuild Random on sfc32 with an unbiased, reproducible API" \
  -m "int is inclusive and unbiased, shuffle is Fisher-Yates, uuid is a real v4, boolean takes a 0..1 chance. Static methods, global caches and the toPrimitive coercion are gone." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `StringBuilder`

**Files:** criar `src/core/string-builder.test.ts` e `src/core/string-builder.ts`.

- [ ] **Step 1: Escrever o teste primeiro.** O teste do template literal tem uma exceção de lint pontual e comentada.

````ts
// src/core/string-builder.test.ts
import { describe, expect, expectTypeOf, it } from "vitest";
import { StringBuilder } from "./string-builder";

describe("append / build", () => {
  it("joins parts with a space by default", () => {
    expect(new StringBuilder().append("a").append("b").build()).toBe("a b");
  });

  it("returns an empty string when nothing was appended", () => {
    expect(new StringBuilder().build()).toBe("");
  });

  it("ignores empty strings", () => {
    expect(new StringBuilder().append("").append("a").append("").build()).toBe("a");
  });

  it("applies the prefix once, to the text it belongs to", () => {
    expect(new StringBuilder().append("world", "hello ").build()).toBe("hello world");
    expect(new StringBuilder().append("x", "btn--").append("y", "btn--").build()).toBe(
      "btn--x btn--y",
    );
  });

  it("uses a custom separator", () => {
    const builder = new StringBuilder({ separator: ", " }).append("a").append("b");
    expect(builder.build()).toBe("a, b");
  });

  it("lets build() override the separator for one call", () => {
    const builder = new StringBuilder().append("a").append("b");
    expect(builder.build("-")).toBe("a-b");
    expect(builder.build()).toBe("a b");
  });
});

describe("toString", () => {
  it("uses the configured separator, so template literals work", () => {
    const builder = new StringBuilder({ separator: "|" }).append("a").append("b");
    expect(builder.toString()).toBe("a|b");
    // The template literal is the behaviour under test.
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    expect(`${builder}`).toBe("a|b");
    expect(String(builder)).toBe("a|b");
  });
});

describe("unique", () => {
  it("skips a text that is already there", () => {
    const builder = new StringBuilder({ unique: true }).append("a").append("b").append("a");
    expect(builder.build()).toBe("a b");
  });

  it("compares the final text, prefix included", () => {
    const builder = new StringBuilder({ unique: true })
      .append("x", "a-")
      .append("x", "a-")
      .append("x", "b-");
    expect(builder.build()).toBe("a-x b-x");
  });

  it("allows duplicates when it is off", () => {
    expect(new StringBuilder().append("a").append("a").build()).toBe("a a");
  });
});

describe("remove", () => {
  it("removes every occurrence of the text", () => {
    const builder = new StringBuilder().append("a").append("b").append("a").remove("a");
    expect(builder.build()).toBe("b");
  });

  it("matches the final text, so prefixed parts can be removed", () => {
    // The legacy remove() compared against the raw text and never matched a prefixed part.
    const builder = new StringBuilder().append("x", "a-").remove("a-x");
    expect(builder.build()).toBe("");
  });

  it("lets a removed text be appended again when unique is on", () => {
    const builder = new StringBuilder({ unique: true }).append("a").remove("a").append("a");
    expect(builder.build()).toBe("a");
  });

  it("does nothing when the text is absent", () => {
    expect(new StringBuilder().append("a").remove("zzz").build()).toBe("a");
  });
});

describe("if / elif / else", () => {
  it("appends on a truthy if and skips a falsy one", () => {
    expect(new StringBuilder().if(true, "yes").if(false, "no").build()).toBe("yes");
  });

  it("supports a prefix", () => {
    expect(new StringBuilder().if(1, "on", "state-").build()).toBe("state-on");
  });

  it("takes the first matching branch of an if / elif / else chain", () => {
    const build = (value: number) =>
      new StringBuilder()
        .if(value === 1, "one")
        .elif(value === 2, "two")
        .else("many")
        .build();
    expect(build(1)).toBe("one");
    expect(build(2)).toBe("two");
    expect(build(3)).toBe("many");
  });

  it("does not evaluate later branches once one matched", () => {
    const builder = new StringBuilder()
      .if(true, "first")
      .elif(true, "second")
      .elif(true, "third")
      .else("last");
    expect(builder.build()).toBe("first");
  });

  it("starts a new chain at every if", () => {
    const builder = new StringBuilder().if(true, "a").else("not-a").if(false, "b").else("not-b");
    expect(builder.build()).toBe("a not-b");
  });

  it("closes the chain after an else", () => {
    const builder = new StringBuilder().if(false, "a").else("b").else("c").elif(true, "d");
    expect(builder.build()).toBe("b");
  });

  it("lets else run when there was no if before it", () => {
    expect(new StringBuilder().else("fallback").build()).toBe("fallback");
  });

  it("is not affected by unconditional appends inside a chain", () => {
    const builder = new StringBuilder().if(true, "a").append("x").else("b");
    expect(builder.build()).toBe("a x");
  });

  it("counts a truthy condition as a match even when the text is empty", () => {
    expect(new StringBuilder().if(true, "").else("b").build()).toBe("");
  });

  it("accepts any truthy or falsy value as the condition", () => {
    const builder = new StringBuilder()
      .if("text", "a")
      .if(0, "b")
      .if(null, "c")
      .if([], "d")
      .if(undefined, "e");
    expect(builder.build()).toBe("a d");
  });
});

describe("types", () => {
  it("chains by returning `this`", () => {
    const builder = new StringBuilder();
    expectTypeOf(builder.append("a")).toEqualTypeOf<StringBuilder>();
    expectTypeOf(builder.if(true, "a").elif(false, "b").else("c")).toEqualTypeOf<StringBuilder>();
    expectTypeOf(builder.build()).toEqualTypeOf<string>();
  });
});
````

- [ ] **Step 2: Ver falhar (RED).**

```bash
npx vitest run --project core src/core/string-builder.test.ts 2>&1 | grep -E "Cannot find|Test Files"
```

Esperado: `Error: Cannot find module './string-builder'`.

- [ ] **Step 3: Implementar.**

````ts
// src/core/string-builder.ts
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
````

- [ ] **Step 4: Ver passar (GREEN).**

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run --project core src/core/string-builder.test.ts
```

Esperado: `Tests  25 passed (25)`.

- [ ] **Step 5: Commit.**

```bash
git add src/core/string-builder.ts src/core/string-builder.test.ts
git commit -q -m "feat: rebuild StringBuilder with options, final-text semantics and build()" \
  -m "The prefix is applied once, unique and remove compare the final text, and if/elif/else chains are documented and tested." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `Suspend`

**Files:** criar `src/core/suspend.test.ts` e `src/core/suspend.ts`.

- [ ] **Step 1: Escrever o teste primeiro.** Usa timers falsos do Vitest: `sleepFor` avança o relógio de parede sem disparar os
      timers, que é exatamente o que uma suspensão faz. A seção `the first tick after starting` é a regressão do bug do `last`.

````ts
// src/core/suspend.test.ts
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { Suspend } from "./suspend";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Simulates the machine sleeping: the wall clock jumps while the timers stay put. */
const sleepFor = (milliseconds: number) => vi.setSystemTime(Date.now() + milliseconds);

describe("construction", () => {
  it("defaults to a 3 s threshold checked every 1 s", () => {
    const suspend = new Suspend();
    expect(suspend.threshold).toBe(3000);
    expect(suspend.interval).toBe(1000);
  });

  it("accepts custom values", () => {
    const suspend = new Suspend({ threshold: 500, interval: 100 });
    expect(suspend.threshold).toBe(500);
    expect(suspend.interval).toBe(100);
  });

  it("rejects values that would fire constantly or never", () => {
    expect(() => new Suspend({ interval: 0 })).toThrow(RangeError);
    expect(() => new Suspend({ interval: -5 })).toThrow(RangeError);
    expect(() => new Suspend({ interval: NaN })).toThrow(RangeError);
    expect(() => new Suspend({ interval: 1000, threshold: 1000 })).toThrow(RangeError);
    expect(() => new Suspend({ interval: 1000, threshold: 500 })).toThrow(RangeError);
  });
});

describe("timer lifecycle", () => {
  it("does not start a timer until there is a listener", () => {
    new Suspend();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("starts on the first listener and stops when the last one leaves", () => {
    const suspend = new Suspend();
    const offA = suspend.on(() => {});
    const offB = suspend.on(() => {});
    expect(vi.getTimerCount()).toBe(1);
    offA();
    expect(vi.getTimerCount()).toBe(1);
    offB();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("restarts when a listener is added again", () => {
    const suspend = new Suspend();
    suspend.on(() => {})();
    expect(vi.getTimerCount()).toBe(0);
    suspend.on(() => {});
    expect(vi.getTimerCount()).toBe(1);
  });

  it("unsubscribing twice is harmless", () => {
    const suspend = new Suspend();
    const off = suspend.on(() => {});
    off();
    expect(() => off()).not.toThrow();
  });
});

describe("detecting a suspension", () => {
  it("stays quiet while time flows normally", () => {
    const callback = vi.fn();
    new Suspend().on(callback);
    vi.advanceTimersByTime(30_000);
    expect(callback).not.toHaveBeenCalled();
  });

  it("calls the listener with the elapsed time after a long gap", () => {
    const callback = vi.fn();
    new Suspend().on(callback);
    sleepFor(60_000);
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledExactlyOnceWith(61_000);
  });

  it("respects a custom threshold", () => {
    const callback = vi.fn();
    new Suspend({ threshold: 200, interval: 100 }).on(callback);
    sleepFor(250);
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("does not fire for a gap at or below the threshold", () => {
    const callback = vi.fn();
    new Suspend({ threshold: 3000, interval: 1000 }).on(callback);
    sleepFor(1999);
    vi.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();
  });

  it("calls every listener", () => {
    const first = vi.fn();
    const second = vi.fn();
    const suspend = new Suspend();
    suspend.on(first);
    suspend.on(second);
    sleepFor(10_000);
    vi.advanceTimersByTime(1000);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it("keeps calling a persistent listener on every suspension", () => {
    const callback = vi.fn();
    new Suspend().on(callback);
    sleepFor(10_000);
    vi.advanceTimersByTime(1000);
    sleepFor(10_000);
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("calls a `once` listener a single time and then stops the timer", () => {
    const callback = vi.fn();
    new Suspend().on(callback, { once: true });
    sleepFor(10_000);
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("the first tick after starting", () => {
  it("does not report the time before the first listener was added", () => {
    // The legacy class took `last` at load time, so a listener added 10 minutes later was
    // told the machine had been suspended for 10 minutes.
    const suspend = new Suspend();
    sleepFor(600_000);
    const callback = vi.fn();
    suspend.on(callback);
    vi.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();
  });

  it("does not report the time while there were no listeners", () => {
    const suspend = new Suspend();
    suspend.on(() => {})();
    sleepFor(600_000);
    const callback = vi.fn();
    suspend.on(callback);
    vi.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();
  });
});

describe("listeners that misbehave", () => {
  it("runs the other listeners when one throws, then surfaces the error", () => {
    const survivor = vi.fn();
    const suspend = new Suspend();
    suspend.on(() => {
      throw new Error("boom");
    });
    suspend.on(survivor);
    sleepFor(10_000);
    expect(() => vi.advanceTimersByTime(1000)).toThrow("boom");
    expect(survivor).toHaveBeenCalledOnce();
  });

  it("wraps several errors in an AggregateError", () => {
    const suspend = new Suspend();
    suspend.on(() => {
      throw new Error("one");
    });
    suspend.on(() => {
      throw new Error("two");
    });
    sleepFor(10_000);
    expect(() => vi.advanceTimersByTime(1000)).toThrow(AggregateError);
  });

  it("does not call a listener that an earlier one removed", () => {
    const suspend = new Suspend();
    const late = vi.fn();
    let removeLate = () => {};
    suspend.on(() => removeLate());
    removeLate = suspend.on(late);
    sleepFor(10_000);
    vi.advanceTimersByTime(1000);
    expect(late).not.toHaveBeenCalled();
  });
});

describe("dispose", () => {
  it("stops the timer and drops every listener", () => {
    const callback = vi.fn();
    const suspend = new Suspend();
    suspend.on(callback);
    suspend.dispose();
    expect(vi.getTimerCount()).toBe(0);
    sleepFor(10_000);
    vi.advanceTimersByTime(5000);
    expect(callback).not.toHaveBeenCalled();
  });

  it("can be called more than once", () => {
    const suspend = new Suspend();
    suspend.dispose();
    expect(() => suspend.dispose()).not.toThrow();
  });

  it("refuses new listeners afterwards", () => {
    const suspend = new Suspend();
    suspend.dispose();
    expect(() => suspend.on(() => {})).toThrow("disposed");
  });

  it("stops listeners from inside a callback without skipping the cleanup", () => {
    const suspend = new Suspend();
    const after = vi.fn();
    suspend.on(() => suspend.dispose());
    suspend.on(after);
    sleepFor(10_000);
    vi.advanceTimersByTime(1000);
    expect(after).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("runtime differences", () => {
  it("unrefs the timer when the runtime supports it, so it cannot keep Node alive", () => {
    vi.useRealTimers();
    const unref = vi.fn();
    const clear = vi.fn();
    vi.stubGlobal("setInterval", () => ({ unref }));
    vi.stubGlobal("clearInterval", clear);
    const off = new Suspend().on(() => {});
    expect(unref).toHaveBeenCalledOnce();
    off();
    expect(clear).toHaveBeenCalledOnce();
  });

  it("works with timer handles that are plain numbers (browsers)", () => {
    vi.useRealTimers();
    const clear = vi.fn();
    vi.stubGlobal("setInterval", () => 42);
    vi.stubGlobal("clearInterval", clear);
    const off = new Suspend().on(() => {});
    off();
    expect(clear).toHaveBeenCalledWith(42);
  });

  it("explains itself when there are no timers", () => {
    vi.stubGlobal("setInterval", undefined);
    expect(() => new Suspend().on(() => {})).toThrow("setInterval");
  });
});

describe("types", () => {
  it("returns an unsubscribe function and passes the elapsed time", () => {
    const suspend = new Suspend();
    const off = suspend.on((elapsed) => {
      expectTypeOf(elapsed).toEqualTypeOf<number>();
    });
    expectTypeOf(off).toEqualTypeOf<() => void>();
    off();
  });
});
````

- [ ] **Step 2: Ver falhar (RED).**

```bash
npx vitest run --project core src/core/suspend.test.ts 2>&1 | grep -E "Cannot find|Test Files"
```

Esperado: `Error: Cannot find module './suspend'`.

- [ ] **Step 3: Implementar.** O timer é iniciado **antes** de registrar o listener, para que uma falha ao iniciar (sem
      `setInterval`) não deixe estado pela metade.

````ts
// src/core/suspend.ts
import { host } from "./internal/host";

/**
 * Called after a suspension was detected.
 *
 * @param elapsed - Milliseconds since the previous check, which is far more than the
 *   interval when the machine or tab was suspended.
 */
export type SuspendCallback = (elapsed: number) => void;

/** Options for {@link Suspend}. */
export interface SuspendOptions {
  /** A gap between two checks longer than this counts as a suspension (ms). Defaults to `3000`. */
  threshold?: number;
  /** How often the clock is checked (ms). Defaults to `1000`. */
  interval?: number;
}

interface Listener {
  callback: SuspendCallback;
  once: boolean;
}

/**
 * Detects that the process, tab or machine was suspended (laptop lid closed, tab frozen,
 * container paused) by noticing that a timer fired much later than it should have. Use it to
 * reconnect sockets, refresh stale data or resync clocks after a wake-up.
 *
 * The check timer runs only while there are listeners, and in Node it does not keep the
 * process alive. It reads the wall clock (`Date.now()`), so changing the system clock by hand
 * can look like a suspension.
 *
 * @example
 * ```ts
 * const suspend = new Suspend({ threshold: 5000 });
 * const off = suspend.on((elapsed) => {
 *   console.log(`Woke up after ${elapsed} ms`);
 *   reconnect();
 * });
 *
 * off(); // stop listening
 * suspend.dispose(); // or tear everything down
 * ```
 */
export class Suspend {
  /** A gap between two checks longer than this counts as a suspension (ms). */
  readonly threshold: number;
  /** How often the clock is checked (ms). */
  readonly interval: number;

  readonly #listeners = new Set<Listener>();
  #timer: unknown = undefined;
  #running = false;
  #last = 0;
  #disposed = false;

  /**
   * Creates a detector. Nothing runs until the first listener is added.
   *
   * @param options - The threshold and the check interval.
   * @throws {RangeError} When `interval` is not positive or `threshold` is not greater than
   *   `interval` (a threshold at or below the interval would fire constantly).
   */
  constructor({ threshold = 3000, interval = 1000 }: SuspendOptions = {}) {
    if (!(interval > 0) || !(threshold > interval)) {
      throw new RangeError(
        `Suspend needs 0 < interval < threshold, got interval ${interval} and threshold ${threshold}.`,
      );
    }
    this.threshold = threshold;
    this.interval = interval;
  }

  /**
   * Listens for suspensions. The first listener starts the timer, and removing the last one
   * stops it.
   *
   * @example
   * ```ts
   * const off = suspend.on((elapsed) => console.log(elapsed), { once: true });
   * ```
   *
   * @param callback - Called with the elapsed time (ms) when a suspension is detected.
   * @param options - `once: true` removes the listener after its first call.
   * @returns A function that removes this listener. Calling it again does nothing.
   * @throws {Error} When the detector was disposed, or the runtime has no `setInterval`.
   */
  on(callback: SuspendCallback, { once = false }: { once?: boolean } = {}): () => void {
    if (this.#disposed) throw new Error("This Suspend has been disposed.");
    if (!this.#running) this.#start();

    const listener: Listener = { callback, once };
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size === 0) this.#stop();
    };
  }

  /**
   * Stops the timer and removes every listener. The detector cannot be used afterwards.
   * Calling it more than once is harmless.
   *
   * @example
   * ```ts
   * suspend.dispose();
   * ```
   */
  dispose(): void {
    this.#disposed = true;
    this.#listeners.clear();
    this.#stop();
  }

  #start(): void {
    const timers = host();
    if (!timers.setInterval) throw new Error("setInterval is not available in this runtime.");

    // Measure from now, not from when the class loaded: otherwise a listener added long
    // after startup would be told the machine had just been suspended.
    this.#last = Date.now();
    this.#timer = timers.setInterval(() => this.#tick(), this.interval);
    this.#running = true;
    // In Node the handle has unref(): a detector must never keep the process alive.
    (this.#timer as { unref?: () => void } | null)?.unref?.();
  }

  #stop(): void {
    if (!this.#running) return;
    this.#running = false;
    host().clearInterval?.(this.#timer);
    this.#timer = undefined;
  }

  #tick(): void {
    const now = Date.now();
    const elapsed = now - this.#last;
    this.#last = now;
    if (elapsed <= this.threshold) return;

    const errors: unknown[] = [];
    for (const listener of [...this.#listeners]) {
      // An earlier listener may have removed this one, or disposed the detector.
      if (!this.#listeners.has(listener)) continue;
      if (listener.once) this.#listeners.delete(listener);
      try {
        listener.callback(elapsed);
      } catch (error) {
        errors.push(error);
      }
    }
    if (this.#listeners.size === 0) this.#stop();

    // Let every listener run first, then surface the failure as one uncaught error.
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, "Several Suspend listeners threw.");
  }
}
````

- [ ] **Step 4: Ver passar (GREEN).**

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run --project core src/core/suspend.test.ts
```

Esperado: `Tests  27 passed (27)`.

- [ ] **Step 5: Provar que o teste pega o bug legado do `last`.**

```bash
cp src/core/suspend.ts /tmp/suspend.bak
sed -i 's/    this.#last = Date.now();//' src/core/suspend.ts
npx vitest run --project core src/core/suspend.test.ts 2>&1 | grep -E "^ +×"
cp /tmp/suspend.bak src/core/suspend.ts && git status --short
```

Esperado: falham `does not report the time before the first listener was added` e
`does not report the time while there were no listeners`; depois do `cp` só restam os arquivos novos desta task.

- [ ] **Step 6: Commit.**

```bash
git add src/core/suspend.ts src/core/suspend.test.ts
git commit -q -m "feat: rebuild Suspend as an instance that runs in any runtime" \
  -m "No window access, unref'd timer, configurable threshold and interval, listener errors isolated, and last is reset on start (the legacy class reported phantom suspensions)." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Barrel da raiz

**Files:** substituir `src/index.ts` e `src/index.test.ts`.

- [ ] **Step 1: Escrever o teste primeiro.** A lista de exports ganha `Random`, `random`, `StringBuilder` e `Suspend`. O teste ordena
      os dois lados porque `Array.prototype.sort` põe maiúsculas antes de minúsculas.

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
    const expected = [
      "alias",
      "clamp",
      "coalesce",
      "fabricate",
      "isNumeric",
      "lerp",
      "noop",
      "Random",
      "random",
      "ratio",
      "remap",
      "splitWords",
      "StringBuilder",
      "Suspend",
      "toCamelCase",
      "toKebabCase",
      "toNumber",
      "toPascalCase",
      "toSnakeCase",
      "traceHierarchy",
    ];
    expect(Object.keys(root).sort()).toEqual(expected.sort());
  });
});
````

- [ ] **Step 2: Ver falhar (RED).**

```bash
npx vitest run --project core src/index.test.ts 2>&1 | grep -E "exposes exactly|Tests "
```

Esperado: `exposes exactly the intended public API` falha (a raiz ainda não exporta as quatro).

- [ ] **Step 3: Implementar.**

````ts
// src/index.ts
export { alias } from "./core/alias";
export { clamp, lerp, ratio, remap } from "./core/number";
export { coalesce } from "./core/nullish";
export { fabricate } from "./core/fabricate";
export { isNumeric, toNumber } from "./core/numeric";
export { noop } from "./core/noop";
export { Random, random } from "./core/random";
export { splitWords, toCamelCase, toKebabCase, toPascalCase, toSnakeCase } from "./core/string";
export { StringBuilder } from "./core/string-builder";
export type { StringBuilderOptions } from "./core/string-builder";
export { Suspend } from "./core/suspend";
export type { SuspendCallback, SuspendOptions } from "./core/suspend";
export { traceHierarchy } from "./core/tree";
export type { AnyString, Maybe, Nullable, Numeric } from "./core/types";
````

- [ ] **Step 4: Ver passar (GREEN) e rodar a suíte inteira.**

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run --coverage
```

Esperado: `Test Files  15 passed (15)`, `Tests  224 passed (224)`, nenhuma linha de cobertura listada (todos os arquivos em 100%) e
nenhum erro de `threshold`.

- [ ] **Step 5: Commit.**

```bash
git add src/index.ts src/index.test.ts
git commit -q -m "feat: export Random, StringBuilder and Suspend from the root entrypoint" \
  -m "Also exports the option and callback types that appear in their signatures." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Orçamento de tamanho por classe

**Files:** modificar `package.json`.

- [ ] **Step 1: Substituir o `size-limit`.** Cinco limites: o entrypoint inteiro e uma importação isolada de `clamp`, `Random`,
      `StringBuilder` e `Suspend`. O de `clamp` prova que a instância `random`, criada no import, não impede o tree-shaking.

```bash
npm pkg set --json size-limit='[{"name":"root entrypoint, everything","path":"dist/index.js","import":"*","limit":"4 kB"},{"name":"root entrypoint, clamp only","path":"dist/index.js","import":"{ clamp }","limit":"150 B"},{"name":"root entrypoint, Random only","path":"dist/index.js","import":"{ Random }","limit":"1.7 kB"},{"name":"root entrypoint, StringBuilder only","path":"dist/index.js","import":"{ StringBuilder }","limit":"400 B"},{"name":"root entrypoint, Suspend only","path":"dist/index.js","import":"{ Suspend }","limit":"700 B"}]'
npx prettier --write package.json
```

- [ ] **Step 2: Medir.**

```bash
npm run build && npm run size
```

Esperado (medido no clone de validação; podem variar poucos bytes): núcleo inteiro **~2,72 kB**, `clamp` **~76 B**, `Random`
**~1,18 kB**, `StringBuilder` **~254 B**, `Suspend` **~494 B**, todos abaixo dos limites.

- [ ] **Step 3: Provar que estourar o limite quebra.**

```bash
cp package.json /tmp/package.json.bak
sed -i 's/"limit": "150 B"/"limit": "50 B"/' package.json
npm run size 2>&1 | grep -E "exceeded"; npx size-limit >/dev/null 2>&1; echo "exit=$?"
cp /tmp/package.json.bak package.json
```

Esperado: `Package size limit has exceeded by ... B` e `exit=1`.

- [ ] **Step 4: Commit.**

```bash
git add package.json
git commit -q -m "build: budget the bundle size of each class separately" \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Smoke test com determinismo entre runtimes, e CONTRIBUTING

**Files:** substituir `scripts/smoke.mjs` e `CONTRIBUTING.md`.

- [ ] **Step 1: Substituir `scripts/smoke.mjs`.** Ganha o consumidor TypeScript com a API nova (`Random`, `random`, `StringBuilder`,
      `Suspend`, mais duas linhas `@ts-expect-error`) e a **checagem de determinismo**: uma seed fixa precisa dar exatamente o mesmo
      resultado em Node ESM, Node CJS e nos runtimes extras (Deno e Bun). Como Deno e Node usam V8, o Bun (JavaScriptCore) no CI é a
      prova entre engines.

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

// The determinism contract: a seed gives the same output in every runtime and module format.
// These values must never change without a major version.
const SEEDED =
  '(() => { const r = new Random("hyrax"); return [r.int(1, 100), r.uuid()].join(" "); })()';
const SEEDED_EXPECTED = "26 627a9f02-43de-4af3-acb3-e143723b09c5";

// A real TypeScript consumer of the public API. `@ts-expect-error` lines make the
// compile fail if the types ever become looser than intended.
const CONSUMER = `
import { alias, clamp, fabricate, isNumeric, random, Random, StringBuilder, Suspend, toCamelCase, traceHierarchy } from "${NAME}";
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

export const roll: number = new Random("seed").int(1, 6);
export const pick: string | undefined = random.from(["a", "b"]);
export const classes: string = new StringBuilder().append("btn").if(true, "on").build();
export const stop: () => void = new Suspend().on((elapsed: number) => void elapsed);

// @ts-expect-error int needs both bounds
new Random("seed").int(1);
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

  const seededEsm = run(
    "node",
    ["--input-type=module", "-e", `import { Random } from "${NAME}"; console.log(${SEEDED});`],
    dir,
  ).trim();
  const seededCjs = run(
    "node",
    ["-e", `const { Random } = require("${NAME}"); console.log(${SEEDED});`],
    dir,
  ).trim();
  if (seededEsm !== SEEDED_EXPECTED || seededCjs !== SEEDED_EXPECTED) {
    throw new Error(
      `Seeded output changed: ESM "${seededEsm}", CJS "${seededCjs}", expected "${SEEDED_EXPECTED}"`,
    );
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
    if (m0.clamp(15, 10) !== 10) throw new Error("clamp broken");
    const { Random } = m0;
    const seeded = ${SEEDED};
    if (seeded !== "${SEEDED_EXPECTED}") throw new Error("seeded output differs: " + seeded);`;
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

- [ ] **Step 2: Substituir `CONTRIBUTING.md`.** Ganha a regra sobre o que o lint cobre (exportados; membros privados e `internal/`
      isentos; `@example` na própria classe).

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
- The lint rules apply to what is exported. Private members (`#field`, `private`) and everything under
  `src/core/internal/` are exempt. A class needs an `@example` on the class itself; document each public
  method with `@param` and `@returns`.
- Write examples as one statement per line with the result in a trailing `// => value` comment. A later phase
  runs these examples as tests, so keep them exact.
- Signed zero is not a meaningful difference in `number` helpers: compare with `===`, not `Object.is`, in tests.
````

- [ ] **Step 3: Rodar, e provar que o valor de referência é verificado.**

```bash
npm run build
npm run smoke
HYRAX_SMOKE_RUNTIMES=deno node scripts/smoke.mjs
sed 's/"26 627a9f02/"27 627a9f02/' scripts/smoke.mjs > scripts/smoke.bad.mjs
node scripts/smoke.bad.mjs 2>&1 | grep -oE "Seeded output changed.{0,70}" | head -1; rm scripts/smoke.bad.mjs
```

Esperado: `Smoke test passed: 3 entrypoints x (ESM + CJS) + consumer types`; a segunda termina em
`... + consumer types + deno` (pule se o Deno não estiver instalado); a variante com o valor errado imprime
`Seeded output changed: ESM "26 627a9f02-...`.

- [ ] **Step 4: Formatar e commitar.**

```bash
npx prettier --write scripts CONTRIBUTING.md && npm run format:check
git add scripts/smoke.mjs CONTRIBUTING.md
git commit -q -m "test: check seeded output across runtimes and type-check the new API" \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Verificação final e PR

- [ ] **Step 1: Instalação limpa, como o CI faz.**

```bash
rm -rf node_modules dist coverage
npm ci
npm run check
```

Esperado: código 0, com `Test Files  15 passed (15)` / `Tests  224 passed (224)`, `publint` (`All good!`), os cinco limites do
`size-limit` e `Smoke test passed: 3 entrypoints x (ESM + CJS) + consumer types`.

- [ ] **Step 2: Estabilidade.** Os testes de propriedade e os de tempo simulado precisam ser estáveis.

```bash
fails=0; for i in $(seq 1 15); do npx vitest run --project core >/dev/null 2>&1 || fails=$((fails+1)); done; echo "falhas: $fails de 15"
```

Esperado: `falhas: 0 de 15`. Uma falha é um contraexemplo real: leia a semente na saída de `npx vitest run --project core` e decida se
o defeito é da função ou do teste.

- [ ] **Step 3: Conferir a árvore.**

```bash
git status --short && git log --oneline main..HEAD
```

Esperado: nenhum arquivo pendente. Se a Fase 1 já está no `main`, são 9 commits (o plano mais as Tasks 1 a 8).

- [ ] **Step 4: Checklist de aceitação da Fase 2.**

  - [ ] `npm run check` passa a partir de instalação limpa
  - [ ] A raiz exporta as 20 funções e classes esperadas (as 16 da Fase 1 mais `Random`, `random`, `StringBuilder`, `Suspend`) e os
        tipos `StringBuilderOptions`, `SuspendCallback`, `SuspendOptions`, e nada além (o teste da superfície pública garante)
  - [ ] Cobertura de `src/core` em 100%
  - [ ] Nenhum uso de `window`, `document`, `process` ou `require` em `src/core`, fora dos testes e dos comentários. O comando
        abaixo deve sair **vazio** (a palavra "process" aparece em comentários do `Suspend`, por isso o filtro de comentários):

```bash
grep -rEn '\b(window|document|process|require)\b' src/core --include='*.ts' | grep -v '\.test\.ts' | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)'
```

  - [ ] `size-limit` passa, e importar só `clamp` continua custando ~76 B
  - [ ] O smoke test dá a mesma saída seedada em Node ESM, Node CJS, Deno e Bun (no CI)
  - [ ] Nenhum bug legado reaparece: `Random` (viés, cache, `uuid`), `Suspend` (`last`, `window`), `StringBuilder` (prefixo)

- [ ] **Step 5: Parar aqui e pedir autorização ao usuário** antes de `git push` e de abrir o PR. Depois do push, acompanhe o CI com
      `gh pr checks <número> --watch`. Para conferir o `runtimes` de verdade, pegue o ID do job pelo link do check
      (`gh pr checks <número> --json name,link`) e leia a linha final do smoke no log: o job é `continue-on-error`, e o **Bun** é
      quem confirma o determinismo entre engines.

---

## Notas para as próximas fases

1. **Fase 5 (docs).** O script de exemplos do TSDoc precisa tratar blocos multilinha (`fabricate`, `alias`, `Suspend`) e exemplos com
   resultado não determinístico (`random.int(1, 6)`), que devem ser marcados para execução só de tipos.
2. **Contrato de determinismo.** Os vetores de `random.test.ts` e o valor fixo do `scripts/smoke.mjs` são a documentação executável
   do contrato. Qualquer mudança neles exige um novo major.
3. **`AggregateError`** exige `lib: ES2021` ou superior: já está coberto pelo `ES2022` do `core`.
