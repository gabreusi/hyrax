# Hyrax Fase 2 (núcleo, classes): plano de implementação

Spec: `docs/superpowers/specs/2026-09-18-hyrax-revival-design.md` (seção 4, com o `Random` revisto em 2026-09-19). Fases anteriores: `docs/superpowers/plans/2026-09-18-phase-0-foundation.md` e `docs/superpowers/plans/2026-09-19-phase-1-core-pure-functions.md`.

**Objetivo.** Implementar as três classes do núcleo: `Random` (com modo seguro, `luck`, `fork`, `state` e `restore`, viés zero e os extras `weighted`, `sample`, `normal`, `exponential`, `roll`, `bytes` e `token`), `StringBuilder` e `Suspend`. Todas universais (sem `window`, `document` nem tipos do Node), com TSDoc completo, testes (exaustivos, de propriedade, estatísticos, de tempo simulado e de tipos) e cobertura de 100%.

**Arquitetura.** `random-base.ts` (classe abstrata com todos os métodos de sorteio), `random.ts` (`Random`) e `secure-random.ts` (`SecureRandom`). Em `src/core/internal/`, fora da API: `host.ts`, `engines.ts`, `luck.ts`, `float.ts`, `dice.ts` e `scripted.ts` (o motor roteirizado dos testes). Só `src/index.ts` reúne tudo.

**Fora desta fase:** `/dom` (Fase 3), `/react` (Fase 4), docs (Fase 5), release (Fase 6).

## Ponto de partida

Esta fase parte do `main` com a Fase 1 já mergeada (PR #25). Se o PR #25 ainda estiver aberto, a branch desta fase (`phase-2-core-classes`) nasce da `phase-1-core-pure-functions`: como o merge do #25 é um commit de merge, os commits da Fase 1 passam a fazer parte do `main` e o PR desta fase mostra só os commits novos.

## Todo o plano foi validado antes de ser escrito

Implementei tudo num clone descartável e depois **repeti as tasks deste plano, na ordem, num clone limpo**, com o RED e o GREEN de cada uma: o `npm run check` termina com código 0, com **23 arquivos, 346 testes, cobertura de 100% no `core`**, 0 falhas em 25 execuções da suíte (que usa propriedades e estatística com sementes novas), e os arquivos finais do clone são idênticos aos validados. Reintroduzi seis defeitos que o desenho existe para evitar e provei que os testes os pegam (Tasks 4, 5 e 7).

### O que a implementação encontrou (já refletido nos arquivos abaixo)

| Achado | Consequência |
|---|---|
| **`luck` negativo perdia precisão.** `1 - (1-u)^p` empurrava um `u` minúsculo (5,5·10⁻¹⁷) para **cima** (1,1·10⁻¹⁶), porque `1 - u` só existe em passos de 2⁻⁵³. O `fast-check` achou o contraexemplo | `luck.ts` usa `-expm1(log1p(-u) / (1 - luck))` |
| **Sem o limite de `MAX_UNIT`, o `luck` chega a `1.0`** (com `luck >= 2` e o maior sorteio), o que faria `int` sair do intervalo e `float` devolver `max` | `lucky` limita a `MAX_UNIT`; teste com sorteios roteirizados nos extremos |
| **`float` precisa de `nextDown` para ser monótono.** Numa faixa minúscula em magnitude grande (`float(1e9, 1e9 + 1)`), arredondar cai em `max`, e a saída natural seria `min`: um `luck` positivo devolveria o menor valor | `float` devolve o maior `double` abaixo de `max` |
| **O dublê de teste que cicla palavras trava para sempre** contra a rejeição do `int` (`0xFFFFFFFF` >>> 27 = 31, sempre ≥ 20). Prendeu o Vitest por 5 minutos | `scripted()` **lança erro quando as palavras acabam**; a regra vai para o CONTRIBUTING |
| **O tamanho de `clamp` isolado subiu de 76 B para 238 B.** Chamadas de topo (`new Float64Array`, `Array.from`, `new Map`, `2 ** 53`) sobrevivem ao tree-shaking. `/* @__PURE__ */` resolveu só parcialmente e não é honrado por todo empacotador | **Nenhum trabalho no nível do módulo**: inicialização na primeira chamada e constantes literais. Voltou a 76 B no `rolldown` e no `esbuild`. O limite de 150 B para `clamp` é o guarda |
| **O ECMAScript não exige o mesmo último bit de `Math.pow`, `Math.log` e `Math.cos` em todo motor.** Então `luck` diferente de zero, `normal` e `exponential` não têm igualdade *formal* entre runtimes | O smoke separa `EXACT` (caminhos inteiros, bit a bit em todo lugar) de `TRANSCENDENTAL`, com mensagem própria. O Bun (JavaScriptCore) no CI é a primeira comparação real entre motores |
| **`weighted`: a soma acumulada nunca arredonda para o total**, então o ponto sorteado é sempre menor que ele. Não existe o caso de "estourar o fim da lista" | Laço sem ramo de contingência (que ficaria sem cobertura); teste garante que peso 0 nunca sai, em qualquer sorteio e `luck` |
| **`roll` reanalisava a notação a cada chamada** (855 ns) | Cache pequeno e **limitado** (100 entradas, esvaziado ao encher): 265 ns, 3,2× mais rápido |
| **O custo real do `Random` é 3,15 kB**, e os cinco extras somam **0,92 kB** (o núcleo sozinho é 2,23 kB). O protótipo que sustentou "métodos na classe" tinha dado 1,56 kB | Registrado no spec. Se o peso incomodar, mover os extras para funções tree-shakeable não muda nenhuma saída |
| A média teórica do menor de dois d20 é 7,175 e um limite de teste estava em 7,2 | Os testes estatísticos comparam com a **teoria** (cálculo escrito ao lado), nunca com o que o código produz |

### Decisões de implementação (o desenho está no spec; estas são as do código)

1. **`RandomBase` abstrata com duas subclasses irmãs**, `Random` e `SecureRandom`, em vez de uma classe com um `token` que lança erro: assim `rng.token()` **não compila** num gerador com seed e `secure.state()` também não. `SecureRandom` sai do barrel só como tipo.
2. **`Random` aceita `new Random(seed)` ou `new Random({ seed, luck })`.** Um número vale como a sua forma em string.
3. **`RandomState` tem `version: 1`**, e `restore` valida: `TypeError` para formato, `RangeError` para versão ou `luck`.
4. **`fork` só aceita strings e números finitos** como chaves (JSON transformaria `NaN` em `null`, e duas chaves diferentes colidiriam).
5. **`roll`:** no máximo 1000 dados por notação e 10⁹ lados; constantes precisam ser inteiros seguros.
6. **`date` usa o sorteio justo** (não o `int`, que é afetado por `luck`) e aceita intervalos de até 2⁵³ ms.
7. **`weighted` sobre objeto:** as chaves seguem a ordem do JavaScript, que põe as inteiras (`"1"`) primeiro. Documentado.
8. **`Suspend` e `StringBuilder`** ficam exatamente como no plano anterior (Tasks 8 e 9): exigem `0 < interval < threshold`, `on` depois de `dispose()` lança erro, `else` fecha a cadeia.
9. **Tipos exportados:** `RandomOptions`, `RandomState`, `SecureRandom`, `StringBuilderOptions`, `SuspendOptions` e `SuspendCallback`.

### Como executar

Executadas na ordem (as Tasks 4, 5, 6 e 7 evoluem os mesmos arquivos, então **não dá para paralelizá-las**). A Task 8 (`StringBuilder`) e a Task 9 (`Suspend`) são independentes entre si e do `Random`. Os blocos de arquivo usam cercas de quatro crases porque o TSDoc contém blocos de três. Para sobrescrever um arquivo existente, leia-o antes. **Nunca use `git checkout -- .` para "limpar" a árvore durante o plano**: ele reverte todas as edições ainda não commitadas.

---

## Task 1: Branch, linha de base e lint para classes e código interno

**Files:** modificar `eslint.config.js`.

- [ ] **Step 1: Entrar na branch e conferir a linha de base.**

```bash
cd /home/gabriel/Desktop/hyrax
git switch phase-2-core-classes   # já contém este plano; em um clone novo: git switch main && git pull --ff-only origin main && git switch -c phase-2-core-classes
npm ci
npm run check
```

Esperado: código 0 (linha de base da Fase 1: 12 arquivos, 127 testes).

- [ ] **Step 2: Substituir `eslint.config.js`.** Mudanças em relação à Fase 1: o bloco de TSDoc ignora `**/internal/**`, e `jsdoc/require-example` passa a olhar só declarações **exportadas** (funções, assinaturas de overload e classes).

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

Esperado (4 erros): `tmp-a.ts 1:1 Missing JSDoc @example`; `tmp-b.ts 1:8 Missing JSDoc comment`; `tmp-c.ts 1:1 Missing JSDoc @example` (a classe) e `tmp-c.ts 12:8 Missing JSDoc comment` (o `export const`). A função `internalHelper`, não exportada, **não** é acusada.

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

- [ ] **Step 1: Criar o helper.** Sem teste próprio: é exercitado pelos testes de `Suspend` e do motor, e a cobertura de 100% garante que nenhuma linha dele fica de fora. O `core` não tem tipos para `setInterval` nem `crypto` (compila só com a lib `ES2022`), e em vez de declarações ambiente (que poderiam conflitar com as libs DOM e Node quando o `core` é importado por `/dom`) ele lê as globais via `globalThis`, no momento da chamada.

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

## Task 3: Os internos do `Random`: `float`, `luck`, `engines`, `dice`

**Files:** criar, em `src/core/internal/`, `float.ts`, `luck.ts`, `engines.ts`, `dice.ts` e um `*.test.ts` de cada.

Quatro peças pequenas e independentes. Cada uma segue o ciclo teste, RED, implementação, GREEN.

### 3a. `float` e `luck`

- [ ] **Step 1: Escrever os testes primeiro.** Os testes de propriedade do `luck` incluem `noNaN: true` no gerador: sem isso o `fast-check` sorteia `NaN` e o teste falha por defeito próprio.

````ts
// src/core/internal/float.test.ts
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_UNIT, nextDown } from "./float";

describe("MAX_UNIT", () => {
  it("is the largest double below 1", () => {
    expect(MAX_UNIT).toBe(1 - 2 ** -53);
    expect(MAX_UNIT).toBeLessThan(1);
    expect(nextDown(1)).toBe(MAX_UNIT);
  });
});

describe("nextDown", () => {
  it("returns the largest double strictly below a positive number", () => {
    expect(nextDown(1)).toBe(1 - 2 ** -53);
    expect(nextDown(2)).toBe(2 - 2 ** -52);
    expect(nextDown(5)).toBeLessThan(5);
    expect(nextDown(Number.MIN_VALUE)).toBe(0);
  });

  it("handles zero and negative numbers", () => {
    expect(nextDown(0)).toBe(-Number.MIN_VALUE);
    expect(nextDown(-1)).toBeLessThan(-1);
    expect(nextDown(-1)).toBe(-1 - 2 ** -52);
  });

  it("leaves no double in between", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (x) => {
        fc.pre(x > -Number.MAX_VALUE);
        const down = nextDown(x);
        expect(down).toBeLessThan(x);
        // The midpoint of two adjacent doubles rounds to one of them, never to a third.
        const midpoint = down / 2 + x / 2;
        expect(midpoint === down || midpoint === x).toBe(true);
      }),
    );
  });
});
````

````ts
// src/core/internal/luck.test.ts
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_UNIT } from "./float";
import { lucky } from "./luck";

const unit = fc.double({ min: 0, max: MAX_UNIT, noNaN: true });

describe("lucky", () => {
  it("is the identity when luck is 0", () => {
    fc.assert(
      fc.property(unit, (u) => {
        expect(lucky(u, 0)).toBe(u);
      }),
    );
  });

  it("matches the closed forms (best of n+1, worst of n+1)", () => {
    expect(lucky(0.25, 1)).toBeCloseTo(Math.sqrt(0.25), 12);
    expect(lucky(0.25, 3)).toBeCloseTo(0.25 ** (1 / 4), 12);
    expect(lucky(0.75, -1)).toBeCloseTo(1 - Math.sqrt(0.25), 12);
  });

  it("pushes results up for positive luck and down for negative luck", () => {
    fc.assert(
      fc.property(unit, fc.double({ min: 0.001, max: 20, noNaN: true }), (u, luck) => {
        expect(lucky(u, luck)).toBeGreaterThanOrEqual(u);
        expect(lucky(u, -luck)).toBeLessThanOrEqual(u);
      }),
    );
  });

  it("never decreases when luck increases (up to one rounding step)", () => {
    fc.assert(
      fc.property(
        unit,
        fc.double({ min: -20, max: 20, noNaN: true }),
        fc.double({ min: 1e-6, max: 20, noNaN: true }),
        (u, luck, extra) => {
          expect(lucky(u, luck + extra)).toBeGreaterThanOrEqual(lucky(u, luck) - 2 ** -52);
        },
      ),
    );
  });

  it("stays inside [0, 1) even for extreme luck and the largest possible draw", () => {
    // Without the clamp, u ** (1 / (1 + luck)) rounds up to exactly 1 from luck 2 on.
    for (const luck of [2, 10, 1000, 1e9, Number.MAX_VALUE]) {
      expect(lucky(MAX_UNIT, luck)).toBeLessThan(1);
      expect(lucky(MAX_UNIT, luck)).toBeLessThanOrEqual(MAX_UNIT);
    }
    for (const luck of [-2, -10, -1000, -1e9]) {
      expect(lucky(0, luck)).toBe(0);
      expect(lucky(MAX_UNIT, luck)).toBeGreaterThanOrEqual(0);
    }
  });

  it("always returns a value in [0, MAX_UNIT]", () => {
    fc.assert(
      fc.property(unit, fc.double({ min: -1e6, max: 1e6, noNaN: true }), (u, luck) => {
        const value = lucky(u, luck);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(MAX_UNIT);
      }),
    );
  });
});
````

- [ ] **Step 2: Ver falhar (RED).**

```bash
npx vitest run --project core src/core/internal/float.test.ts src/core/internal/luck.test.ts 2>&1 | grep -E "Cannot find module|Test Files"
```

Esperado: `Cannot find module './float'` e `Test Files  2 failed (2)`.

- [ ] **Step 3: Implementar.** `nextDown` cria os arrays tipados na primeira chamada, e `MAX_UNIT` é um literal: nenhum trabalho no nível do módulo.

````ts
// src/core/internal/float.ts
/** The largest double below 1 (`1 - 2 ** -53`): the top of the range every unit draw lives in. */
export const MAX_UNIT = 0.9999999999999999;

// Created on first use: a top-level call would be kept by bundlers that cannot prove it harmless,
// and would drag this file into a build that only imports `clamp`.
let scratch: { view: Float64Array; bits: BigInt64Array } | undefined;

/**
 * The largest double strictly below `value`. Callers pass finite numbers.
 *
 * @param value - A finite number.
 * @returns The double just below it.
 */
export function nextDown(value: number): number {
  if (value === 0) return -Number.MIN_VALUE;
  if (!scratch) {
    const view = new Float64Array(1);
    scratch = { view, bits: new BigInt64Array(view.buffer) };
  }
  scratch.view[0] = value;
  scratch.bits[0] = (scratch.bits[0] as bigint) + (value > 0 ? -1n : 1n);
  return scratch.view[0];
}
````

````ts
// src/core/internal/luck.ts
import { MAX_UNIT } from "./float";

/**
 * Bends a uniform draw `unit` in `[0, 1)` by `luck`: `luck >= 0` behaves like keeping the best of
 * `1 + luck` draws, `luck < 0` like keeping the worst of `1 - luck`. `luck = 0` is the identity.
 *
 * The result is clamped to `MAX_UNIT`: from luck 2 on, `unit ** (1 / (1 + luck))` rounds up to
 * exactly 1 for the largest draws, which would push `int` out of range and make `float` return `max`.
 *
 * @param unit - A uniform draw in `[0, 1)`.
 * @param luck - A finite number; `0` is neutral.
 * @returns The bent draw, in `[0, MAX_UNIT]`.
 */
export function lucky(unit: number, luck: number): number {
  if (luck === 0) return unit;
  // For luck < 0 this is 1 - (1 - unit) ** (1 / (1 - luck)), written with log1p/expm1 because `1 - unit`
  // only exists in steps of 2^-53, so the plain form pushes a tiny draw *up* instead of down.
  const value = luck > 0 ? unit ** (1 / (1 + luck)) : -Math.expm1(Math.log1p(-unit) / (1 - luck));
  return value > MAX_UNIT ? MAX_UNIT : value;
}
````

- [ ] **Step 4: Ver passar (GREEN).**

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run --project core src/core/internal/float.test.ts src/core/internal/luck.test.ts
```

Esperado: `Tests  10 passed (10)`.

### 3b. `engines`

- [ ] **Step 5: Escrever o teste primeiro.** O vetor de `keeps its published output vector` fixa as quatro primeiras palavras da seed `"hyrax"`: **mudá-las é uma quebra major.** Os testes do motor seguro trocam `crypto` por um falso.

````ts
// src/core/internal/engines.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCryptoEngine, createSeed, createSeededEngine } from "./engines";

afterEach(() => {
  vi.unstubAllGlobals();
});

const take = (engine: { next32(): number }, count: number) =>
  Array.from({ length: count }, () => engine.next32());

describe("createSeededEngine", () => {
  it("produces the same words for the same seed", () => {
    expect(take(createSeededEngine("hyrax"), 50)).toEqual(take(createSeededEngine("hyrax"), 50));
  });

  it("produces different words for different seeds", () => {
    expect(take(createSeededEngine("a"), 5)).not.toEqual(take(createSeededEngine("b"), 5));
  });

  it("returns unsigned 32-bit integers", () => {
    for (const word of take(createSeededEngine("range"), 1000)) {
      expect(Number.isInteger(word)).toBe(true);
      expect(word).toBeGreaterThanOrEqual(0);
      expect(word).toBeLessThan(2 ** 32);
    }
  });

  // Changing the algorithm is a breaking change: these words must never move.
  it("keeps its published output vector", () => {
    expect(take(createSeededEngine("hyrax"), 4)).toEqual([
      1079766753, 1013694292, 1652203266, 1138678515,
    ]);
  });

  it("snapshots and restores its state", () => {
    const engine = createSeededEngine("snap");
    take(engine, 10);
    const snapshot = engine.snapshot();
    const expected = take(engine, 20);

    const other = createSeededEngine("something else entirely");
    other.restore(snapshot);
    expect(take(other, 20)).toEqual(expected);
  });

  it("snapshots unsigned 32-bit integers, so they survive JSON", () => {
    const engine = createSeededEngine("json");
    take(engine, 7);
    const snapshot = engine.snapshot();
    expect(snapshot).toHaveLength(4);
    for (const word of snapshot) {
      expect(Number.isInteger(word)).toBe(true);
      expect(word).toBeGreaterThanOrEqual(0);
      expect(word).toBeLessThan(2 ** 32);
    }
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});

describe("createCryptoEngine", () => {
  const script = (words: number[]) => {
    let at = 0;
    const getRandomValues = vi.fn((array: Uint32Array) => {
      for (let i = 0; i < array.length; i++) array[i] = words[at++ % words.length] as number;
      return array;
    });
    vi.stubGlobal("crypto", { getRandomValues });
    return getRandomValues;
  };

  it("serves the words crypto gives it, in order", () => {
    script([1, 2, 3, 4]);
    expect(take(createCryptoEngine(), 8)).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
  });

  it("asks crypto for a whole buffer at a time and refills when it runs out", () => {
    const getRandomValues = script([7]);
    const engine = createCryptoEngine();
    expect(getRandomValues).not.toHaveBeenCalled();
    take(engine, 256);
    expect(getRandomValues).toHaveBeenCalledTimes(1);
    take(engine, 1);
    expect(getRandomValues).toHaveBeenCalledTimes(2);
  });

  it("refuses to exist without crypto instead of falling back to Math.random", () => {
    vi.stubGlobal("crypto", undefined);
    expect(() => createCryptoEngine()).toThrow("crypto.getRandomValues");
  });

  it("fails loudly if crypto disappears before a refill", () => {
    script([1]);
    const engine = createCryptoEngine();
    take(engine, 256);
    vi.stubGlobal("crypto", undefined);
    expect(() => engine.next32()).toThrow("crypto.getRandomValues");
  });
});

describe("createSeed", () => {
  it("returns 32 hex characters drawn from crypto", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (array: Uint32Array) => array.fill(0xdeadbeef),
    });
    expect(createSeed()).toBe("deadbeef".repeat(4));
  });

  it("falls back to Math.random where crypto is missing", () => {
    vi.stubGlobal("crypto", undefined);
    expect(createSeed()).toMatch(/^[0-9a-f]{32}$/);
    expect(createSeed()).not.toBe(createSeed());
  });
});
````

- [ ] **Step 6: Ver falhar (RED).**

```bash
npx vitest run --project core src/core/internal/engines.test.ts 2>&1 | grep -E "Cannot find module|Test Files"
```

Esperado: `Cannot find module './engines'`.

- [ ] **Step 7: Implementar.** O motor com seed é sfc32 semeado por cyrb128 (12 saídas descartadas). O motor seguro lê 256 palavras por chamada a `crypto.getRandomValues` (medido: 43 ns por palavra, contra 3,1 µs uma a uma) e **nunca** cai para `Math.random`.

````ts
// src/core/internal/engines.ts
import { host } from "./host";

/** A source of unsigned 32-bit words. */
export interface Engine {
  next32(): number;
}

/** The four 32-bit words of sfc32 state. */
export type EngineState = readonly [number, number, number, number];

/** An engine whose state can be saved and restored. */
export interface SeededEngine extends Engine {
  snapshot(): [number, number, number, number];
  restore(state: EngineState): void;
}

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

/**
 * sfc32 seeded through cyrb128, with 12 outputs discarded. Fast and statistically strong, but
 * **not cryptographic**: its state can be recovered from its output.
 *
 * @param seed - Any string.
 * @returns A deterministic engine.
 */
export function createSeededEngine(seed: string): SeededEngine {
  let [a, b, c, d] = cyrb128(seed);
  const next32 = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let i = 0; i < 12; i++) next32();
  return {
    next32,
    snapshot: () => [a >>> 0, b >>> 0, c >>> 0, d >>> 0],
    restore: (state) => {
      [a, b, c, d] = [state[0] | 0, state[1] | 0, state[2] | 0, state[3] | 0];
    },
  };
}

const POOL_SIZE = 256;

/**
 * Serves words from `crypto.getRandomValues`, 256 at a time (one call per word is about 70 times
 * slower). It never falls back to `Math.random`.
 *
 * @returns A cryptographically secure engine.
 * @throws {Error} When the runtime has no `crypto.getRandomValues`, now or at a later refill.
 */
export function createCryptoEngine(): Engine {
  const missing = () =>
    new Error("Random.secure() needs crypto.getRandomValues, which this runtime does not provide.");
  if (!host().crypto?.getRandomValues) throw missing();

  const pool = new Uint32Array(POOL_SIZE);
  let index = POOL_SIZE;
  return {
    next32: () => {
      if (index === POOL_SIZE) {
        const crypto = host().crypto;
        if (!crypto?.getRandomValues) throw missing();
        crypto.getRandomValues(pool);
        index = 0;
      }
      return pool[index++] as number;
    },
  };
}

/**
 * A fresh 128-bit seed as 32 hex characters, from `crypto` (or `Math.random` where it is missing).
 * Only used to seed the reproducible engine, so it makes no security promise.
 *
 * @returns The seed.
 */
export function createSeed(): string {
  const words = new Uint32Array(4);
  const crypto = host().crypto;
  if (crypto?.getRandomValues) {
    crypto.getRandomValues(words);
  } else {
    for (let i = 0; i < words.length; i++) words[i] = Math.floor(Math.random() * 4294967296);
  }
  return Array.from(words, (word) => word.toString(16).padStart(8, "0")).join("");
}
````

- [ ] **Step 8: Ver passar (GREEN).**

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run --project core src/core/internal/engines.test.ts
```

Esperado: `Tests  12 passed (12)`.

### 3c. `dice`

- [ ] **Step 9: Escrever o teste primeiro.** Cobre a gramática, os limites (1000 dados, 10⁹ lados) e o cache limitado de notações.

````ts
// src/core/internal/dice.test.ts
import { describe, expect, it } from "vitest";
import { parseDice, parseDiceCached, rollTerms } from "./dice";

/** A die that always shows its highest face. */
const highest = (sides: number) => sides;

describe("parseDice", () => {
  it("reads NdM", () => {
    expect(parseDice("2d6")).toEqual([{ sign: 1, count: 2, sides: 6 }]);
  });

  it("defaults the count to 1", () => {
    expect(parseDice("d20")).toEqual([{ sign: 1, count: 1, sides: 20 }]);
  });

  it("reads keep-highest and keep-lowest", () => {
    expect(parseDice("4d6kh3")).toEqual([
      { sign: 1, count: 4, sides: 6, keep: { highest: true, count: 3 } },
    ]);
    expect(parseDice("2d20kl1")).toEqual([
      { sign: 1, count: 2, sides: 20, keep: { highest: false, count: 1 } },
    ]);
  });

  it("reads constants and signs", () => {
    expect(parseDice("1d8+1d6-1")).toEqual([
      { sign: 1, count: 1, sides: 8 },
      { sign: 1, count: 1, sides: 6 },
      { sign: -1, constant: 1 },
    ]);
    expect(parseDice("-1d4+10")).toEqual([
      { sign: -1, count: 1, sides: 4 },
      { sign: 1, constant: 10 },
    ]);
  });

  it("ignores spaces and letter case", () => {
    expect(parseDice(" 2D6 + 3 ")).toEqual(parseDice("2d6+3"));
    expect(parseDice("4D6KH3")).toEqual(parseDice("4d6kh3"));
  });

  it("rejects notations it cannot read, pointing at the bad part", () => {
    expect(() => parseDice("")).toThrow(RangeError);
    expect(() => parseDice("   ")).toThrow(RangeError);
    expect(() => parseDice("2d")).toThrow('cannot read "2d"');
    expect(() => parseDice("abc")).toThrow('cannot read "abc"');
    expect(() => parseDice("2d6+")).toThrow(RangeError);
    expect(() => parseDice("2d6++1")).toThrow(RangeError);
    expect(() => parseDice("2d6x3")).toThrow('cannot read "2d6x3"');
  });

  it("rejects impossible dice", () => {
    expect(() => parseDice("0d6")).toThrow("at least one die");
    expect(() => parseDice("2d0")).toThrow("at least 1 side");
    expect(() => parseDice("2d6kh3")).toThrow("cannot keep 3 of 2");
    expect(() => parseDice("2d6kh0")).toThrow("keep at least one");
  });

  it("caps the total number of dice", () => {
    expect(() => parseDice("1000d6")).not.toThrow();
    expect(() => parseDice("1001d6")).toThrow("at most 1000 dice");
    expect(() => parseDice("600d6+600d6")).toThrow("at most 1000 dice");
  });

  it("caps the number of sides and the size of constants", () => {
    expect(() => parseDice("1d1000000000")).not.toThrow();
    expect(() => parseDice("1d1000000001")).toThrow("sides");
    expect(() => parseDice("99999999999999999999")).toThrow(RangeError);
  });
});

describe("rollTerms", () => {
  it("sums the dice and the constants", () => {
    expect(rollTerms(parseDice("2d6+3"), highest)).toBe(15);
    expect(rollTerms(parseDice("1d8+1d6+2"), highest)).toBe(16);
  });

  it("subtracts terms with a minus sign", () => {
    expect(rollTerms(parseDice("1d20-1d4-3"), highest)).toBe(13);
  });

  it("keeps the highest or lowest dice", () => {
    let next = 0;
    const faces = [5, 2, 6, 1];
    const sequence = () => faces[next++ % faces.length] as number;
    expect(rollTerms(parseDice("4d6kh3"), sequence)).toBe(13); // 5 + 6 + 2
    next = 0;
    expect(rollTerms(parseDice("4d6kl2"), sequence)).toBe(3); // 1 + 2
  });

  it("rolls each die separately, passing the number of sides", () => {
    const seen: number[] = [];
    rollTerms(parseDice("2d6+1d20"), (sides) => {
      seen.push(sides);
      return 1;
    });
    expect(seen).toEqual([6, 6, 20]);
  });
});

describe("parseDiceCached", () => {
  it("returns the same terms as parseDice, and the very same object for a repeated notation", () => {
    expect(parseDiceCached("2d6+3")).toEqual(parseDice("2d6+3"));
    expect(parseDiceCached("2d6+3")).toBe(parseDiceCached("2d6+3"));
  });

  it("keeps working, and stays correct, past its size limit", () => {
    for (let sides = 2; sides < 400; sides++) {
      expect(parseDiceCached(`1d${sides}`)).toEqual([{ sign: 1, count: 1, sides }]);
    }
    expect(parseDiceCached("1d2")).toEqual([{ sign: 1, count: 1, sides: 2 }]);
  });

  it("does not remember notations it could not read", () => {
    expect(() => parseDiceCached("2d")).toThrow(RangeError);
    expect(() => parseDiceCached("2d")).toThrow(RangeError);
  });
});
````

- [ ] **Step 10: Ver falhar (RED).**

```bash
npx vitest run --project core src/core/internal/dice.test.ts 2>&1 | grep -E "Cannot find module|Test Files"
```

Esperado: `Cannot find module './dice'`.

- [ ] **Step 11: Implementar.**

````ts
// src/core/internal/dice.ts
/** How many dice one notation may roll in total, so user input cannot stall the process. */
const MAX_DICE = 1000;
const MAX_SIDES = 1_000_000_000;

/** One term of a dice notation: a constant, or `count` dice of `sides` sides. */
export type DiceTerm =
  | { sign: 1 | -1; constant: number }
  | {
      sign: 1 | -1;
      count: number;
      sides: number;
      keep?: { highest: boolean; count: number };
    };

const TERM = /^(?:(\d*)d(\d+)(?:k([hl])(\d+))?|(\d+))$/i;

/**
 * Parses a dice notation such as `2d6+3`, `4d6kh3` or `1d8+1d6-1`.
 *
 * @param notation - Terms joined by `+` or `-`: each is `NdM` (optionally followed by `khK` or
 *   `klK` to keep the highest or lowest K dice) or a whole number. Spaces and case are ignored.
 * @returns The parsed terms.
 * @throws {RangeError} For anything it cannot read, or more than 1000 dice in total.
 */
export function parseDice(notation: string): DiceTerm[] {
  const text = notation.replace(/\s+/g, "");
  const pieces = text.match(/[+-]?[^+-]+/g) ?? [];
  if (text === "" || pieces.join("") !== text) {
    throw new RangeError(`roll() cannot read "${notation}": use something like "2d6+3".`);
  }

  let totalDice = 0;
  return pieces.map((piece): DiceTerm => {
    const sign = piece.startsWith("-") ? -1 : 1;
    const match = TERM.exec(piece.replace(/^[+-]/, ""));
    if (!match) throw new RangeError(`roll() cannot read "${piece}" in "${notation}".`);

    const [, countText, sidesText, keepMode, keepText, constantText] = match;
    if (constantText !== undefined) {
      const constant = Number(constantText);
      if (!Number.isSafeInteger(constant)) {
        throw new RangeError(`roll() got a constant that is too large in "${notation}".`);
      }
      return { sign, constant };
    }

    const count = countText ? Number(countText) : 1;
    const sides = Number(sidesText);
    if (count < 1) throw new RangeError(`roll() needs at least one die in "${piece}".`);
    if (sides < 1) throw new RangeError(`roll() needs at least 1 side in "${piece}".`);
    if (sides > MAX_SIDES) {
      throw new RangeError(`roll() allows at most ${MAX_SIDES} sides in "${piece}".`);
    }
    totalDice += count;
    if (totalDice > MAX_DICE) {
      throw new RangeError(`roll() allows at most ${MAX_DICE} dice in "${notation}".`);
    }

    if (keepMode === undefined) return { sign, count, sides };
    const keepCount = Number(keepText);
    if (keepCount < 1) throw new RangeError(`roll() must keep at least one die in "${piece}".`);
    if (keepCount > count) {
      throw new RangeError(`roll() cannot keep ${keepCount} of ${count} dice in "${piece}".`);
    }
    return {
      sign,
      count,
      sides,
      keep: { highest: keepMode.toLowerCase() === "h", count: keepCount },
    };
  });
}

const CACHE_LIMIT = 100;
let cache: Map<string, readonly DiceTerm[]> | undefined;

/**
 * {@link parseDice}, remembering the last few notations: games roll the same `"1d20"` in a loop and
 * parsing it every time dominates the cost of a roll. The cache is emptied when it fills up, so user
 * input cannot make it grow without bound.
 *
 * @param notation - A dice notation.
 * @returns The parsed terms. Do not modify them: the same array is returned for a repeated notation.
 * @throws {RangeError} For a notation {@link parseDice} cannot read (nothing is cached then).
 */
export function parseDiceCached(notation: string): readonly DiceTerm[] {
  cache ??= new Map();
  let terms = cache.get(notation);
  if (terms === undefined) {
    terms = parseDice(notation);
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(notation, terms);
  }
  return terms;
}

/**
 * Rolls parsed terms and adds them up.
 *
 * @param terms - The result of {@link parseDice}.
 * @param rollDie - Rolls one die with the given number of sides, from 1 up to `sides`.
 * @returns The total.
 */
export function rollTerms(terms: readonly DiceTerm[], rollDie: (sides: number) => number): number {
  let total = 0;
  for (const term of terms) {
    if ("constant" in term) {
      total += term.sign * term.constant;
      continue;
    }
    const rolls = Array.from({ length: term.count }, () => rollDie(term.sides));
    const kept = term.keep
      ? rolls
          .sort((x, y) => x - y)
          .slice(
            term.keep.highest ? -term.keep.count : 0,
            term.keep.highest ? undefined : term.keep.count,
          )
      : rolls;
    total += term.sign * kept.reduce((sum, roll) => sum + roll, 0);
  }
  return total;
}
````

- [ ] **Step 12: Ver passar (GREEN).**

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run --project core src/core/internal/dice.test.ts
```

Esperado: `Tests  16 passed (16)`.

- [ ] **Step 13: Commit.**

```bash
git add src/core/internal
git commit -q -m "feat: add the Random internals: float, luck, engines and dice" \
  -m "luck is clamped below 1 and computed with log1p/expm1; the crypto engine buffers 256 words and never falls back to Math.random; dice parsing is cached with a bound." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `Random`, o núcleo (`RandomBase` e o `Random` mínimo)

**Files:** criar `src/core/random.test.ts`, `src/core/internal/scripted.test.ts`, `src/core/internal/scripted.ts`, `src/core/random-base.ts` e `src/core/random.ts`.

Esta task entrega `next`, `float`, `int`, `boolean`, `from`, `pop`, `shuffle`, `date`, `id`, `uuid` e `bytes`, o construtor com `seed` e `luck`, e a instância `random`. `fork`, `state` e o modo seguro vêm nas Tasks 5 e 6, e os cinco extras na Task 7. Por isso os arquivos abaixo são versões **intermediárias**; as Tasks seguintes os substituem.

- [ ] **Step 1: Escrever os testes primeiro.** O `scripted()` alimenta o gerador com palavras exatas, então o viés zero é provado **por enumeração**: para `int(0, 5)` os 8 padrões de 3 bits devem produzir 0 a 5 exatamente uma vez e rejeitar 6 e 7, e para `int(0, 999)` os 1024 padrões de 10 bits. Não há estatística nessa prova.

````ts
// src/core/random.test.ts
import fc from "fast-check";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { MAX_UNIT, nextDown } from "./internal/float";
import { Random, random } from "./random";
import { scripted } from "./internal/scripted";

afterEach(() => {
  vi.unstubAllGlobals();
});

const draws = <T>(rng: Random, count: number, take: (rng: Random) => T) =>
  Array.from({ length: count }, () => take(rng));

const MAX_WORD = 0xffffffff;

describe("construction", () => {
  it("accepts a string seed, a numeric seed or an options object", () => {
    expect(new Random("42").seed).toBe("42");
    expect(new Random(42).seed).toBe("42");
    expect(new Random({ seed: "x" }).seed).toBe("x");
    expect(new Random(42).next()).toBe(new Random("42").next());
  });

  it("draws a different seed for every unseeded instance", () => {
    const seeds = new Set(Array.from({ length: 50 }, () => new Random().seed));
    expect(seeds.size).toBe(50);
    expect(new Random().seed).toMatch(/^[0-9a-f]{32}$/);
  });

  it("falls back to Math.random for the seed where crypto is missing", () => {
    vi.stubGlobal("crypto", undefined);
    expect(new Random().seed).toMatch(/^[0-9a-f]{32}$/);
  });

  it("has a luck of 0 unless told otherwise, and exposes it", () => {
    expect(new Random().luck).toBe(0);
    expect(new Random({ luck: 1.5 }).luck).toBe(1.5);
    expect(new Random({ seed: "x", luck: -2 }).luck).toBe(-2);
  });

  it("rejects a luck that is not a finite number", () => {
    expect(() => new Random({ luck: NaN })).toThrow(RangeError);
    expect(() => new Random({ luck: Infinity })).toThrow(RangeError);
    expect(() => new Random({ luck: -Infinity })).toThrow(RangeError);
  });

  it("exposes the shared unseeded instance", () => {
    expect(random).toBeInstanceOf(Random);
    const value = random.int(1, 6);
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(6);
  });
});

describe("determinism", () => {
  it("gives the same sequence for the same seed", () => {
    const take = (rng: Random) => [rng.float(), rng.int(1, 100), rng.boolean(), rng.id(6)];
    expect(draws(new Random("hyrax"), 20, take)).toEqual(draws(new Random("hyrax"), 20, take));
  });

  it("gives different sequences for different seeds", () => {
    const take = (rng: Random) => rng.float();
    expect(draws(new Random("a"), 5, take)).not.toEqual(draws(new Random("b"), 5, take));
  });

  // Changing the algorithm is a breaking change: these vectors must never move.
  it("keeps its published output vectors", () => {
    const rng = new Random("hyrax");
    expect(draws(rng, 3, (r) => r.next())).toEqual([
      0.2514027896226875, 0.38468355137943655, 0.17461975251297168,
    ]);
    expect(draws(rng, 8, (r) => r.int(1, 100))).toEqual([50, 89, 71, 33, 81, 61, 19, 14]);
    expect(rng.id(12)).toBe("b5DAawXlgahC");
    expect(rng.uuid()).toBe("78424a1c-1501-46d2-be3b-20b3c25b232f");
    expect(Array.from(rng.bytes(6))).toEqual([157, 134, 121, 164, 133, 187]);
  });
});

describe("next", () => {
  it("returns a float in [0, 1) built from two 32-bit words (53 bits)", () => {
    expect(scripted([0, 0]).rng.next()).toBe(0);
    expect(scripted([MAX_WORD, MAX_WORD]).rng.next()).toBe(MAX_UNIT);
    expect(scripted([1 << 31, 0]).rng.next()).toBe(0.5);
  });

  it("is never affected by luck", () => {
    const words = [123456789, 987654321];
    expect(scripted(words, 5).rng.next()).toBe(scripted(words, 0).rng.next());
    expect(scripted(words, -5).rng.next()).toBe(scripted(words, 0).rng.next());
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

  it("defaults to [0, 1) and accepts reversed bounds", () => {
    const value = new Random("x").float();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
    const reversed = new Random("x").float(10, 0);
    expect(reversed).toBeGreaterThanOrEqual(0);
    expect(reversed).toBeLessThan(10);
  });

  it("returns min for an empty range", () => {
    expect(new Random("x").float(5, 5)).toBe(5);
  });

  it("never returns max, even when rounding would land on it", () => {
    // The largest draw times a tiny range rounds up to `max` at this magnitude.
    const { rng } = scripted([MAX_WORD, MAX_WORD]);
    expect(rng.float(1e9, 1e9 + 1)).toBe(nextDown(1e9 + 1));
    expect(scripted([MAX_WORD, MAX_WORD], 1000).rng.float(0, 1)).toBeLessThan(1);
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

  it("has zero bias: every accepted bit pattern maps to exactly one outcome", () => {
    // int(0, 5) keeps the top 3 bits of a word. Feed all 8 patterns: 0..5 must come out once each
    // and 6, 7 must be rejected (each accepted draw is followed by one fraction word).
    const words = [0, 1, 2, 3, 4, 5, 6, 7].flatMap((k) => (k < 6 ? [k << 29, 0] : [k << 29]));
    const { rng } = scripted(words);
    expect(Array.from({ length: 6 }, () => rng.int(0, 5))).toEqual([0, 1, 2, 3, 4, 5]);

    const rejecting = scripted([6 << 29, 7 << 29, 2 << 29, 0]);
    expect(rejecting.rng.int(0, 5)).toBe(2);
  });

  it("has zero bias for a span that is not a power of two, over all 1024 patterns", () => {
    const words = Array.from({ length: 1024 }, (_, x) =>
      x < 1000 ? [x << 22, 0] : [x << 22],
    ).flat();
    const { rng } = scripted(words);
    const out = Array.from({ length: 1000 }, () => rng.int(0, 999));
    expect(out).toEqual(Array.from({ length: 1000 }, (_, i) => i));
  });

  it("supports spans wider than 32 bits with the same guarantee", () => {
    // span = 2^40 + 1 needs a 9-bit high part: x = high * 2^32 + low, rejected when x >= span.
    const top = 2 ** 40;
    expect(scripted([256 << 23, 0, 0]).rng.int(0, top)).toBe(top);
    expect(scripted([256 << 23, 1, 3 << 23, 7, 0]).rng.int(0, top)).toBe(3 * 2 ** 32 + 7);
    expect(scripted([0, 5, 0]).rng.int(0, top)).toBe(5);
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

  it("stays inside the bounds for any draw and any luck", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: MAX_WORD }), { minLength: 64, maxLength: 64 }),
        fc.double({ min: -50, max: 50, noNaN: true }),
        fc.integer({ min: -1000, max: 1000 }),
        fc.nat(2000),
        (words, luck, min, span) => {
          const value = scripted(words, luck).rng.int(min, min + span);
          expect(value).toBeGreaterThanOrEqual(min);
          expect(value).toBeLessThanOrEqual(min + span);
          expect(Number.isInteger(value)).toBe(true);
        },
      ),
    );
  });

  it("stays inside the bounds for the largest possible draw at extreme luck", () => {
    // int(1, 20) keeps the top 5 bits: 19 << 27 selects the last index, and the largest fraction follows.
    const topIndex = (19 << 27) | 0x7ffffff;
    for (const luck of [2, 10, 1000, 1e9]) {
      expect(scripted([topIndex, MAX_WORD], luck).rng.int(1, 20)).toBe(20);
    }
    for (const luck of [-2, -10, -1000, -1e9]) {
      expect(scripted([0, 0], luck).rng.int(1, 20)).toBe(1);
    }
  });

  it("rounds fractional bounds inward and accepts reversed bounds", () => {
    const rng = new Random("inward");
    expect(new Set(draws(rng, 200, (r) => r.int(1.2, 2.8)))).toEqual(new Set([2]));
    const value = new Random("x").int(5, 1);
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(5);
  });

  it("returns the only value of a one-value range", () => {
    expect(new Random("x").int(7, 7)).toBe(7);
  });

  it("throws when there is no integer in the range, or it is not finite or too wide", () => {
    expect(() => new Random("x").int(1.2, 1.8)).toThrow(RangeError);
    expect(() => new Random("x").int(NaN, 3)).toThrow(RangeError);
    expect(() => new Random("x").int(0, Infinity)).toThrow(RangeError);
    expect(() => new Random("x").int(-(2 ** 53), 2 ** 53)).toThrow("too wide");
  });

  it("consumes the same number of words whatever the luck", () => {
    const words = Array.from({ length: 400 }, (_, i) => (i * 2654435761) >>> 0);
    const calls = (luck: number) => {
      const { rng, used } = scripted(words, luck);
      for (let i = 0; i < 20; i++) rng.int(1, 6);
      return used();
    };
    expect(calls(-3)).toBe(calls(0));
    expect(calls(0)).toBe(calls(4));
  });
});

describe("boolean", () => {
  it("never returns true at chance 0 and always at chance 1, even for the extreme draws", () => {
    for (const words of [
      [0, 0],
      [MAX_WORD, MAX_WORD],
    ]) {
      for (const luck of [-5, 0, 5]) {
        expect(scripted(words, luck).rng.boolean(0)).toBe(false);
        expect(scripted(words, luck).rng.boolean(1)).toBe(true);
      }
    }
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
    expect(new Set(draws(rng, 200, (r) => r.from("😀ab")))).toEqual(new Set(["😀", "a", "b"]));
  });

  it("picks a value of an object", () => {
    const rng = new Random("obj");
    expect(new Set(draws(rng, 200, (r) => r.from({ x: 1, y: 2 })))).toEqual(new Set([1, 2]));
  });

  it("returns undefined for an empty source, without touching the generator", () => {
    const { rng, used } = scripted([1, 2, 3]);
    expect(rng.from([])).toBeUndefined();
    expect(rng.from("")).toBeUndefined();
    expect(rng.from({})).toBeUndefined();
    expect(used()).toBe(0);
  });

  it("ignores luck", () => {
    const words = [1 << 31, 5, 9, 3];
    expect(scripted(words, 9).rng.from([1, 2, 3, 4])).toBe(
      scripted(words, 0).rng.from([1, 2, 3, 4]),
    );
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

  it("removes the drawn position, even when values repeat", () => {
    const list = [7, 7, 7];
    new Random("dup").pop(list);
    expect(list).toEqual([7, 7]);
  });

  it("empties an array one element at a time", () => {
    const list = [1, 2, 3];
    const rng = new Random("all");
    const out = [rng.pop(list), rng.pop(list), rng.pop(list)];
    expect(out.sort()).toEqual([1, 2, 3]);
    expect(list).toEqual([]);
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

  it("is deterministic for a seed and actually reorders", () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    expect(new Random("s").shuffle(input)).toEqual(new Random("s").shuffle(input));
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

  it("accepts numbers and Date objects, in either order", () => {
    const rng = new Random("kinds");
    const date = rng.date(2000, new Date(1000));
    expect(date.getTime()).toBeGreaterThanOrEqual(1000);
    expect(date.getTime()).toBeLessThanOrEqual(2000);
  });

  it("covers spans far longer than 2^32 milliseconds without gaps", () => {
    const rng = new Random("wide");
    const times = draws(rng, 200, (r) => r.date(0, "2100-01-01").getTime());
    expect(times.some((t) => t % 2 !== 0)).toBe(true);
  });

  it("defaults to the range from the epoch to now", () => {
    const time = new Random("default").date().getTime();
    expect(time).toBeGreaterThanOrEqual(0);
    expect(time).toBeLessThanOrEqual(Date.now());
  });

  it("ignores luck", () => {
    const words = [1 << 31, 5, 9, 3];
    expect(scripted(words, 9).rng.date(0, 1000).getTime()).toBe(
      scripted(words, 0).rng.date(0, 1000).getTime(),
    );
  });

  it("rejects invalid or absurdly wide bounds", () => {
    expect(() => new Random("x").date("not a date")).toThrow(RangeError);
    expect(() => new Random("x").date(0, NaN)).toThrow(RangeError);
    expect(() => new Random("x").date(-8.64e15, 8.64e15)).toThrow("too wide");
  });
});

describe("id", () => {
  it("has the requested length and the default alphanumeric alphabet", () => {
    const rng = new Random("id");
    expect(rng.id()).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(rng.id(25)).toMatch(/^[A-Za-z0-9]{25}$/);
    expect(rng.id(0)).toBe("");
  });

  it("includes the digit 0 and every character of the alphabet", () => {
    const ids = new Random("zero").id(5_000);
    expect(ids).toContain("0");
    expect(new Set(ids).size).toBe(62);
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
  it("is a valid version 4 UUID with the RFC 4122 variant", () => {
    const rng = new Random("uuid");
    for (let i = 0; i < 100; i++) {
      expect(rng.uuid()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  it("lays the four words out big-endian, forcing the version and variant bits", () => {
    const { rng } = scripted([0x01234567, 0x89abcdef, 0xffffffff, 0x00000000]);
    expect(rng.uuid()).toBe("01234567-89ab-4def-bfff-ffff00000000");
  });

  it("is deterministic for a seed and unique across draws", () => {
    expect(new Random("u").uuid()).toBe(new Random("u").uuid());
    const rng = new Random("many");
    expect(new Set(draws(rng, 2_000, (r) => r.uuid())).size).toBe(2_000);
  });
});

describe("bytes", () => {
  it("takes 4 bytes per word, big-endian, and consumes only the words it needs", () => {
    const { rng, used } = scripted([0x01020304, 0x05060708]);
    expect(Array.from(rng.bytes(5))).toEqual([1, 2, 3, 4, 5]);
    expect(used()).toBe(2);
    expect(Array.from(scripted([0x01020304]).rng.bytes(3))).toEqual([1, 2, 3]);
  });

  it("returns an empty array for 0 and rejects bad counts", () => {
    expect(new Random("x").bytes(0)).toEqual(new Uint8Array(0));
    expect(() => new Random("x").bytes(-1)).toThrow(RangeError);
    expect(() => new Random("x").bytes(1.5)).toThrow(RangeError);
  });

  it("ignores luck", () => {
    const words = [0x01020304];
    expect(scripted(words, 8).rng.bytes(4)).toEqual(scripted(words, 0).rng.bytes(4));
  });
});
````

````ts
// src/core/internal/scripted.test.ts
import { describe, expect, it } from "vitest";
import { scripted } from "./scripted";

describe("scripted", () => {
  it("serves exactly the words it was given, in order, and counts them", () => {
    const { rng, used } = scripted([0x01020304, 0x05060708]);
    expect(Array.from(rng.bytes(8))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(used()).toBe(2);
  });

  it("throws when the words run out, instead of cycling into an endless rejection loop", () => {
    const { rng } = scripted([0xffffffff]);
    // int(1, 20) rejects a top-5-bits value of 31, so it asks for a second word that is not there.
    expect(() => rng.int(1, 20)).toThrow("ran out of words");
  });
});
````

- [ ] **Step 2: Ver falhar (RED).**

```bash
npx vitest run --project core src/core/random.test.ts src/core/internal/scripted.test.ts 2>&1 | grep -E "Cannot find module|Test Files"
```

Esperado: `Cannot find module './random'` e `'./scripted'`, `Test Files  2 failed (2)`.

- [ ] **Step 3: Implementar.** Pontos de atenção: `#below` sorteia um índice sem viés (os bits altos de uma palavra, mais uma nova tentativa quando cai fora; acima de 2³² combina duas palavras); `int` **sempre** gasta uma palavra de fração, mesmo com `luck = 0`, para que o custo da chamada não dependa do `luck`; `from` e `pop` tratam array vazio **antes** de sortear (`int(0, -1)` troca os limites); `float` devolve `nextDown(max)` quando o arredondamento cai em `max`.

````ts
// src/core/internal/scripted.ts
import type { Engine } from "./engines";
import { RandomBase } from "../random-base";

/** A generator fed with exact 32-bit words, to test what each method does with each pattern. */
class Scripted extends RandomBase {
  constructor(engine: Engine, luck: number) {
    super(engine, luck);
  }
}

/**
 * Builds a generator that returns exactly `words`, in order. It throws when they run out, instead
 * of cycling: an engine that cycles through words the rejection sampler always refuses would loop
 * forever (a real engine accepts each attempt with probability of at least 1/2).
 *
 * @param words - The 32-bit words to serve.
 * @param luck - The luck of the generator.
 * @returns The generator and a counter of how many words were consumed.
 */
export function scripted(words: readonly number[], luck = 0) {
  let used = 0;
  const rng = new Scripted(
    {
      next32: () => {
        if (used >= words.length) throw new Error(`scripted engine ran out of words after ${used}`);
        return words[used++] as number;
      },
    },
    luck,
  );
  return { rng, used: () => used };
}
````

````ts
// src/core/random-base.ts
import type { Engine } from "./internal/engines";
import { nextDown } from "./internal/float";
import { lucky } from "./internal/luck";

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
// Both are built on first use, for the same reason as in float.ts: no work at module level.
let alphanumeric: string[] | undefined;
let hex: string[] | undefined;
const TWO_POW_32 = 4294967296;
const MAX_SPAN = 9007199254740992; // 2 ** 53

/**
 * The methods every generator shares. It draws all its randomness from an engine: a seeded one for
 * {@link Random}, a `crypto`-backed one for {@link SecureRandom}.
 *
 * **Luck** bends the *outcome* methods (`int`, `float`, `boolean`) and leaves the *structural* ones
 * (`from`, `pop`, `shuffle`, `date`, `id`, `uuid`, `bytes`) fair. It is fixed when the generator is
 * created and is `0` (neutral) by default. Every call consumes the same number of draws whatever the
 * luck is, so the same seed with more luck never gives a worse result for any single call.
 *
 * @example
 * ```ts
 * const rng = new Random({ seed: "run-1", luck: 1 });
 * rng.int(1, 20); // as if you rolled twice and kept the better one
 * ```
 */
export abstract class RandomBase {
  /** How much the outcome methods favour good results: `0` is neutral, negative is unlucky. */
  readonly luck: number;

  readonly #engine: Engine;

  /**
   * @param engine - Where the 32-bit words come from.
   * @param luck - A finite number; `0` is neutral.
   * @throws {RangeError} When `luck` is not a finite number.
   */
  protected constructor(engine: Engine, luck = 0) {
    if (!Number.isFinite(luck)) throw new RangeError(`luck must be a finite number, got ${luck}.`);
    this.luck = luck;
    this.#engine = engine;
  }

  /**
   * A fair float in `[0, 1)` with 53 bits of precision, built from two words. It is the raw
   * material of the other methods and is **never** affected by luck.
   *
   * @example
   * ```ts
   * new Random("x").next(); // => a number in [0, 1)
   * ```
   *
   * @returns The float.
   */
  next(): number {
    const high = this.#engine.next32() >>> 5;
    const low = this.#engine.next32() >>> 6;
    return (high * 67108864 + low) / 9007199254740992;
  }

  /**
   * A float in `[min, max)`: the result is never `max`. The bounds may be given in either order.
   * Affected by luck.
   *
   * @example
   * ```ts
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
    const value = low + lucky(this.next(), this.luck) * (high - low);
    if (value < high) return value;
    // Rounding reached `high` (a tiny range at a large magnitude): step back to the last double below.
    return Math.max(low, nextDown(high));
  }

  /**
   * An integer between `min` and `max`, **both included**. With luck `0` it has no bias at all: it
   * keeps the top bits of a word and draws again when the value falls outside the range. The bounds
   * may be given in either order, and fractional bounds are rounded inward (`1.2..2.8` means `2`).
   * Affected by luck.
   *
   * @example
   * ```ts
   * new Random("x").int(1, 6); // => 1, 2, 3, 4, 5 or 6
   * ```
   *
   * @param min - One bound.
   * @param max - The other bound.
   * @returns The random integer.
   * @throws {RangeError} When the range holds no integer, is not finite or is wider than 2^53.
   */
  int(min: number, max: number): number {
    const low = Math.ceil(Math.min(min, max));
    const high = Math.floor(Math.max(min, max));
    if (!Number.isFinite(low) || !Number.isFinite(high) || low > high) {
      throw new RangeError(`int() found no integer between ${min} and ${max}.`);
    }
    const span = high - low + 1;
    const index = this.#below(span, "int()");
    // Always drawn, so a call costs the same at every luck; only used when luck bends the result.
    const fraction = this.#engine.next32() / TWO_POW_32;
    if (this.luck === 0) return low + index;
    return low + Math.min(span - 1, Math.floor(span * lucky((index + fraction) / span, this.luck)));
  }

  /**
   * `true` with the given probability. Affected by luck: at luck 1 a 50% check succeeds 75% of the time.
   *
   * @example
   * ```ts
   * new Random("x").boolean(0.75); // 75% true
   * ```
   *
   * @param chance - The probability of `true`, from `0` to `1` (default `0.5`).
   * @returns The random boolean.
   * @throws {RangeError} When `chance` is outside `0..1`. A percentage such as `50` is an error,
   *   not "always true".
   */
  boolean(chance = 0.5): boolean {
    if (!(chance >= 0 && chance <= 1)) {
      throw new RangeError(`boolean() needs a chance between 0 and 1, got ${chance}.`);
    }
    return lucky(this.next(), this.luck) >= 1 - chance;
  }

  /**
   * A random element of an array. Fair: ignores luck.
   *
   * @example
   * ```ts
   * new Random("x").from([10, 20, 30]); // => 10, 20 or 30
   * ```
   *
   * @param source - The array to pick from.
   * @returns An element, or `undefined` when the array is empty.
   */
  from<T>(source: readonly T[]): T | undefined;
  /**
   * A random character (code point) of a string. Fair: ignores luck.
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
   * A random value of an object. Fair: ignores luck.
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
    return items[this.#below(items.length, "from()")];
  }

  /**
   * Removes a random element from `array` (mutating it) and returns it. Fair: ignores luck.
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
    return array.splice(this.#below(array.length, "pop()"), 1)[0];
  }

  /**
   * A shuffled copy of `array` (Fisher-Yates). With a seed every permutation is equally likely up
   * to 34 elements (the engine has 128 bits of state); past that, use {@link SecureRandom}. The input
   * is left untouched. Fair: ignores luck.
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
      const j = this.#below(i + 1, "shuffle()");
      const held = copy[i] as T;
      copy[i] = copy[j] as T;
      copy[j] = held;
    }
    return copy;
  }

  /**
   * A date between `after` and `before`, both included, at millisecond resolution. The defaults
   * are the Unix epoch and now, so pass both bounds for a reproducible result. Fair: ignores luck.
   *
   * @example
   * ```ts
   * new Random("x").date("2020-01-01", "2020-12-31"); // => a date in 2020
   * ```
   *
   * @param after - One bound (default: the epoch).
   * @param before - The other bound (default: now).
   * @returns The random date.
   * @throws {RangeError} When a bound is not a valid date or the range is wider than 2^53 ms.
   */
  date(after: number | string | Date = 0, before: number | string | Date = Date.now()): Date {
    const a = new Date(after).getTime();
    const b = new Date(before).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) throw new RangeError("date() needs valid date bounds.");
    const low = Math.min(a, b);
    return new Date(low + this.#below(Math.max(a, b) - low + 1, "date()"));
  }

  /**
   * A random string of characters from `alphabet`. Not unique, and not secret unless the generator
   * is a {@link SecureRandom}. Fair: ignores luck.
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
    const characters =
      alphabet === ALPHANUMERIC
        ? (alphanumeric ??= Array.from(ALPHANUMERIC))
        : Array.from(alphabet);
    if (characters.length === 0) throw new RangeError("id() needs a non-empty alphabet.");
    let id = "";
    for (let i = 0; i < length; i++) id += characters[this.#below(characters.length, "id()")];
    return id;
  }

  /**
   * A version 4 UUID drawn from this generator, so it is reproducible for a given seed. Fair:
   * ignores luck. Unpredictable only for a {@link SecureRandom}.
   *
   * @example
   * ```ts
   * new Random("x").uuid(); // => "3f2b8c1e-9a47-4d0e-8b5a-6c1d2e7f9a03" (the same for this seed)
   * ```
   *
   * @returns The UUID, in lowercase.
   */
  uuid(): string {
    const HEX = (hex ??= Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0")));
    const a = this.#engine.next32();
    const b = this.#engine.next32();
    const c = this.#engine.next32();
    const d = this.#engine.next32();
    return (
      `${HEX[a >>> 24]}${HEX[(a >>> 16) & 255]}${HEX[(a >>> 8) & 255]}${HEX[a & 255]}-` +
      `${HEX[b >>> 24]}${HEX[(b >>> 16) & 255]}-${HEX[((b >>> 8) & 15) | 64]}${HEX[b & 255]}-` +
      `${HEX[((c >>> 24) & 63) | 128]}${HEX[(c >>> 16) & 255]}-${HEX[(c >>> 8) & 255]}${HEX[c & 255]}` +
      `${HEX[d >>> 24]}${HEX[(d >>> 16) & 255]}${HEX[(d >>> 8) & 255]}${HEX[d & 255]}`
    );
  }

  /**
   * Random bytes, four per word, most significant first. Fair: ignores luck.
   *
   * @example
   * ```ts
   * new Random("x").bytes(4); // => Uint8Array [ 213, 7, 88, 140 ]
   * ```
   *
   * @param count - How many bytes.
   * @returns The bytes.
   * @throws {RangeError} When `count` is not a non-negative integer.
   */
  bytes(count: number): Uint8Array {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(`bytes() needs a non-negative integer count, got ${count}.`);
    }
    const bytes = new Uint8Array(count);
    for (let i = 0; i < count; i += 4) {
      const word = this.#engine.next32();
      bytes[i] = word >>> 24;
      if (i + 1 < count) bytes[i + 1] = (word >>> 16) & 255;
      if (i + 2 < count) bytes[i + 2] = (word >>> 8) & 255;
      if (i + 3 < count) bytes[i + 3] = word & 255;
    }
    return bytes;
  }

  /**
   * A uniform integer in `[0, span)` with no bias. It keeps the top bits of a word, just enough to
   * cover `span`, and draws again when the value lands outside (fewer than two draws on average).
   * Spans above 2^32 combine two words. Independent of luck.
   *
   * @param span - How many values, from 1 up to 2^53.
   * @param method - Who is asking, for the error message.
   * @returns The index.
   */
  #below(span: number, method: string): number {
    if (span > MAX_SPAN)
      throw new RangeError(`${method} range is too wide (more than 2^53 values).`);
    if (span <= 1) return 0;

    if (span <= TWO_POW_32) {
      const shift = Math.clz32(span - 1);
      let value: number;
      do value = this.#engine.next32() >>> shift;
      while (value >= span);
      return value;
    }

    const highBits = 32 - Math.clz32(Math.floor((span - 1) / TWO_POW_32));
    let value: number;
    do value = (this.#engine.next32() >>> (32 - highBits)) * TWO_POW_32 + this.#engine.next32();
    while (value >= span);
    return value;
  }
}
````

````ts
// src/core/random.ts
import { createSeed, createSeededEngine } from "./internal/engines";
import { RandomBase } from "./random-base";

/** Options for {@link Random}. */
export interface RandomOptions {
  /** Any string or number. A number is used as its string form. Without one, a seed is drawn. */
  seed?: string | number;
  /** How much the outcome methods favour good results: `0` is neutral, negative is unlucky. */
  luck?: number;
}

/**
 * A seedable pseudo-random number generator. The same seed and the same sequence of calls always
 * give the same results, which makes it good for tests, fixtures and reproducible simulations.
 *
 * It is **not cryptographically secure**: its output can be used to predict what comes next. For
 * tokens and secrets use {@link SecureRandom}. The algorithm (sfc32 seeded through cyrb128) is part
 * of the public contract: changing what a seed produces is a breaking change.
 *
 * @example
 * ```ts
 * const rng = new Random("fixture-42");
 * rng.int(1, 6); // the same die roll every time
 * rng.from(["a", "b", "c"]);
 * rng.shuffle([1, 2, 3, 4]);
 * ```
 */
export class Random extends RandomBase {
  /** The seed this generator was created with. `new Random(seed)` replays it from the start. */
  readonly seed: string;

  /**
   * Creates a generator.
   *
   * @param options - A seed (string or number), or `{ seed, luck }`. Without a seed, one is drawn
   *   from `crypto` (or `Math.random` where `crypto` is missing) and exposed as {@link Random.seed}.
   * @throws {RangeError} When `luck` is not a finite number.
   */
  constructor(options: string | number | RandomOptions = {}) {
    const { seed, luck = 0 } =
      typeof options === "object" ? options : { seed: options, luck: undefined };
    const resolved = seed === undefined ? createSeed() : String(seed);
    super(createSeededEngine(resolved), luck);
    this.seed = resolved;
  }
}

/**
 * A ready-to-use {@link Random} with a random seed and neutral luck, for when you do not need
 * reproducibility.
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
npm run typecheck && npm run lint && npm run format:check && npx vitest run --project core src/core/random.test.ts src/core/internal/scripted.test.ts
```

Esperado: `Tests  61 passed (61)` (59 em `random.test.ts` e 2 em `scripted.test.ts`).

- [ ] **Step 5: Provar que o teste de viés pega o viés.** Troque temporariamente a rejeição por um módulo (o erro clássico), rode e restaure.

```bash
cp src/core/random-base.ts /tmp/random-base.bak
python3 - <<'EOF'
p="src/core/random-base.ts"; s=open(p).read()
old="while (value >= span);\n      return value;"
assert old in s
open(p,"w").write(s.replace(old,"while (false);\n      return value % span;",1))
EOF
npx vitest run --project core src/core/random.test.ts 2>&1 | grep -E "^ +×"
cp /tmp/random-base.bak src/core/random-base.ts && git status --short
```

Esperado: falham `has zero bias: every accepted bit pattern maps to exactly one outcome` e `does not favour any value (no half-weight endpoints)`, entre outros; depois do `cp`, `git status` mostra só os arquivos novos desta task.

- [ ] **Step 6: Provar os dois limites do `float` e do `luck`.**

```bash
cp src/core/random-base.ts /tmp/random-base.bak && cp src/core/internal/luck.ts /tmp/luck.bak
sed -i 's/return Math.max(low, nextDown(high));/return high;/' src/core/random-base.ts
sed -i 's/return value > MAX_UNIT ? MAX_UNIT : value;/return value;/' src/core/internal/luck.ts
npx vitest run --project core src/core/random.test.ts src/core/internal/luck.test.ts 2>&1 | grep -E "^ +×"
cp /tmp/random-base.bak src/core/random-base.ts && cp /tmp/luck.bak src/core/internal/luck.ts && git status --short
```

Esperado: falham `never returns max, even when rounding would land on it`, `stays inside [0, 1) even for extreme luck and the largest possible draw`, `always returns a value in [0, MAX_UNIT]` e `never returns true at chance 0 and always at chance 1, even for the extreme draws`. O `int` **não** falha aqui de propósito: ele tem o seu próprio `Math.min(span - 1, ...)`, então quem depende do limite de `MAX_UNIT` são `float` e `boolean`.

- [ ] **Step 7: Commit.**

```bash
git add src/core/random.ts src/core/random-base.ts src/core/random.test.ts src/core/internal/scripted.ts src/core/internal/scripted.test.ts
git commit -q -m "feat: rebuild Random around an engine, with exact sampling and luck" \
  -m "int, from, pop, shuffle, date and id have zero bias (rejection sampling); luck bends int, float and boolean without changing how many draws a call costs; uuid is a real v4 and 8x faster; the static methods and global caches are gone." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `fork`, `state` e `restore`

**Files:** criar `src/core/random-state.test.ts`; substituir `src/core/random.ts`.

- [ ] **Step 1: Escrever o teste primeiro.** `fork` nunca depende de quanto o pai foi usado; o vetor `keeps its published output vector` fixa a derivação (JSON de `[seedDoPai, ...chaves]`).

````ts
// src/core/random-state.test.ts
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { Random, type RandomState } from "./random";

const take = (rng: Random, count: number) => Array.from({ length: count }, () => rng.next());

describe("fork", () => {
  it("is deterministic: the same seed and keys give the same child", () => {
    expect(take(new Random("world").fork("terrain", 3, 4), 5)).toEqual(
      take(new Random("world").fork("terrain", 3, 4), 5),
    );
  });

  it("does not depend on how much the parent was used, and does not consume it", () => {
    const busy = new Random("world");
    take(busy, 100);
    expect(take(busy.fork("chunk", 1), 5)).toEqual(take(new Random("world").fork("chunk", 1), 5));

    const forked = new Random("world");
    forked.fork("anything");
    expect(forked.next()).toBe(new Random("world").next());
  });

  it("gives different children for different keys", () => {
    const parent = new Random("world");
    const first = (rng: Random) => rng.next();
    const values = [
      first(parent.fork("a")),
      first(parent.fork("b")),
      first(parent.fork("a", 1)),
      first(parent.fork("a", 2)),
      first(parent.fork()),
    ];
    expect(new Set(values).size).toBe(values.length);
  });

  it("never confuses different key lists that would join to the same text", () => {
    const parent = new Random("world");
    expect(parent.fork("a/b").seed).not.toBe(parent.fork("a", "b").seed);
    expect(parent.fork("ab").seed).not.toBe(parent.fork("a", "b").seed);
    expect(parent.fork(1).seed).not.toBe(parent.fork("1").seed);
  });

  it("uses the JSON of the parent seed and the keys as the child seed, so it can be replayed", () => {
    const child = new Random("world").fork("terrain", 3, 4);
    expect(child.seed).toBe('["world","terrain",3,4]');
    expect(take(new Random(child.seed), 4)).toEqual(
      take(new Random("world").fork("terrain", 3, 4), 4),
    );
  });

  it("nests", () => {
    const deep = new Random("w").fork("a").fork("b");
    expect(deep.seed).toBe('["[\\"w\\",\\"a\\"]","b"]');
    expect(take(deep, 3)).toEqual(take(new Random("w").fork("a").fork("b"), 3));
  });

  it("inherits the luck of its parent", () => {
    expect(new Random({ seed: "w", luck: 2 }).fork("x").luck).toBe(2);
    expect(new Random("w").fork("x").luck).toBe(0);
  });

  it("rejects keys that JSON would turn into null", () => {
    const parent = new Random("w");
    expect(() => parent.fork(NaN)).toThrow(RangeError);
    expect(() => parent.fork(Infinity)).toThrow(RangeError);
  });

  // Changing how a child is derived is a breaking change: this value must never move.
  it("keeps its published output vector", () => {
    expect(new Random("hyrax").fork("terrain", 3, 4).next()).toBe(0.31158723663990495);
  });
});

describe("state and restore", () => {
  it("describes the generator as plain JSON", () => {
    const rng = new Random({ seed: "snap", luck: 1.5 });
    take(rng, 3);
    const state = rng.state();
    expect(state.version).toBe(1);
    expect(state.seed).toBe("snap");
    expect(state.luck).toBe(1.5);
    expect(state.engine).toHaveLength(4);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expectTypeOf(state).toEqualTypeOf<RandomState>();
  });

  it("resumes exactly where the snapshot was taken", () => {
    const rng = new Random("resume");
    take(rng, 17);
    const snapshot = rng.state();
    const expected = take(rng, 50);
    expect(take(Random.restore(snapshot), 50)).toEqual(expected);
  });

  it("survives a trip through JSON", () => {
    const rng = new Random("json");
    take(rng, 5);
    const restored = Random.restore(JSON.parse(JSON.stringify(rng.state())) as RandomState);
    expect(restored.next()).toBe(rng.next());
  });

  it("keeps the seed and the luck", () => {
    const restored = Random.restore(new Random({ seed: "keep", luck: -2 }).state());
    expect(restored.seed).toBe("keep");
    expect(restored.luck).toBe(-2);
  });

  it("gives an independent generator: drawing from one does not move the other", () => {
    const original = new Random("twins");
    const copy = Random.restore(original.state());
    take(copy, 10);
    expect(original.next()).toBe(new Random("twins").next());
  });

  it("works for an unseeded generator, whose seed was drawn", () => {
    const rng = new Random();
    take(rng, 4);
    expect(Random.restore(rng.state()).next()).toBe(rng.next());
  });

  it("resumes at any point (property)", () => {
    fc.assert(
      fc.property(fc.string(), fc.nat(40), fc.nat(40), (seed, before, after) => {
        const rng = new Random(seed);
        take(rng, before);
        const snapshot = rng.state();
        const expected = take(rng, after);
        expect(take(Random.restore(snapshot), after)).toEqual(expected);
      }),
    );
  });

  describe("validation", () => {
    const valid = () => new Random("v").state();

    it("rejects anything that is not a state object", () => {
      for (const bad of [null, undefined, 42, "state", []]) {
        expect(() => Random.restore(bad as unknown as RandomState)).toThrow(TypeError);
      }
    });

    it("rejects an unsupported version with a clear message", () => {
      expect(() => Random.restore({ ...valid(), version: 2 } as unknown as RandomState)).toThrow(
        "version",
      );
    });

    it("rejects a bad seed, luck or engine", () => {
      const state = valid();
      expect(() => Random.restore({ ...state, seed: 5 } as unknown as RandomState)).toThrow(
        TypeError,
      );
      expect(() => Random.restore({ ...state, luck: NaN })).toThrow(RangeError);
      const engines: unknown[] = [
        [1, 2, 3],
        [1, 2, 3, 4, 5],
        [1, 2, 3, -1],
        [1, 2, 3, 2 ** 32],
        [1, 2, 3, 1.5],
        [1, 2, 3, "4"],
        "1234",
        null,
      ];
      for (const engine of engines) {
        expect(() => Random.restore({ ...state, engine } as unknown as RandomState)).toThrow(
          TypeError,
        );
      }
    });
  });
});
````

- [ ] **Step 2: Ver falhar (RED).**

```bash
npx vitest run --project core src/core/random-state.test.ts 2>&1 | grep -E "is not a function|Tests "
```

Esperado: `busy.fork is not a function`, `rng.state is not a function` e `Tests  18 failed | 1 passed (19)`.

- [ ] **Step 3: Implementar.** Substitui `random.ts` pela versão com `RandomState`, `fork`, `state` e `restore`.

````ts
// src/core/random.ts
import { createSeed, createSeededEngine, type SeededEngine } from "./internal/engines";
import { RandomBase } from "./random-base";

/** Options for {@link Random}. */
export interface RandomOptions {
  /** Any string or number. A number is used as its string form. Without one, a seed is drawn. */
  seed?: string | number;
  /** How much the outcome methods favour good results: `0` is neutral, negative is unlucky. */
  luck?: number;
}

/** A snapshot of a {@link Random}: plain JSON, restorable with {@link Random.restore}. */
export interface RandomState {
  /** The format version. Always `1` for now. */
  version: 1;
  /** The seed of the generator. */
  seed: string;
  /** The luck of the generator. */
  luck: number;
  /** The four 32-bit words of engine state. */
  engine: [number, number, number, number];
}

/**
 * A seedable pseudo-random number generator. The same seed and the same sequence of calls always
 * give the same results, which makes it good for tests, fixtures and reproducible simulations.
 *
 * It is **not cryptographically secure**: its output can be used to predict what comes next. For
 * tokens and secrets use {@link SecureRandom}. The algorithm (sfc32 seeded through cyrb128) is part
 * of the public contract: changing what a seed produces is a breaking change.
 *
 * @example
 * ```ts
 * const rng = new Random("fixture-42");
 * rng.int(1, 6); // the same die roll every time
 * rng.from(["a", "b", "c"]);
 * rng.shuffle([1, 2, 3, 4]);
 * ```
 */
export class Random extends RandomBase {
  /** The seed this generator was created with. `new Random(seed)` replays it from the start. */
  readonly seed: string;

  readonly #engine: SeededEngine;

  /**
   * Creates a generator.
   *
   * @param options - A seed (string or number), or `{ seed, luck }`. Without a seed, one is drawn
   *   from `crypto` (or `Math.random` where `crypto` is missing) and exposed as {@link Random.seed}.
   * @throws {RangeError} When `luck` is not a finite number.
   */
  constructor(options: string | number | RandomOptions = {}) {
    const { seed, luck = 0 } =
      typeof options === "object" ? options : { seed: options, luck: undefined };
    const resolved = seed === undefined ? createSeed() : String(seed);
    const engine = createSeededEngine(resolved);
    super(engine, luck);
    this.seed = resolved;
    this.#engine = engine;
  }

  /**
   * A new generator that is independent of this one and always the same for the same parent seed
   * and keys. It does **not** consume this generator, and does not depend on how much it has been
   * used: forking `("chunk", 3, 4)` before or after `("chunk", 0, 0)` gives the same stream. Use it
   * to give every part of a procedural world, or every test, its own reproducible randomness.
   *
   * The child's seed is the JSON of `[parentSeed, ...keys]`, so `fork("a/b")` never collides with
   * `fork("a", "b")`, and `new Random(child.seed)` replays the child. It inherits the luck.
   *
   * @example
   * ```ts
   * const world = new Random("world-7");
   * world.fork("terrain", 3, 4).int(0, 255); // the same value every time
   * ```
   *
   * @param keys - Strings and finite numbers that name the stream.
   * @returns The child generator.
   * @throws {RangeError} When a key is a number that is not finite (JSON would turn it into `null`).
   */
  fork(...keys: (string | number)[]): Random {
    for (const key of keys) {
      if (typeof key === "number" && !Number.isFinite(key)) {
        throw new RangeError(`fork() keys must be strings or finite numbers, got ${key}.`);
      }
    }
    return new Random({ seed: JSON.stringify([this.seed, ...keys]), luck: this.luck });
  }

  /**
   * A snapshot of where this generator is, as plain JSON. {@link Random.restore} continues from
   * exactly this point: save a game, replay a bug.
   *
   * @example
   * ```ts
   * const saved = JSON.stringify(rng.state());
   * Random.restore(JSON.parse(saved)); // continues where `rng` is now
   * ```
   *
   * @returns The state.
   */
  state(): RandomState {
    return { version: 1, seed: this.seed, luck: this.luck, engine: this.#engine.snapshot() };
  }

  /**
   * Rebuilds a generator from {@link Random.state}. The result is independent of the original.
   *
   * @example
   * ```ts
   * const copy = Random.restore(rng.state());
   * copy.next() === rng.next(); // => true
   * ```
   *
   * @param state - A value produced by `state()`, possibly after a trip through JSON.
   * @returns A generator that continues from that point.
   * @throws {TypeError} When `state` does not have the expected shape.
   * @throws {RangeError} When the version is unsupported or the luck is not finite.
   */
  static restore(state: RandomState): Random {
    if (typeof state !== "object" || state === null || Array.isArray(state)) {
      throw new TypeError("Random.restore() needs the object returned by state().");
    }
    if (state.version !== 1) {
      throw new RangeError(
        `Random.restore() does not support state version ${String(state.version)}.`,
      );
    }
    if (typeof state.seed !== "string")
      throw new TypeError("Random.restore() needs a string seed.");
    if (!isEngineState(state.engine)) {
      throw new TypeError("Random.restore() needs an engine of four unsigned 32-bit integers.");
    }
    const rng = new Random({ seed: state.seed, luck: state.luck });
    rng.#engine.restore(state.engine);
    return rng;
  }
}

function isEngineState(value: unknown): value is [number, number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((word) => Number.isInteger(word) && word >= 0 && word < 4294967296)
  );
}

/**
 * A ready-to-use {@link Random} with a random seed and neutral luck, for when you do not need
 * reproducibility.
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
npm run typecheck && npm run lint && npm run format:check && npx vitest run --project core src/core/random-state.test.ts
```

Esperado: `Tests  19 passed (19)`.

- [ ] **Step 5: Provar que o teste pega um `fork` que consome o pai.**

```bash
cp src/core/random.ts /tmp/random.bak
sed -i 's/JSON.stringify(\[this.seed, ...keys\])/JSON.stringify([this.seed, this.next(), ...keys])/' src/core/random.ts
npx vitest run --project core src/core/random-state.test.ts 2>&1 | grep -E "^ +×"
cp /tmp/random.bak src/core/random.ts && git status --short
```

Esperado: falham `does not depend on how much the parent was used, and does not consume it`, `uses the JSON of the parent seed and the keys as the child seed, so it can be replayed`, `nests` e `keeps its published output vector`.

- [ ] **Step 6: Commit.**

```bash
git add src/core/random.ts src/core/random-state.test.ts
git commit -q -m "feat: add Random.fork, state and restore" \
  -m "A child depends only on the parent seed and the keys, never on how much the parent was used; a state is plain JSON with a version and is validated on restore." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `SecureRandom` e `Random.secure()`

**Files:** criar `src/core/secure-random.test.ts` e `src/core/secure-random.ts`; substituir `src/core/random.ts`.

- [ ] **Step 1: Escrever o teste primeiro.** Um `crypto.getRandomValues` falso alimenta palavras conhecidas, então dá para comparar cada método do gerador seguro com o mesmo método de um `scripted()`: a lógica é a mesma, só a fonte muda. Os testes de tipo garantem que `SecureRandom` não tem `seed` nem `state`, e que `Random` não tem `token`.

````ts
// src/core/secure-random.test.ts
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { scripted } from "./internal/scripted";
import { Random } from "./random";
import { SecureRandom } from "./secure-random";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Makes `crypto.getRandomValues` fill the buffer with these words, in order, cycling. */
const stubCrypto = (words: readonly number[]) => {
  let at = 0;
  const getRandomValues = vi.fn((array: Uint32Array) => {
    for (let i = 0; i < array.length; i++) array[i] = words[at++ % words.length] as number;
    return array;
  });
  vi.stubGlobal("crypto", { getRandomValues });
  return getRandomValues;
};

const MAX_WORD = 0xffffffff;

describe("Random.secure", () => {
  it("creates a SecureRandom", () => {
    stubCrypto([1]);
    const secure = Random.secure();
    expect(secure).toBeInstanceOf(SecureRandom);
    expectTypeOf(secure).toEqualTypeOf<SecureRandom>();
  });

  it("has no seed and no state: a secure generator cannot be replayed", () => {
    stubCrypto([1]);
    const secure = Random.secure();
    expect("seed" in secure).toBe(false);
    expect("state" in secure).toBe(false);
    expectTypeOf(secure).not.toHaveProperty("seed");
    expectTypeOf(secure).not.toHaveProperty("state");
  });

  it("takes a luck, like the seeded generator", () => {
    stubCrypto([1]);
    expect(Random.secure().luck).toBe(0);
    expect(Random.secure({ luck: 2 }).luck).toBe(2);
    expect(() => Random.secure({ luck: NaN })).toThrow(RangeError);
  });

  it("refuses to exist without crypto instead of falling back to Math.random", () => {
    vi.stubGlobal("crypto", undefined);
    expect(() => Random.secure()).toThrow("crypto.getRandomValues");
  });
});

describe("SecureRandom", () => {
  it("draws every method from crypto: same words, same results as a scripted generator", () => {
    const words = Array.from({ length: 512 }, (_, i) => (i * 2246822519 + 3266489917) >>> 0);
    stubCrypto(words);
    const secure = Random.secure();
    const { rng } = scripted(words);
    expect(secure.next()).toBe(rng.next());
    expect(secure.int(1, 6)).toBe(rng.int(1, 6));
    expect(secure.boolean(0.3)).toBe(rng.boolean(0.3));
    expect(secure.float(-5, 5)).toBe(rng.float(-5, 5));
    expect(secure.from([1, 2, 3, 4, 5])).toBe(rng.from([1, 2, 3, 4, 5]));
    expect(secure.shuffle([1, 2, 3, 4, 5, 6])).toEqual(rng.shuffle([1, 2, 3, 4, 5, 6]));
    expect(secure.id(8)).toBe(rng.id(8));
    expect(secure.uuid()).toBe(rng.uuid());
    expect(secure.bytes(9)).toEqual(rng.bytes(9));
  });

  it("keeps working past the 256-word buffer", () => {
    const getRandomValues = stubCrypto([123456789, 987654321, 555555555]);
    const secure = Random.secure();
    for (let i = 0; i < 1000; i++) secure.int(1, 6);
    expect(getRandomValues.mock.calls.length).toBeGreaterThan(1);
  });

  it("shuffles lists longer than 34 elements (the seeded engine's limit)", () => {
    stubCrypto(Array.from({ length: 256 }, (_, i) => (i * 40503) >>> 0));
    const list = Array.from({ length: 200 }, (_, i) => i);
    const shuffled = Random.secure().shuffle(list);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(list);
  });

  it("stays inside its ranges for the largest possible draw at any luck", () => {
    stubCrypto([(19 << 27) | 0x7ffffff, MAX_WORD]);
    for (const luck of [0, 2, 1000]) {
      const secure = Random.secure({ luck });
      expect(secure.int(1, 20)).toBeLessThanOrEqual(20);
    }
    stubCrypto([MAX_WORD]);
    expect(Random.secure({ luck: 1000 }).float(0, 1)).toBeLessThan(1);
  });

  it("forks into another secure generator that keeps the luck", () => {
    stubCrypto([1, 2, 3]);
    const child = Random.secure({ luck: 3 }).fork();
    expect(child).toBeInstanceOf(SecureRandom);
    expect(child.luck).toBe(3);
  });

  it("forks without keys: there is no seed to derive a child from", () => {
    expectTypeOf<SecureRandom["fork"]>().parameters.toEqualTypeOf<[]>();
  });
});

describe("token", () => {
  it("is base64url with no padding: 32 bytes give 43 characters", () => {
    stubCrypto([0x12345678, 0x9abcdef0, 0x0fedcba9, 0x87654321]);
    const token = Random.secure().token();
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("encodes the bytes it draws, using - and _ instead of + and /", () => {
    stubCrypto([0xfbffbf00]);
    expect(Random.secure().token(3)).toBe("-_-_");
  });

  it("handles lengths that are not a multiple of 3", () => {
    stubCrypto([0xffffffff]);
    expect(Random.secure().token(0)).toBe("");
    expect(Random.secure().token(1)).toHaveLength(2);
    expect(Random.secure().token(2)).toHaveLength(3);
    expect(Random.secure().token(4)).toHaveLength(6);
  });

  it("rejects bad lengths", () => {
    stubCrypto([1]);
    expect(() => Random.secure().token(-1)).toThrow(RangeError);
    expect(() => Random.secure().token(1.5)).toThrow(RangeError);
  });

  it("does not exist on the seeded generator: a reproducible token would be a trap", () => {
    expect((new Random("x") as unknown as { token?: unknown }).token).toBeUndefined();
    expectTypeOf<Random>().not.toHaveProperty("token");
  });
});
````

- [ ] **Step 2: Ver falhar (RED).**

```bash
npx vitest run --project core src/core/secure-random.test.ts 2>&1 | grep -E "Cannot find module|Test Files"
```

Esperado: `Cannot find module './secure-random'`.

- [ ] **Step 3: Implementar.**

````ts
// src/core/secure-random.ts
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
````

E substituir `random.ts` pela versão final, que acrescenta `Random.secure()`:

````ts
// src/core/random.ts
import { createSeed, createSeededEngine, type SeededEngine } from "./internal/engines";
import { RandomBase } from "./random-base";
import { SecureRandom } from "./secure-random";

/** Options for {@link Random}. */
export interface RandomOptions {
  /** Any string or number. A number is used as its string form. Without one, a seed is drawn. */
  seed?: string | number;
  /** How much the outcome methods favour good results: `0` is neutral, negative is unlucky. */
  luck?: number;
}

/** A snapshot of a {@link Random}: plain JSON, restorable with {@link Random.restore}. */
export interface RandomState {
  /** The format version. Always `1` for now. */
  version: 1;
  /** The seed of the generator. */
  seed: string;
  /** The luck of the generator. */
  luck: number;
  /** The four 32-bit words of engine state. */
  engine: [number, number, number, number];
}

/**
 * A seedable pseudo-random number generator. The same seed and the same sequence of calls always
 * give the same results, which makes it good for tests, fixtures and reproducible simulations.
 *
 * It is **not cryptographically secure**: its output can be used to predict what comes next. For
 * tokens and secrets use {@link SecureRandom}. The algorithm (sfc32 seeded through cyrb128) is part
 * of the public contract: changing what a seed produces is a breaking change.
 *
 * @example
 * ```ts
 * const rng = new Random("fixture-42");
 * rng.int(1, 6); // the same die roll every time
 * rng.from(["a", "b", "c"]);
 * rng.shuffle([1, 2, 3, 4]);
 * ```
 */
export class Random extends RandomBase {
  /** The seed this generator was created with. `new Random(seed)` replays it from the start. */
  readonly seed: string;

  readonly #engine: SeededEngine;

  /**
   * Creates a generator.
   *
   * @param options - A seed (string or number), or `{ seed, luck }`. Without a seed, one is drawn
   *   from `crypto` (or `Math.random` where `crypto` is missing) and exposed as {@link Random.seed}.
   * @throws {RangeError} When `luck` is not a finite number.
   */
  constructor(options: string | number | RandomOptions = {}) {
    const { seed, luck = 0 } =
      typeof options === "object" ? options : { seed: options, luck: undefined };
    const resolved = seed === undefined ? createSeed() : String(seed);
    const engine = createSeededEngine(resolved);
    super(engine, luck);
    this.seed = resolved;
    this.#engine = engine;
  }

  /**
   * A generator backed by `crypto.getRandomValues`, for tokens and anything that must be
   * unpredictable. It has the same methods, no seed and no `state`, and cannot be replayed.
   *
   * @example
   * ```ts
   * const secure = Random.secure();
   * secure.token(); // 32 random bytes as base64url
   * ```
   *
   * @param options - `luck` bends the outcome methods, as it does for a seeded generator.
   * @returns The secure generator.
   * @throws {Error} When the runtime has no `crypto.getRandomValues`.
   */
  static secure(options: { luck?: number } = {}): SecureRandom {
    return new SecureRandom(options);
  }

  /**
   * A new generator that is independent of this one and always the same for the same parent seed
   * and keys. It does **not** consume this generator, and does not depend on how much it has been
   * used: forking `("chunk", 3, 4)` before or after `("chunk", 0, 0)` gives the same stream. Use it
   * to give every part of a procedural world, or every test, its own reproducible randomness.
   *
   * The child's seed is the JSON of `[parentSeed, ...keys]`, so `fork("a/b")` never collides with
   * `fork("a", "b")`, and `new Random(child.seed)` replays the child. It inherits the luck.
   *
   * @example
   * ```ts
   * const world = new Random("world-7");
   * world.fork("terrain", 3, 4).int(0, 255); // the same value every time
   * ```
   *
   * @param keys - Strings and finite numbers that name the stream.
   * @returns The child generator.
   * @throws {RangeError} When a key is a number that is not finite (JSON would turn it into `null`).
   */
  fork(...keys: (string | number)[]): Random {
    for (const key of keys) {
      if (typeof key === "number" && !Number.isFinite(key)) {
        throw new RangeError(`fork() keys must be strings or finite numbers, got ${key}.`);
      }
    }
    return new Random({ seed: JSON.stringify([this.seed, ...keys]), luck: this.luck });
  }

  /**
   * A snapshot of where this generator is, as plain JSON. {@link Random.restore} continues from
   * exactly this point: save a game, replay a bug.
   *
   * @example
   * ```ts
   * const saved = JSON.stringify(rng.state());
   * Random.restore(JSON.parse(saved)); // continues where `rng` is now
   * ```
   *
   * @returns The state.
   */
  state(): RandomState {
    return { version: 1, seed: this.seed, luck: this.luck, engine: this.#engine.snapshot() };
  }

  /**
   * Rebuilds a generator from {@link Random.state}. The result is independent of the original.
   *
   * @example
   * ```ts
   * const copy = Random.restore(rng.state());
   * copy.next() === rng.next(); // => true
   * ```
   *
   * @param state - A value produced by `state()`, possibly after a trip through JSON.
   * @returns A generator that continues from that point.
   * @throws {TypeError} When `state` does not have the expected shape.
   * @throws {RangeError} When the version is unsupported or the luck is not finite.
   */
  static restore(state: RandomState): Random {
    if (typeof state !== "object" || state === null || Array.isArray(state)) {
      throw new TypeError("Random.restore() needs the object returned by state().");
    }
    if (state.version !== 1) {
      throw new RangeError(
        `Random.restore() does not support state version ${String(state.version)}.`,
      );
    }
    if (typeof state.seed !== "string")
      throw new TypeError("Random.restore() needs a string seed.");
    if (!isEngineState(state.engine)) {
      throw new TypeError("Random.restore() needs an engine of four unsigned 32-bit integers.");
    }
    const rng = new Random({ seed: state.seed, luck: state.luck });
    rng.#engine.restore(state.engine);
    return rng;
  }
}

function isEngineState(value: unknown): value is [number, number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((word) => Number.isInteger(word) && word >= 0 && word < 4294967296)
  );
}

/**
 * A ready-to-use {@link Random} with a random seed and neutral luck, for when you do not need
 * reproducibility.
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
npm run typecheck && npm run lint && npm run format:check && npx vitest run --project core src/core/secure-random.test.ts
```

Esperado: `Tests  15 passed (15)`.

- [ ] **Step 5: Commit.**

```bash
git add src/core/secure-random.ts src/core/secure-random.test.ts src/core/random.ts
git commit -q -m "feat: add SecureRandom, a crypto-backed generator with token()" \
  -m "Same methods as Random but no seed and no state; it never falls back to Math.random, and token() does not exist on the seeded generator." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Os extras: `weighted`, `sample`, `normal`, `exponential` e `roll`

**Files:** criar `src/core/random-extras.test.ts`; substituir `src/core/random-base.ts`.

- [ ] **Step 1: Escrever o teste primeiro.** Os testes estatísticos usam sementes fixas e comparam com o valor **teórico**: a tabela de `luck` do spec vira teste (d20 com `luck` 1 dá ~13,83; teste de 50% dá 75%), e `4d6kh3` tem média 12,24. `normal` e `exponential` têm um vetor fixo que depende de `Math.log` e `Math.cos` (ver o achado sobre motores).

````ts
// src/core/random-extras.test.ts
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { scripted } from "./internal/scripted";
import { Random } from "./random";

const MAX_WORD = 0xffffffff;

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const deviation = (values: number[]) => {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
};
const draws = <T>(count: number, take: () => T) => Array.from({ length: count }, take);

describe("weighted", () => {
  it("picks in proportion to the weights", () => {
    const rng = new Random("loot");
    const counts = { common: 0, rare: 0, epic: 0 };
    for (let i = 0; i < 100_000; i++) {
      counts[rng.weighted(["common", "rare", "epic"] as const, [80, 15, 5])]++;
    }
    expect(counts.common).toBeGreaterThan(79_400);
    expect(counts.common).toBeLessThan(80_600);
    expect(counts.rare).toBeGreaterThan(14_400);
    expect(counts.rare).toBeLessThan(15_600);
    expect(counts.epic).toBeGreaterThan(4_400);
    expect(counts.epic).toBeLessThan(5_600);
  });

  it("accepts an object and returns its keys, typed", () => {
    const rng = new Random("table");
    const drop = rng.weighted({ common: 80, rare: 15, epic: 5 });
    expect(["common", "rare", "epic"]).toContain(drop);
    expectTypeOf(drop).toEqualTypeOf<"common" | "rare" | "epic">();
    expectTypeOf(rng.weighted([1, 2, 3], [1, 1, 1])).toEqualTypeOf<number>();
  });

  it("uses a strict < on the cumulative weights, so a boundary belongs to the next item", () => {
    // total 6, cumulative 1, 3, 6. A draw of exactly 0.5 lands on 3, which is the start of "c".
    expect(scripted([1 << 31, 0]).rng.weighted(["a", "b", "c"], [1, 2, 3])).toBe("c");
    expect(scripted([0, 0]).rng.weighted(["a", "b", "c"], [1, 2, 3])).toBe("a");
  });

  it("never picks an item with weight 0, at any draw and any luck", () => {
    const items = ["zero-first", "only", "zero-last"];
    for (const luck of [-1000, -1, 0, 1, 1000]) {
      for (const words of [
        [0, 0],
        [1 << 31, 0],
        [MAX_WORD, MAX_WORD],
      ]) {
        expect(scripted(words, luck).rng.weighted(items, [0, 1, 0])).toBe("only");
      }
    }
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_WORD }),
        fc.integer({ min: 0, max: MAX_WORD }),
        (a, b) => {
          expect(scripted([a, b], 3).rng.weighted(items, [0, 1, 0])).toBe("only");
        },
      ),
    );
  });

  it("slides toward the end of the list with positive luck", () => {
    const share = (luck: number) => {
      const rng = new Random({ seed: "luck", luck });
      return draws(20_000, () => rng.weighted(["first", "last"], [1, 1])).filter(
        (v) => v === "last",
      ).length;
    };
    expect(share(0)).toBeGreaterThan(9_600); // 50%
    expect(share(0)).toBeLessThan(10_400);
    expect(share(1)).toBeGreaterThan(14_600); // 75%
    expect(share(1)).toBeLessThan(15_400);
    expect(share(-1)).toBeGreaterThan(4_600); // 25%
    expect(share(-1)).toBeLessThan(5_400);
  });

  it("never picks an earlier item when luck goes up, for the same draw", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_WORD }),
        fc.integer({ min: 0, max: MAX_WORD }),
        fc.double({ min: -10, max: 10, noNaN: true }),
        fc.double({ min: 0.01, max: 10, noNaN: true }),
        (a, b, luck, extra) => {
          const items = [0, 1, 2, 3, 4];
          const weights = [3, 1, 4, 1, 5];
          const low = scripted([a, b], luck).rng.weighted(items, weights);
          const high = scripted([a, b], luck + extra).rng.weighted(items, weights);
          expect(high).toBeGreaterThanOrEqual(low);
        },
      ),
    );
  });

  it("consumes two words, whatever the luck", () => {
    for (const luck of [-3, 0, 3]) {
      const { rng, used } = scripted([1, 2, 3, 4], luck);
      rng.weighted(["a", "b"], [1, 1]);
      expect(used()).toBe(2);
    }
  });

  it("rejects tables it cannot use", () => {
    const rng = new Random("x");
    expect(() => rng.weighted(["a", "b"], [1])).toThrow("one weight per item");
    expect(() => rng.weighted(["a"], undefined as unknown as number[])).toThrow(RangeError);
    expect(() => rng.weighted([], [])).toThrow("at least one");
    expect(() => rng.weighted({})).toThrow("at least one");
    expect(() => rng.weighted(["a"], [-1])).toThrow("not negative");
    expect(() => rng.weighted(["a"], [NaN])).toThrow("finite");
    expect(() => rng.weighted(["a"], [Infinity])).toThrow("finite");
    expect(() => rng.weighted(["a", "b"], [0, 0])).toThrow("more than 0");
    expect(() => rng.weighted(["a", "b"], [1e308, 1e308])).toThrow("overflow");
  });
});

describe("sample", () => {
  it("returns the requested number of distinct positions, in random order", () => {
    const rng = new Random("sample");
    const picked = rng.sample([1, 2, 3, 4, 5, 6, 7, 8], 5);
    expect(picked).toHaveLength(5);
    expect(new Set(picked).size).toBe(5);
    for (const value of picked) expect([1, 2, 3, 4, 5, 6, 7, 8]).toContain(value);
  });

  it("samples positions, not values: duplicates in the input can come out together", () => {
    expect(new Random("dup").sample([7, 7, 9], 3).sort()).toEqual([7, 7, 9]);
  });

  it("leaves the input alone and handles 0 and all of it", () => {
    const input = [1, 2, 3];
    const rng = new Random("edge");
    expect(rng.sample(input, 0)).toEqual([]);
    expect(rng.sample(input, 3).sort()).toEqual([1, 2, 3]);
    expect(input).toEqual([1, 2, 3]);
  });

  it("reaches every ordered selection with about the same frequency", () => {
    const rng = new Random("uniform-sample");
    const counts = new Map<string, number>();
    for (let i = 0; i < 24_000; i++) {
      const key = rng.sample([1, 2, 3, 4], 2).join("");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(12);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(1_750);
      expect(count).toBeLessThan(2_250);
    }
  });

  it("is deterministic and ignores luck", () => {
    const words = Array.from({ length: 64 }, (_, i) => (i * 2654435761) >>> 0);
    expect(scripted(words, 6).rng.sample([1, 2, 3, 4, 5], 3)).toEqual(
      scripted(words, 0).rng.sample([1, 2, 3, 4, 5], 3),
    );
  });

  it("rejects a count that is not a whole number between 0 and the length", () => {
    const rng = new Random("x");
    expect(() => rng.sample([1, 2], 3)).toThrow(RangeError);
    expect(() => rng.sample([1, 2], -1)).toThrow(RangeError);
    expect(() => rng.sample([1, 2], 1.5)).toThrow(RangeError);
  });
});

describe("normal", () => {
  it("has the requested mean and deviation", () => {
    const rng = new Random("bell");
    const values = draws(50_000, () => rng.normal(100, 15));
    expect(mean(values)).toBeGreaterThan(99.6);
    expect(mean(values)).toBeLessThan(100.4);
    expect(deviation(values)).toBeGreaterThan(14.6);
    expect(deviation(values)).toBeLessThan(15.4);
  });

  it("defaults to a standard normal", () => {
    const values = draws(50_000, () => new Random("std").normal());
    expect(Number.isFinite(mean(values))).toBe(true);
    const rng = new Random("std2");
    const sample = draws(50_000, () => rng.normal());
    expect(Math.abs(mean(sample))).toBeLessThan(0.05);
    expect(deviation(sample)).toBeGreaterThan(0.97);
    expect(deviation(sample)).toBeLessThan(1.03);
  });

  it("returns the mean for a deviation of 0", () => {
    expect(new Random("x").normal(5, 0)).toBe(5);
  });

  it("is always finite, even for the extreme draws (it never takes log(0))", () => {
    for (const words of [
      [0, 0, 0, 0],
      [MAX_WORD, MAX_WORD, MAX_WORD, MAX_WORD],
    ]) {
      expect(Number.isFinite(scripted(words).rng.normal())).toBe(true);
    }
  });

  it("ignores luck and always consumes four words", () => {
    const { rng, used } = scripted([1, 2, 3, 4, 5, 6, 7, 8], 5);
    const value = rng.normal();
    expect(used()).toBe(4);
    expect(value).toBe(scripted([1, 2, 3, 4, 5, 6, 7, 8], 0).rng.normal());
  });

  it("rejects a negative or non-finite deviation and a non-finite mean", () => {
    const rng = new Random("x");
    expect(() => rng.normal(0, -1)).toThrow(RangeError);
    expect(() => rng.normal(0, NaN)).toThrow(RangeError);
    expect(() => rng.normal(0, Infinity)).toThrow(RangeError);
    expect(() => rng.normal(NaN, 1)).toThrow(RangeError);
  });

  // The algorithm (Box-Muller) is part of the contract: this value must not move on one engine.
  it("keeps its published output vector", () => {
    expect(new Random("hyrax").normal()).toBe(-0.5698265758970656);
  });
});

describe("exponential", () => {
  it("has a mean of 1 / rate", () => {
    const rng = new Random("wait");
    const values = draws(50_000, () => rng.exponential(2));
    expect(mean(values)).toBeGreaterThan(0.48);
    expect(mean(values)).toBeLessThan(0.52);
    expect(values.every((value) => value >= 0)).toBe(true);
  });

  it("defaults to a rate of 1", () => {
    const rng = new Random("rate");
    const values = draws(50_000, () => rng.exponential());
    expect(mean(values)).toBeGreaterThan(0.96);
    expect(mean(values)).toBeLessThan(1.04);
  });

  it("returns exactly +0 for the smallest draw, and stays finite for the largest", () => {
    expect(Object.is(scripted([0, 0]).rng.exponential(), 0)).toBe(true);
    expect(Number.isFinite(scripted([MAX_WORD, MAX_WORD]).rng.exponential())).toBe(true);
  });

  it("ignores luck and consumes two words", () => {
    const { rng, used } = scripted([1, 2], 4);
    rng.exponential();
    expect(used()).toBe(2);
  });

  it("rejects a rate that is not a positive finite number", () => {
    const rng = new Random("x");
    for (const bad of [0, -1, NaN, Infinity])
      expect(() => rng.exponential(bad)).toThrow(RangeError);
  });

  it("keeps its published output vector", () => {
    expect(new Random("hyrax").exponential(2)).toBe(0.14477710498585694);
  });
});

describe("roll", () => {
  it("rolls and adds the dice", () => {
    const rng = new Random("dice");
    const values = draws(20_000, () => rng.roll("2d6"));
    expect(Math.min(...values)).toBe(2);
    expect(Math.max(...values)).toBe(12);
    expect(mean(values)).toBeGreaterThan(6.9);
    expect(mean(values)).toBeLessThan(7.1);
  });

  it("adds constants and subtracts terms", () => {
    const rng = new Random("const");
    expect(rng.roll("5")).toBe(5);
    expect(rng.roll("d1+3")).toBe(4);
    expect(rng.roll("1d1-1")).toBe(0);
    expect(rng.roll("10-1d1")).toBe(9);
  });

  it("keeps the highest or lowest dice (4d6kh3 averages about 12.24)", () => {
    const rng = new Random("stats");
    const values = draws(50_000, () => rng.roll("4d6kh3"));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...values)).toBeLessThanOrEqual(18);
    expect(mean(values)).toBeGreaterThan(12.14);
    expect(mean(values)).toBeLessThan(12.34);
    const lowest = draws(20_000, () => rng.roll("2d20kl1"));
    expect(mean(lowest)).toBeGreaterThan(7.05); // the lower of two d20 averages 2870 / 400 = 7.175
    expect(mean(lowest)).toBeLessThan(7.3);
  });

  it("uses the luck of the generator on every die (luck 1 is advantage)", () => {
    const average = (luck: number) => {
      const rng = new Random({ seed: "d20", luck });
      return mean(draws(50_000, () => rng.roll("1d20")));
    };
    expect(average(0)).toBeGreaterThan(10.35); // 10.5
    expect(average(0)).toBeLessThan(10.65);
    expect(average(1)).toBeGreaterThan(13.7); // 13.83
    expect(average(1)).toBeLessThan(13.95);
    expect(average(-1)).toBeGreaterThan(7.05); // 7.17
    expect(average(-1)).toBeLessThan(7.3);
    expect(average(2)).toBeGreaterThan(15.4); // 15.5
    expect(average(2)).toBeLessThan(15.6);
  });

  it("never gives a lower total when luck goes up, for the same draws", () => {
    const words = Array.from({ length: 800 }, (_, i) => (i * 2654435761 + 12345) >>> 0);
    fc.assert(
      fc.property(
        fc.double({ min: -6, max: 6, noNaN: true }),
        fc.double({ min: 0.01, max: 6, noNaN: true }),
        (luck, extra) => {
          for (const notation of ["3d6+2", "4d6kh3", "2d20kl1", "1d100"]) {
            const low = scripted(words, luck).rng.roll(notation);
            const high = scripted(words, luck + extra).rng.roll(notation);
            expect(high).toBeGreaterThanOrEqual(low);
          }
        },
      ),
    );
  });

  it("is deterministic for a seed", () => {
    expect(new Random("r").roll("8d6+3")).toBe(new Random("r").roll("8d6+3"));
  });

  it("rejects notations it cannot read", () => {
    const rng = new Random("x");
    expect(() => rng.roll("nonsense")).toThrow(RangeError);
    expect(() => rng.roll("")).toThrow(RangeError);
    expect(() => rng.roll("2001d6")).toThrow("at most 1000 dice");
  });
});
````

- [ ] **Step 2: Ver falhar (RED).**

```bash
npx vitest run --project core src/core/random-extras.test.ts 2>&1 | grep -E "is not a function|Tests "
```

Esperado: `rng.weighted is not a function`, `rng.normal is not a function`, `rng.roll is not a function`… e `Tests  34 failed`.

- [ ] **Step 3: Implementar.** Substitui `random-base.ts` pela versão final. Em `weighted`, o laço não tem ramo de contingência: o ponto sorteado é sempre menor que o total, e a soma acumulada o alcança exatamente.

````ts
// src/core/random-base.ts
import { parseDiceCached, rollTerms } from "./internal/dice";
import type { Engine } from "./internal/engines";
import { nextDown } from "./internal/float";
import { lucky } from "./internal/luck";

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
// Both are built on first use, for the same reason as in float.ts: no work at module level.
let alphanumeric: string[] | undefined;
let hex: string[] | undefined;
const TWO_POW_32 = 4294967296;
const MAX_SPAN = 9007199254740992; // 2 ** 53

/**
 * The methods every generator shares. It draws all its randomness from an engine: a seeded one for
 * {@link Random}, a `crypto`-backed one for {@link SecureRandom}.
 *
 * **Luck** bends the *outcome* methods (`int`, `float`, `boolean`) and leaves the *structural* ones
 * (`from`, `pop`, `shuffle`, `date`, `id`, `uuid`, `bytes`) fair. It is fixed when the generator is
 * created and is `0` (neutral) by default. Every call consumes the same number of draws whatever the
 * luck is, so the same seed with more luck never gives a worse result for any single call.
 *
 * @example
 * ```ts
 * const rng = new Random({ seed: "run-1", luck: 1 });
 * rng.int(1, 20); // as if you rolled twice and kept the better one
 * ```
 */
export abstract class RandomBase {
  /** How much the outcome methods favour good results: `0` is neutral, negative is unlucky. */
  readonly luck: number;

  readonly #engine: Engine;

  /**
   * @param engine - Where the 32-bit words come from.
   * @param luck - A finite number; `0` is neutral.
   * @throws {RangeError} When `luck` is not a finite number.
   */
  protected constructor(engine: Engine, luck = 0) {
    if (!Number.isFinite(luck)) throw new RangeError(`luck must be a finite number, got ${luck}.`);
    this.luck = luck;
    this.#engine = engine;
  }

  /**
   * A fair float in `[0, 1)` with 53 bits of precision, built from two words. It is the raw
   * material of the other methods and is **never** affected by luck.
   *
   * @example
   * ```ts
   * new Random("x").next(); // => a number in [0, 1)
   * ```
   *
   * @returns The float.
   */
  next(): number {
    const high = this.#engine.next32() >>> 5;
    const low = this.#engine.next32() >>> 6;
    return (high * 67108864 + low) / 9007199254740992;
  }

  /**
   * A float in `[min, max)`: the result is never `max`. The bounds may be given in either order.
   * Affected by luck.
   *
   * @example
   * ```ts
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
    const value = low + lucky(this.next(), this.luck) * (high - low);
    if (value < high) return value;
    // Rounding reached `high` (a tiny range at a large magnitude): step back to the last double below.
    return Math.max(low, nextDown(high));
  }

  /**
   * An integer between `min` and `max`, **both included**. With luck `0` it has no bias at all: it
   * keeps the top bits of a word and draws again when the value falls outside the range. The bounds
   * may be given in either order, and fractional bounds are rounded inward (`1.2..2.8` means `2`).
   * Affected by luck.
   *
   * @example
   * ```ts
   * new Random("x").int(1, 6); // => 1, 2, 3, 4, 5 or 6
   * ```
   *
   * @param min - One bound.
   * @param max - The other bound.
   * @returns The random integer.
   * @throws {RangeError} When the range holds no integer, is not finite or is wider than 2^53.
   */
  int(min: number, max: number): number {
    const low = Math.ceil(Math.min(min, max));
    const high = Math.floor(Math.max(min, max));
    if (!Number.isFinite(low) || !Number.isFinite(high) || low > high) {
      throw new RangeError(`int() found no integer between ${min} and ${max}.`);
    }
    const span = high - low + 1;
    const index = this.#below(span, "int()");
    // Always drawn, so a call costs the same at every luck; only used when luck bends the result.
    const fraction = this.#engine.next32() / TWO_POW_32;
    if (this.luck === 0) return low + index;
    return low + Math.min(span - 1, Math.floor(span * lucky((index + fraction) / span, this.luck)));
  }

  /**
   * `true` with the given probability. Affected by luck: at luck 1 a 50% check succeeds 75% of the time.
   *
   * @example
   * ```ts
   * new Random("x").boolean(0.75); // 75% true
   * ```
   *
   * @param chance - The probability of `true`, from `0` to `1` (default `0.5`).
   * @returns The random boolean.
   * @throws {RangeError} When `chance` is outside `0..1`. A percentage such as `50` is an error,
   *   not "always true".
   */
  boolean(chance = 0.5): boolean {
    if (!(chance >= 0 && chance <= 1)) {
      throw new RangeError(`boolean() needs a chance between 0 and 1, got ${chance}.`);
    }
    return lucky(this.next(), this.luck) >= 1 - chance;
  }

  /**
   * A random element of an array. Fair: ignores luck.
   *
   * @example
   * ```ts
   * new Random("x").from([10, 20, 30]); // => 10, 20 or 30
   * ```
   *
   * @param source - The array to pick from.
   * @returns An element, or `undefined` when the array is empty.
   */
  from<T>(source: readonly T[]): T | undefined;
  /**
   * A random character (code point) of a string. Fair: ignores luck.
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
   * A random value of an object. Fair: ignores luck.
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
    return items[this.#below(items.length, "from()")];
  }

  /**
   * Removes a random element from `array` (mutating it) and returns it. Fair: ignores luck.
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
    return array.splice(this.#below(array.length, "pop()"), 1)[0];
  }

  /**
   * A shuffled copy of `array` (Fisher-Yates). With a seed every permutation is equally likely up
   * to 34 elements (the engine has 128 bits of state); past that, use {@link SecureRandom}. The input
   * is left untouched. Fair: ignores luck.
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
      const j = this.#below(i + 1, "shuffle()");
      const held = copy[i] as T;
      copy[i] = copy[j] as T;
      copy[j] = held;
    }
    return copy;
  }

  /**
   * A date between `after` and `before`, both included, at millisecond resolution. The defaults
   * are the Unix epoch and now, so pass both bounds for a reproducible result. Fair: ignores luck.
   *
   * @example
   * ```ts
   * new Random("x").date("2020-01-01", "2020-12-31"); // => a date in 2020
   * ```
   *
   * @param after - One bound (default: the epoch).
   * @param before - The other bound (default: now).
   * @returns The random date.
   * @throws {RangeError} When a bound is not a valid date or the range is wider than 2^53 ms.
   */
  date(after: number | string | Date = 0, before: number | string | Date = Date.now()): Date {
    const a = new Date(after).getTime();
    const b = new Date(before).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) throw new RangeError("date() needs valid date bounds.");
    const low = Math.min(a, b);
    return new Date(low + this.#below(Math.max(a, b) - low + 1, "date()"));
  }

  /**
   * A random string of characters from `alphabet`. Not unique, and not secret unless the generator
   * is a {@link SecureRandom}. Fair: ignores luck.
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
    const characters =
      alphabet === ALPHANUMERIC
        ? (alphanumeric ??= Array.from(ALPHANUMERIC))
        : Array.from(alphabet);
    if (characters.length === 0) throw new RangeError("id() needs a non-empty alphabet.");
    let id = "";
    for (let i = 0; i < length; i++) id += characters[this.#below(characters.length, "id()")];
    return id;
  }

  /**
   * A version 4 UUID drawn from this generator, so it is reproducible for a given seed. Fair:
   * ignores luck. Unpredictable only for a {@link SecureRandom}.
   *
   * @example
   * ```ts
   * new Random("x").uuid(); // => "3f2b8c1e-9a47-4d0e-8b5a-6c1d2e7f9a03" (the same for this seed)
   * ```
   *
   * @returns The UUID, in lowercase.
   */
  uuid(): string {
    const HEX = (hex ??= Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0")));
    const a = this.#engine.next32();
    const b = this.#engine.next32();
    const c = this.#engine.next32();
    const d = this.#engine.next32();
    return (
      `${HEX[a >>> 24]}${HEX[(a >>> 16) & 255]}${HEX[(a >>> 8) & 255]}${HEX[a & 255]}-` +
      `${HEX[b >>> 24]}${HEX[(b >>> 16) & 255]}-${HEX[((b >>> 8) & 15) | 64]}${HEX[b & 255]}-` +
      `${HEX[((c >>> 24) & 63) | 128]}${HEX[(c >>> 16) & 255]}-${HEX[(c >>> 8) & 255]}${HEX[c & 255]}` +
      `${HEX[d >>> 24]}${HEX[(d >>> 16) & 255]}${HEX[(d >>> 8) & 255]}${HEX[d & 255]}`
    );
  }

  /**
   * Random bytes, four per word, most significant first. Fair: ignores luck.
   *
   * @example
   * ```ts
   * new Random("x").bytes(4); // => Uint8Array [ 213, 7, 88, 140 ]
   * ```
   *
   * @param count - How many bytes.
   * @returns The bytes.
   * @throws {RangeError} When `count` is not a non-negative integer.
   */
  bytes(count: number): Uint8Array {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(`bytes() needs a non-negative integer count, got ${count}.`);
    }
    const bytes = new Uint8Array(count);
    for (let i = 0; i < count; i += 4) {
      const word = this.#engine.next32();
      bytes[i] = word >>> 24;
      if (i + 1 < count) bytes[i + 1] = (word >>> 16) & 255;
      if (i + 2 < count) bytes[i + 2] = (word >>> 8) & 255;
      if (i + 3 < count) bytes[i + 3] = word & 255;
    }
    return bytes;
  }

  /**
   * Picks one item, in proportion to its weight: `[80, 15, 5]` picks the first item 80% of the
   * time. Items with weight `0` are never picked. Affected by luck, which slides the pick toward the
   * **end of the list**: with positive luck the later, rarer entries come up more often, so list
   * items from the most common to the rarest.
   *
   * @example
   * ```ts
   * new Random("x").weighted(["common", "rare", "epic"], [80, 15, 5]);
   * ```
   *
   * @param items - What to pick from.
   * @param weights - One weight per item: finite and not negative, adding up to more than `0`.
   * @returns The picked item.
   * @throws {RangeError} For a table it cannot use: mismatched lengths, no items, a bad weight or a
   *   zero (or overflowing) total.
   */
  weighted<T>(items: readonly T[], weights: readonly number[]): T;
  /**
   * Picks one key of an object, in proportion to its weight. Same rules as the array form. Note that
   * JavaScript lists integer-like keys (`"1"`, `"2"`) first, whatever order you wrote them in.
   *
   * @example
   * ```ts
   * new Random("x").weighted({ common: 80, rare: 15, epic: 5 }); // => "common", "rare" or "epic"
   * ```
   *
   * @param table - Each key with its weight.
   * @returns The picked key.
   * @throws {RangeError} For a table it cannot use.
   */
  weighted<K extends string>(table: Readonly<Record<K, number>>): K;
  weighted(
    first: readonly unknown[] | Readonly<Record<string, number>>,
    second?: readonly number[],
  ): unknown {
    const isList = Array.isArray(first);
    const items: readonly unknown[] = isList ? (first as readonly unknown[]) : Object.keys(first);
    const weights: readonly number[] | undefined = isList
      ? second
      : Object.values(first as Readonly<Record<string, number>>);
    if (!weights || weights.length !== items.length) {
      throw new RangeError("weighted() needs one weight per item.");
    }
    if (items.length === 0) throw new RangeError("weighted() needs at least one item.");

    let total = 0;
    for (const weight of weights) {
      if (!Number.isFinite(weight) || weight < 0) {
        throw new RangeError(`weighted() weights must be finite and not negative, got ${weight}.`);
      }
      total += weight;
    }
    if (!Number.isFinite(total)) throw new RangeError("weighted() weights overflow when added up.");
    if (total <= 0) throw new RangeError("weighted() needs weights that add up to more than 0.");

    // The point is always below `total` (the draw is below 1 and rounds down), and the running sum
    // reaches `total` exactly, so this stops on an item that has weight and never runs past the end.
    const point = lucky(this.next(), this.luck) * total;
    let index = 0;
    let cumulative = weights[0] as number;
    while (point >= cumulative) cumulative += weights[++index] as number;
    return items[index];
  }

  /**
   * `count` items chosen without repeating a position, in random order (a partial Fisher-Yates).
   * It samples positions, not values: two equal items in the input can both come out. The input is
   * left untouched. Fair: ignores luck.
   *
   * @example
   * ```ts
   * new Random("x").sample(["a", "b", "c", "d", "e"], 3); // => e.g. ["d", "a", "e"]
   * ```
   *
   * @param items - What to sample from.
   * @param count - How many, from `0` up to `items.length`.
   * @returns The chosen items.
   * @throws {RangeError} When `count` is not a whole number between `0` and the number of items.
   */
  sample<T>(items: readonly T[], count: number): T[] {
    if (!Number.isInteger(count) || count < 0 || count > items.length) {
      throw new RangeError(
        `sample() needs a whole number from 0 to ${items.length}, got ${count}.`,
      );
    }
    const pool = [...items];
    const picked: T[] = [];
    for (let i = 0; i < count; i++) {
      const j = i + this.#below(pool.length - i, "sample()");
      const held = pool[i] as T;
      pool[i] = pool[j] as T;
      pool[j] = held;
      picked.push(pool[i] as T);
    }
    return picked;
  }

  /**
   * A normally distributed number (Box-Muller): a bell curve around `mean`. It uses four words per
   * call and never takes `log(0)`. Fair: ignores luck.
   *
   * @example
   * ```ts
   * new Random("x").normal(100, 15); // => e.g. 108.4
   * ```
   *
   * @param mean - The centre of the curve (default `0`).
   * @param deviation - How wide it is (default `1`); `0` always returns the mean.
   * @returns The number.
   * @throws {RangeError} When `mean` or `deviation` is not finite, or `deviation` is negative.
   */
  normal(mean = 0, deviation = 1): number {
    if (!Number.isFinite(mean) || !Number.isFinite(deviation) || deviation < 0) {
      throw new RangeError(
        `normal() needs a finite mean and a deviation of 0 or more, got ${mean} and ${deviation}.`,
      );
    }
    const radius = Math.sqrt(-2 * Math.log(1 - this.next()));
    const angle = 2 * Math.PI * this.next();
    return mean + deviation * radius * Math.cos(angle);
  }

  /**
   * An exponentially distributed number: the waiting time between events that happen `rate` times
   * per unit. The mean is `1 / rate`. Fair: ignores luck.
   *
   * @example
   * ```ts
   * new Random("x").exponential(2); // => e.g. 0.31 (a mean of 0.5)
   * ```
   *
   * @param rate - Events per unit, greater than `0` (default `1`).
   * @returns The waiting time.
   * @throws {RangeError} When `rate` is not a positive, finite number.
   */
  exponential(rate = 1): number {
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new RangeError(`exponential() needs a positive, finite rate, got ${rate}.`);
    }
    return (0 - Math.log(1 - this.next())) / rate;
  }

  /**
   * Rolls dice from a notation and adds them up. Terms are joined with `+` or `-`: each is `NdM`
   * (N dice with M sides; N defaults to 1), optionally followed by `khK` or `klK` to keep the K
   * highest or lowest dice, or a whole number. Spaces and case are ignored. **Every die uses the
   * generator's luck**, so luck 1 on a `1d20` is exactly advantage.
   *
   * @example
   * ```ts
   * new Random("x").roll("2d6+3"); // => 5 to 15
   * new Random("x").roll("4d6kh3"); // => the best three of four d6
   * new Random("x").roll("1d8+1d6-1");
   * ```
   *
   * @param notation - The dice notation.
   * @returns The total.
   * @throws {RangeError} For a notation it cannot read, or more than 1000 dice in total.
   */
  roll(notation: string): number {
    return rollTerms(parseDiceCached(notation), (sides) => this.int(1, sides));
  }

  /**
   * A uniform integer in `[0, span)` with no bias. It keeps the top bits of a word, just enough to
   * cover `span`, and draws again when the value lands outside (fewer than two draws on average).
   * Spans above 2^32 combine two words. Independent of luck.
   *
   * @param span - How many values, from 1 up to 2^53.
   * @param method - Who is asking, for the error message.
   * @returns The index.
   */
  #below(span: number, method: string): number {
    if (span > MAX_SPAN)
      throw new RangeError(`${method} range is too wide (more than 2^53 values).`);
    if (span <= 1) return 0;

    if (span <= TWO_POW_32) {
      const shift = Math.clz32(span - 1);
      let value: number;
      do value = this.#engine.next32() >>> shift;
      while (value >= span);
      return value;
    }

    const highBits = 32 - Math.clz32(Math.floor((span - 1) / TWO_POW_32));
    let value: number;
    do value = (this.#engine.next32() >>> (32 - highBits)) * TWO_POW_32 + this.#engine.next32();
    while (value >= span);
    return value;
  }
}
````

- [ ] **Step 4: Ver passar (GREEN).**

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run --project core src/core/random-extras.test.ts
```

Esperado: `Tests  34 passed (34)`.

- [ ] **Step 5: Provar que os testes pegam peso zero sorteado e consumo variável de sorteios.**

```bash
cp src/core/random-base.ts /tmp/random-base.bak
sed -i 's/while (point >= cumulative)/while (point > cumulative)/' src/core/random-base.ts
npx vitest run --project core src/core/random-extras.test.ts 2>&1 | grep -E "^ +×"
cp /tmp/random-base.bak src/core/random-base.ts
sed -i 's/const fraction = this.#engine.next32() \/ TWO_POW_32;/const fraction = this.luck === 0 ? 0 : this.#engine.next32() \/ TWO_POW_32;/' src/core/random-base.ts
npx vitest run --project core src/core/random.test.ts 2>&1 | grep -E "^ +×"
cp /tmp/random-base.bak src/core/random-base.ts && git status --short
```

Esperado: a primeira mutação faz falhar `uses a strict < on the cumulative weights, so a boundary belongs to the next item` e `never picks an item with weight 0, at any draw and any luck`; a segunda faz falhar `consumes the same number of words whatever the luck` e os dois testes de viés por enumeração.

- [ ] **Step 6: Suíte inteira do `Random`, com cobertura.**

```bash
npx vitest run --coverage 2>&1 | grep -E "Test Files|Tests |ERROR|threshold"
```

Esperado: nenhum arquivo do `core` listado com lacuna de cobertura, e nenhum erro de `threshold`.

- [ ] **Step 7: Commit.**

```bash
git add src/core/random-base.ts src/core/random-extras.test.ts
git commit -q -m "feat: add weighted, sample, normal, exponential and roll to Random" \
  -m "weighted never picks a zero-weight item and slides toward the end of the list with luck; roll parses dice notation with limits and applies luck to every die." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `StringBuilder`

**Files:** criar `src/core/string-builder.test.ts` e `src/core/string-builder.ts`. Sem mudanças em relação ao plano anterior.

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
npx vitest run --project core src/core/string-builder.test.ts 2>&1 | grep -E "Cannot find module|Test Files"
```

Esperado: `Cannot find module './string-builder'`.

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

- [ ] **Step 4: Ver passar (GREEN) e commitar.**

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run --project core src/core/string-builder.test.ts
git add src/core/string-builder.ts src/core/string-builder.test.ts
git commit -q -m "feat: rebuild StringBuilder with options, final-text semantics and build()" \
  -m "The prefix is applied once, unique and remove compare the final text, and if/elif/else chains are documented and tested." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

Esperado: `Tests  25 passed (25)`.

---

## Task 9: `Suspend`

**Files:** criar `src/core/suspend.test.ts` e `src/core/suspend.ts`. Sem mudanças em relação ao plano anterior.

- [ ] **Step 1: Escrever o teste primeiro.** Usa timers falsos do Vitest: `sleepFor` avança o relógio de parede sem disparar os timers, que é exatamente o que uma suspensão faz. A seção `the first tick after starting` é a regressão do bug do `last`.

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
npx vitest run --project core src/core/suspend.test.ts 2>&1 | grep -E "Cannot find module|Test Files"
```

Esperado: `Cannot find module './suspend'`.

- [ ] **Step 3: Implementar.** O timer é iniciado **antes** de registrar o listener, para que uma falha ao iniciar (sem `setInterval`) não deixe estado pela metade.

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

Esperado: falham `does not report the time before the first listener was added` e `does not report the time while there were no listeners`.

- [ ] **Step 6: Commit.**

```bash
git add src/core/suspend.ts src/core/suspend.test.ts
git commit -q -m "feat: rebuild Suspend as an instance that runs in any runtime" \
  -m "No window access, unref'd timer, configurable threshold and interval, listener errors isolated, and last is reset on start (the legacy class reported phantom suspensions)." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Barrel da raiz

**Files:** substituir `src/index.ts` e `src/index.test.ts`.

- [ ] **Step 1: Escrever o teste primeiro.** A lista de exports ganha `Random`, `random`, `StringBuilder` e `Suspend`. `SecureRandom` **não** entra: sai só como tipo. O teste ordena os dois lados porque `Array.prototype.sort` põe maiúsculas antes de minúsculas.

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

Esperado: `exposes exactly the intended public API` falha.

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
export type { RandomOptions, RandomState } from "./core/random";
export type { SecureRandom } from "./core/secure-random";
export { splitWords, toCamelCase, toKebabCase, toPascalCase, toSnakeCase } from "./core/string";
export { StringBuilder } from "./core/string-builder";
export type { StringBuilderOptions } from "./core/string-builder";
export { Suspend } from "./core/suspend";
export type { SuspendCallback, SuspendOptions } from "./core/suspend";
export { traceHierarchy } from "./core/tree";
export type { AnyString, Maybe, Nullable, Numeric } from "./core/types";
````

- [ ] **Step 4: Ver passar (GREEN) e rodar a suíte inteira com cobertura.**

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run --coverage
```

Esperado: `Test Files  23 passed (23)`, `Tests  346 passed (346)`, nenhuma linha de cobertura listada e nenhum erro de `threshold`.

- [ ] **Step 5: Commit.**

```bash
git add src/index.ts src/index.test.ts
git commit -q -m "feat: export Random, StringBuilder and Suspend from the root entrypoint" \
  -m "Also exports the option, state and callback types that appear in their signatures, and SecureRandom as a type only." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: `npm run bench`

**Files:** criar `scripts/bench.mjs`; modificar `package.json`.

- [ ] **Step 1: Criar o script.** É um **relatório, não um gate**: tempos variam entre máquinas e execuções, então o CI nunca o usa para falhar. Serve para tornar reproduzível a afirmação "otimizado".

````js
// scripts/bench.mjs
// Prints how fast the Random methods are, next to the native alternatives.
//
//   npm run bench        (builds first)
//
// This is a report, not a gate: timings vary between machines and runs, so CI never fails on it.
import { Random } from "../dist/index.js";

const WARM_UP = 200_000;

/** Runs `fn` for a while and returns the mean nanoseconds per call. */
function measure(fn, calls) {
  for (let i = 0; i < WARM_UP; i++) fn();
  let sink = 0;
  const start = performance.now();
  for (let i = 0; i < calls; i++) sink += fn() ? 1 : 0;
  const elapsed = performance.now() - start;
  if (sink < 0) console.log(sink); // keeps the loop from being optimised away
  return (elapsed / calls) * 1e6;
}

const rows = [];
const bench = (group, name, fn, calls = 1_000_000) => {
  rows.push({ group, name, ns: measure(fn, calls) });
};

const rng = new Random("bench");
const secure = Random.secure();
const list = Array.from({ length: 100 }, (_, i) => i);
const words = new Uint32Array(1);

bench("native", "Math.random()", () => Math.random());
bench("native", "crypto.getRandomValues(1 word)", () => crypto.getRandomValues(words)[0]);
bench("native", "crypto.randomUUID()", () => crypto.randomUUID(), 300_000);

bench("seeded", "next()", () => rng.next());
bench("seeded", "float()", () => rng.float());
bench("seeded", "int(1, 6)", () => rng.int(1, 6));
bench("seeded", "boolean()", () => rng.boolean());
bench("seeded", "from(100 items)", () => rng.from(list));
bench("seeded", "weighted(3 items)", () => rng.weighted(["a", "b", "c"], [80, 15, 5]));
bench("seeded", "normal()", () => rng.normal());
bench("seeded", 'roll("2d6+3")', () => rng.roll("2d6+3"), 300_000);
bench("seeded", "id(16)", () => rng.id(16), 300_000);
bench("seeded", "uuid()", () => rng.uuid(), 300_000);
bench("seeded", "shuffle(100 items)", () => rng.shuffle(list), 100_000);
bench("seeded", 'fork("a", 1)', () => rng.fork("a", 1), 300_000);

bench("secure", "int(1, 6)", () => secure.int(1, 6));
bench("secure", "uuid()", () => secure.uuid(), 300_000);
bench("secure", "token()", () => secure.token(), 300_000);

const width = Math.max(...rows.map((row) => row.name.length));
let group = "";
for (const row of rows) {
  if (row.group !== group) {
    group = row.group;
    console.log(`\n${group}`);
  }
  console.log(`  ${row.name.padEnd(width)}  ${row.ns.toFixed(0).padStart(6)} ns/op`);
}
````

- [ ] **Step 2: Registrar o script e rodar.**

```bash
npm pkg set scripts.bench="npm run build && node scripts/bench.mjs"
npx prettier --write package.json scripts/bench.mjs
npm run bench
```

Esperado (Node 26; os números variam por máquina, as **proporções** não): `uuid()` seedado em torno de **130 ns**, abaixo do `crypto.randomUUID()` nativo; `id(16)` ~220 ns; `int(1, 6)` ~15 ns; `roll("2d6+3")` ~265 ns; no modo seguro `int` ~46 ns e `token()` ~390 ns.

- [ ] **Step 3: Commit.**

```bash
git add scripts/bench.mjs package.json
git commit -q -m "chore: add a bench script that reports Random speed against the natives" \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Orçamento de tamanho, smoke test com determinismo entre runtimes e CONTRIBUTING

**Files:** modificar `package.json`; substituir `scripts/smoke.mjs` e `CONTRIBUTING.md`.

- [ ] **Step 1: Cinco limites de `size-limit`.** O de `clamp` isolado (150 B) é o guarda contra trabalho no nível do módulo.

```bash
npm pkg set --json size-limit='[{"name":"root entrypoint, everything","path":"dist/index.js","import":"*","limit":"6 kB"},{"name":"root entrypoint, clamp only","path":"dist/index.js","import":"{ clamp }","limit":"150 B"},{"name":"root entrypoint, Random only","path":"dist/index.js","import":"{ Random }","limit":"4 kB"},{"name":"root entrypoint, StringBuilder only","path":"dist/index.js","import":"{ StringBuilder }","limit":"400 B"},{"name":"root entrypoint, Suspend only","path":"dist/index.js","import":"{ Suspend }","limit":"700 B"}]'
npx prettier --write package.json
npm run build && npm run size
```

Esperado (medido; podem variar poucos bytes): núcleo inteiro **~4,62 kB**, `clamp` **~76 B**, `Random` **~3,15 kB**, `StringBuilder` **~254 B**, `Suspend` **~494 B**, todos abaixo dos limites.

- [ ] **Step 2: Provar que estourar o limite quebra, e que trabalho no nível do módulo é pego.**

```bash
cp package.json /tmp/package.json.bak
sed -i 's/"limit": "150 B"/"limit": "50 B"/' package.json
npm run size 2>&1 | grep -E "exceeded"; npx size-limit >/dev/null 2>&1; echo "exit=$?"
cp /tmp/package.json.bak package.json
```

Esperado: `Package size limit has exceeded by ... B` e `exit=1`.

- [ ] **Step 3: Substituir `scripts/smoke.mjs`.** Além do consumidor TypeScript (com `Random.secure()`, `state`, `fork`, `weighted`, `roll` e duas linhas `@ts-expect-error` de segurança de tipos), fixa **dois valores de referência**: `EXACT` (caminhos inteiros: precisa coincidir bit a bit em todo runtime) e `TRANSCENDENTAL` (`luck` diferente de zero, `normal` e `exponential`: dependem de `Math.pow`, `Math.log` e `Math.cos`, que o ECMAScript não obriga a arredondar igual em todo motor). Como Deno e Node usam V8, o **Bun** (JavaScriptCore) no CI é a comparação entre motores.

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
// EXACT covers everything built on integer arithmetic (the engine, int, from, shuffle, sample,
// weighted, roll, uuid, bytes, fork): it must match bit for bit everywhere.
// TRANSCENDENTAL covers luck != 0, normal and exponential, which use Math.pow, Math.log and
// Math.cos. ECMAScript does not require those to round identically in every engine, so a
// mismatch there is reported separately. Neither value may change without a major version.
const EXACT =
  '(() => { const r = new Random("hyrax"); const f = r.fork("terrain", 3, 4); return [r.int(1, 100), r.uuid(), Array.from(r.bytes(4)).join(","), f.next(), r.sample([1, 2, 3, 4, 5], 3).join(""), r.shuffle([1, 2, 3, 4, 5]).join(""), r.weighted(["a", "b", "c"], [80, 15, 5]), r.roll("2d6+3")].join(" "); })()';
const EXACT_EXPECTED =
  "33 627a9f02-43de-4af3-acb3-e143723b09c5 99,168,18,109 0.31158723663990495 452 21543 a 6";
const TRANSCENDENTAL =
  '(() => { const r = new Random({ seed: "hyrax", luck: 1.5 }); return [r.float(), r.int(1, 20), r.boolean(), r.normal(), r.exponential(2)].join(" "); })()';
const TRANSCENDENTAL_EXPECTED = "0.5756361196616097 17 false 0.9888625997383569 0.5883254698180862";

// A real TypeScript consumer of the public API. `@ts-expect-error` lines make the
// compile fail if the types ever become looser than intended.
const CONSUMER = `
import { alias, clamp, fabricate, isNumeric, random, Random, StringBuilder, Suspend, toCamelCase, traceHierarchy } from "${NAME}";
import type { RandomState, SecureRandom } from "${NAME}";
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

export const child: Random = new Random({ seed: "w", luck: 1 }).fork("terrain", 3, 4);
export const saved: RandomState = child.state();
export const restored: Random = Random.restore(saved);
export const drop: "common" | "rare" = new Random("x").weighted({ common: 80, rare: 20 });
export const total: number = new Random("x").roll("2d6+3");
const secure: SecureRandom = Random.secure();
export const session: string = secure.token();

// @ts-expect-error a secure generator has no state: it cannot be replayed
secure.state();
// @ts-expect-error a seeded generator has no token: a reproducible token would be a trap
new Random("seed").token();
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

  const script = `console.log(${EXACT}); console.log(${TRANSCENDENTAL});`;
  const viaEsm = run(
    "node",
    ["--input-type=module", "-e", `import { Random } from "${NAME}"; ${script}`],
    dir,
  ).trim();
  const viaCjs = run(
    "node",
    ["-e", `const { Random } = require("${NAME}"); ${script}`],
    dir,
  ).trim();
  const expected = `${EXACT_EXPECTED}\n${TRANSCENDENTAL_EXPECTED}`;
  if (viaEsm !== expected || viaCjs !== expected) {
    throw new Error(
      `Seeded output changed.\nESM:\n${viaEsm}\nCJS:\n${viaCjs}\nExpected:\n${expected}`,
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
    const exact = ${EXACT};
    if (exact !== "${EXACT_EXPECTED}") throw new Error("EXACT seeded output differs: " + exact);
    const transcendental = ${TRANSCENDENTAL};
    if (transcendental !== "${TRANSCENDENTAL_EXPECTED}") {
      throw new Error("TRANSCENDENTAL seeded output differs (Math.pow/log/cos): " + transcendental);
    }`;
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

- [ ] **Step 4: Rodar, e provar que os dois valores são verificados.**

```bash
npm run build
npm run smoke
HYRAX_SMOKE_RUNTIMES=deno node scripts/smoke.mjs
D=$(mktemp -d); npm pack --pack-destination "$D" >/dev/null 2>&1
sed 's/"33 627a9f02/"34 627a9f02/' scripts/smoke.mjs > scripts/smoke.bad.mjs
node scripts/smoke.bad.mjs "$D"/*.tgz 2>&1 | grep -oE "Seeded output changed\." | head -1
sed 's/"0.5756361196616097/"0.5756361196616098/' scripts/smoke.mjs > scripts/smoke.bad.mjs
node scripts/smoke.bad.mjs "$D"/*.tgz 2>&1 | grep -oE "Seeded output changed\." | head -1
rm -f scripts/smoke.bad.mjs; rm -rf "$D"
```

Esperado: `Smoke test passed: 3 entrypoints x (ESM + CJS) + consumer types`; a segunda termina em `... + consumer types + deno` (pule se o Deno não estiver instalado); as duas variantes com o valor de referência alterado imprimem `Seeded output changed.`

- [ ] **Step 5: Substituir `CONTRIBUTING.md`.** Ganha as regras que esta fase criou: nada de trabalho no nível do módulo, testes com `scripted()`, testes estatísticos contra o valor teórico, e a saída de uma seed como contrato.

````markdown
# Contributing

## Setup

Use Node 24 (`nvm use`, see `.nvmrc`; Node 22 or newer works) and install with `npm ci`.

## Commands

| Command                  | What it does                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `npm test`               | Runs the tests (`core` in Node, `dom` and `react` in happy-dom)                                    |
| `npm run test:coverage`  | Same, with coverage. `src/core` must stay at 95% or above                                          |
| `npm run lint`           | ESLint. Every exported symbol needs TSDoc with an `@example`                                       |
| `npm run typecheck`      | Type-checks each entrypoint and the tests                                                          |
| `npm run check:boundary` | Fails if `src/core` starts compiling against DOM globals                                           |
| `npm run build`          | Builds `dist/` (ESM, CJS and type declarations)                                                    |
| `npm run check:package`  | `publint` and Are the Types Wrong on the built package                                             |
| `npm run size`           | Enforces the bundle-size budget (whole entrypoint and one function)                                |
| `npm run bench`          | Prints how fast the `Random` methods are next to `Math.random` and `crypto` (a report, not a gate) |
| `npm run smoke`          | Installs the packed tarball, imports every entrypoint and type-checks a consumer                   |
| `npm run check`          | Everything above, in CI order                                                                      |

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

## Testing and performance conventions

- **No work at module level in `src/core`.** No top-level `new Map()`, `Array.from(...)`, typed arrays or `**`
  constants: build them on first use inside the function, or write the literal. A bundler cannot prove a
  top-level call harmless, so it keeps it, and a build that only imports `clamp` starts carrying it. The
  `clamp only` budget in `size-limit` is the guard.
- **Test what a method does with exact draws.** `scripted(words)` (in `src/core/internal/scripted.ts`) serves the
  32-bit words you give it, so a test can prove a mapping for every bit pattern instead of sampling. It throws when
  the words run out, because cycling them can loop forever inside a rejection sampler.
- **Statistical tests use a fixed seed and compare with the theoretical value**, never with what the code happens
  to produce, so they are deterministic and still mean something.
- **A seed's output is a contract.** Vectors in `random*.test.ts` and the values in `scripts/smoke.mjs` may only
  change together with a major version.
````

- [ ] **Step 6: Formatar e commitar.**

```bash
npx prettier --write scripts CONTRIBUTING.md package.json && npm run format:check
git add package.json scripts/smoke.mjs CONTRIBUTING.md
git commit -q -m "test: budget each class, check seeded output across runtimes and document the rules" \
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

Esperado: código 0, com `Test Files  23 passed (23)` / `Tests  346 passed (346)`, `publint` (`All good!`), os cinco limites do `size-limit` e `Smoke test passed: 3 entrypoints x (ESM + CJS) + consumer types`.

- [ ] **Step 2: Estabilidade.** Os testes usam propriedades e estatística; cada execução usa sementes novas.

```bash
fails=0; for i in $(seq 1 25); do timeout 120 npx vitest run --project core >/dev/null 2>&1 || fails=$((fails+1)); done; echo "falhas: $fails de 25"
```

Esperado: `falhas: 0 de 25`. Uma falha é um contraexemplo real: leia a semente na saída de `npx vitest run --project core` e decida se o defeito é da função ou do teste. **Use `timeout`**: um laço infinito num teste trava o Vitest sem aviso.

- [ ] **Step 3: Conferir a árvore.**

```bash
git status --short && git log --oneline main..HEAD
```

Esperado: nenhum arquivo pendente. Se a Fase 1 já está no `main`, são 13 commits (o plano mais as Tasks 1 a 12, sendo a Task 3 um só commit).

- [ ] **Step 4: Checklist de aceitação da Fase 2.**

  - [ ] `npm run check` passa a partir de instalação limpa
  - [ ] A raiz exporta as 20 funções e classes esperadas (as 16 da Fase 1 mais `Random`, `random`, `StringBuilder`, `Suspend`) e os tipos `RandomOptions`, `RandomState`, `SecureRandom`, `StringBuilderOptions`, `SuspendCallback`, `SuspendOptions`, e nada além (o teste da superfície pública garante)
  - [ ] Cobertura de `src/core` em 100%
  - [ ] Nenhum uso de `window`, `document`, `process` ou `require` em `src/core`, fora dos testes e dos comentários. O comando abaixo deve sair **vazio**:

```bash
grep -rEn '\b(window|document|process|require)\b' src/core --include='*.ts' | grep -v '\.test\.ts' | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)'
```

  - [ ] `size-limit` passa, e importar só `clamp` continua custando ~76 B
  - [ ] `rng.token()` num `Random` e `secure.state()` num `SecureRandom` **não compilam** (as duas linhas `@ts-expect-error` do smoke garantem)
  - [ ] O smoke test dá a mesma saída seedada em Node ESM, Node CJS, Deno e Bun (no CI)
  - [ ] Nenhum bug legado reaparece: `Random` (viés, cache global, `uuid`, `boolean(50)`), `Suspend` (`last`, `window`), `StringBuilder` (prefixo)

- [ ] **Step 5: Parar aqui e pedir autorização ao usuário** antes de `git push` e de abrir o PR. Depois do push, acompanhe o CI com `gh pr checks <número> --watch`. Para conferir o `runtimes` de verdade, pegue o ID do job pelo link do check (`gh pr checks <número> --json name,link`) e leia a linha final do smoke no log: o job é `continue-on-error`. **É lá que o Bun diz se `TRANSCENDENTAL` bate entre motores.** Se não bater, o que muda é a redação do spec (a garantia passa a ser "dentro de um arredondamento" também na prática), e não o código.

---

## Notas para as próximas fases

1. **Fase 5 (docs).** O script de exemplos do TSDoc precisa tratar blocos multilinha (`fabricate`, `alias`, `Suspend`) e exemplos com resultado não determinístico (`random.int(1, 6)`), que devem ser marcados para execução só de tipos. A página do `Random` deve trazer a tabela de `luck`, a de garantias e o aviso "não é criptográfico".
2. **Contrato de determinismo.** Os vetores dos `random*.test.ts` e os dois valores do `scripts/smoke.mjs` são a documentação executável do contrato. Qualquer mudança neles exige um novo major.
3. **`AggregateError`** exige `lib: ES2021` ou superior: já está coberto pelo `ES2022` do `core`.
4. **Se o peso do `Random` incomodar** (3,15 kB, dos quais 0,92 kB são os cinco extras), o caminho é mover `weighted`, `sample`, `normal`, `exponential` e `roll` para funções tree-shakeable que recebem o gerador (`roll(rng, "2d6")`). Nenhuma saída muda.
