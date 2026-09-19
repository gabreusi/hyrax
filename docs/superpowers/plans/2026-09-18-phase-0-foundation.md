# Hyrax Fase 0 (Fundação): plano de implementação

Spec: `docs/superpowers/specs/2026-09-18-hyrax-revival-design.md` (seções 2, 6 e 8).

**Objetivo.** Deixar o repositório pronto para receber as Fases 1 a 4: pipeline de build com três entrypoints
(`@gabreusi/hyrax`, `/dom`, `/react`), fronteira "núcleo sem DOM" imposta pelo compilador, testes, lint, formatação,
verificação do pacote publicado e CI. Ao final existe um esqueleto que passa em `npm run check`, com uma única função
real (`noop`, que a Fase 1 herda sem mudanças) usada como canário do pipeline.

**Arquitetura.** Um pacote ESM+CJS gerado por tsdown. Um `tsconfig` por entrypoint (o do `core` sem a lib `DOM`),
Vitest com um projeto por ambiente (`core` em Node, `dom` e `react` em happy-dom), ESLint 10 com TSDoc obrigatório e
regras de hooks só no `/react`. O CI valida o *tarball* instalado, e não a árvore de fontes.

**Não faz parte desta fase:** código de biblioteca além de `noop`, `size-limit` (Fase 1, precisa de código real),
changesets e publicação (Fase 6), site de docs (Fase 5).

## Todo o plano foi validado antes de ser escrito

Montei o esqueleto completo num projeto descartável e rodei a pipeline inteira (lint, format, typecheck, guarda de
fronteira, testes com cobertura, build, publint, attw, smoke em Node ESM/CJS e Deno). Os arquivos deste plano são os
que passaram. Isso também revelou os desvios abaixo.

### Desvios do spec (todos forçados pelo ferramental, nenhum muda o desenho)

| # | Spec dizia | O plano faz | Por quê |
|---|---|---|---|
| 1 | TypeScript "strict" (sem versão) | `typescript@~6.0.3`, **não** a 7.0 | `typescript-eslint` declara `typescript >=4.8.4 <6.1.0` |
| 2 | Testes em Node 20, 22 e 24 | Testes em **22, 24 e 26**. Smoke do pacote construído em **20, 22, 24 e 26**. `engines.node` continua `>=20` | Vitest 5 exige Node `^22.12 \|\| ^24 \|\| >=26`, e tsdown `^22.18 \|\| ^24.11`. Node 20 está em EOL desde abril/2026. O smoke test só faz `import`, então roda em 20 e mantém a intenção do spec |
| 3 | `attw` sem ressalva | `attw --profile node16` (ignora `node10`) | Os subpaths `/dom` e `/react` **não resolvem** com `moduleResolution: node` (legado). Consumidores precisam de `node16`, `nodenext` ou `bundler`. Isso vira uma nota nas *Design notes* (Fase 5) |
| 4 | Pacote publicável | `"private": true` até a Fase 6 | Impede publicação acidental antes do 1.0-rc |
| 5 | Jobs Bun e Deno "best-effort" | Deno validado localmente. **Bun não foi validado** (não está instalado aqui); o job roda com `continue-on-error` | — |

## Pré-requisito que depende de você

O `LICENSE` e o campo `author` precisam do nome do titular do copyright. **Quem for executar o plano deve perguntar ao
usuário e não deve inventar.** Nos comandos abaixo, esse valor aparece como `$AUTHOR`.

## Mapa de arquivos ao final da fase

```
.github/workflows/ci.yml
scripts/check-core-boundary.mjs        garante que o core não compila com DOM
scripts/smoke.mjs                      instala o tarball e importa os 3 entrypoints (ESM + CJS)
src/index.ts                           raiz universal
src/index.test.ts
src/core/noop.ts
src/core/noop.test.ts
src/dom/index.ts        src/dom/index.test.ts
src/react/index.ts      src/react/index.test.ts
test-fixtures/core-boundary/uses-dom.ts   fixture que DEVE falhar ao compilar
tsconfig.json  tsconfig.base.json  tsconfig.core.json  tsconfig.dom.json
tsconfig.react.json  tsconfig.test.json  tsconfig.boundary.json
tsdown.config.ts  vitest.config.ts  eslint.config.js
.prettierrc.json  .prettierignore  .gitignore  .nvmrc
package.json  package-lock.json  LICENSE  README.md  CONTRIBUTING.md
```

Removidos: `dist/`, `src/` antigo, `jest.config.js`, `eslint.config.mjs`, `tsconfig.json` antigo, `.npmrc`, README antigo.

---

## Task 1: Branch, tag do legado e pré-requisitos

- [ ] **Step 1: Obter `$AUTHOR`.** Pergunte ao usuário o nome do titular do copyright (nome completo ou handle) e guarde
      o valor para as Tasks 3 e 10.

- [ ] **Step 2: Criar a branch e etiquetar o código legado**, para que as Fases 1 a 4 possam consultá-lo com
      `git show legacy-0.6.1:src/...`. A tag é **local**: não faça `git push` de tags sem o usuário pedir.

```bash
cd /home/gabriel/Desktop/hyrax
git switch -c phase-0-foundation
git tag legacy-0.6.1 8313a88
git show legacy-0.6.1 --stat --format='%h %s' | head -3
```

Esperado: a primeira linha é `8313a88 0.6.1`.

- [ ] **Step 3: Conferir o Node local.**

```bash
node -v
```

Esperado: `v22.18` ou superior (tsdown exige `^22.18 || ^24.11 || >=26`). Se for menor, peça ao usuário para atualizar
antes de continuar. O repo passará a ter um `.nvmrc` com `24` (Task 10).

---

## Task 2: Remover o legado

**Files:** removidos `dist/`, `src/`, `.npmrc`, `jest.config.js`, `eslint.config.mjs`, `tsconfig.json`, `README.md`,
`package-lock.json`.

- [ ] **Step 1: Remover do git e do disco.**

```bash
git rm -r -q dist src .npmrc jest.config.js eslint.config.mjs tsconfig.json README.md package-lock.json
rm -rf node_modules dist
git status --short | head -5
```

Esperado: linhas `D  ...` para os arquivos removidos e `?? .idea/`. Restam `package.json`, `.gitignore` e `docs/`.

- [ ] **Step 2: Commit.**

```bash
git commit -q -m "chore: remove legacy 0.x sources, build output and configs" \
  -m "The 0.6.1 code stays reachable through the local tag legacy-0.6.1." \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `package.json` e dependências

**Files:** reescrever `package.json`; gerar `package-lock.json`.

- [ ] **Step 1: Substituir o conteúdo de `package.json`** (sem `devDependencies` e sem `author`, que entram nos
      passos seguintes):

```json
{
  "name": "@gabreusi/hyrax",
  "version": "0.0.0",
  "private": true,
  "description": "Isomorphic TypeScript toolkit: seeded random, number and string helpers, plus DOM and React utilities.",
  "keywords": ["typescript", "utilities", "random", "seeded-random", "isomorphic", "react"],
  "homepage": "https://github.com/gabreusi/hyrax#readme",
  "bugs": { "url": "https://github.com/gabreusi/hyrax/issues" },
  "repository": { "type": "git", "url": "git+https://github.com/gabreusi/hyrax.git" },
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "engines": { "node": ">=20" },
  "files": ["dist"],
  "main": "./dist/index.cjs",
  "types": "./dist/index.d.cts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./dom": {
      "import": { "types": "./dist/dom.d.ts", "default": "./dist/dom.js" },
      "require": { "types": "./dist/dom.d.cts", "default": "./dist/dom.cjs" }
    },
    "./react": {
      "import": { "types": "./dist/react.d.ts", "default": "./dist/react.js" },
      "require": { "types": "./dist/react.d.cts", "default": "./dist/react.cjs" }
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "build": "tsdown",
    "dev": "vitest",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc -p tsconfig.core.json && tsc -p tsconfig.dom.json && tsc -p tsconfig.react.json && tsc -p tsconfig.test.json",
    "check:boundary": "node scripts/check-core-boundary.mjs",
    "check:package": "publint && attw --pack . --profile node16",
    "smoke": "node scripts/smoke.mjs",
    "check": "npm run lint && npm run format:check && npm run typecheck && npm run check:boundary && npm run test:coverage && npm run build && npm run check:package && npm run smoke"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true },
    "react-dom": { "optional": true }
  }
}
```

- [ ] **Step 2: Definir o autor e instalar as dependências de desenvolvimento.**

```bash
npm pkg set author="$AUTHOR"
npm install -D typescript@~6.0.3 tsdown vitest @vitest/coverage-v8 happy-dom \
  @testing-library/react @testing-library/dom react react-dom \
  @types/react @types/react-dom @types/node fast-check \
  eslint @eslint/js typescript-eslint eslint-plugin-jsdoc eslint-plugin-react-hooks \
  eslint-config-prettier globals prettier publint @arethetypeswrong/cli
```

Esperado: termina com `found 0 vulnerabilities`. `node -p "require('./package.json').devDependencies.typescript"`
imprime `~6.0.3`. Versões resolvidas no spike, para referência: vitest 5.0.1, tsdown 0.23.0, eslint 10.11.0,
typescript-eslint 8.70.0, prettier 3.9.8, react 19.3.0. O `package-lock.json` gerado é versionado.

- [ ] **Step 3: Commit.**

```bash
git add package.json package-lock.json
git commit -q -m "build: set up package.json, exports map and dev dependencies" \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Vitest e a primeira função (TDD com `noop`)

**Files:** criar `vitest.config.ts`, `src/core/noop.test.ts`, `src/core/noop.ts`, `src/index.test.ts`, `src/index.ts`.

- [ ] **Step 1: Criar `vitest.config.ts`** com um projeto por ambiente e cobertura mínima de 95% no `core`.

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "core",
          environment: "node",
          include: ["src/core/**/*.test.ts", "src/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "happy-dom",
          include: ["src/dom/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "react",
          environment: "happy-dom",
          include: ["src/react/**/*.test.{ts,tsx}"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "**/*.d.ts"],
      thresholds: {
        "src/core/**": { statements: 95, branches: 95, functions: 95, lines: 95 },
      },
    },
  },
});
```

- [ ] **Step 2: Escrever o teste ANTES da implementação.** `src/core/noop.test.ts`:

```ts
import { describe, expect, expectTypeOf, it } from "vitest";
import { noop } from "./noop";

describe("noop", () => {
  it("returns undefined for any arguments", () => {
    expect(noop()).toBeUndefined();
    expect(noop(1, "a", {})).toBeUndefined();
  });

  it("is typed as (...values: unknown[]) => void", () => {
    expectTypeOf(noop).toEqualTypeOf<(...values: unknown[]) => void>();
  });
});
```

E `src/index.test.ts`, que garante em runtime que a raiz carrega sem globais de DOM e que não há export default:

```ts
import { describe, expect, it } from "vitest";
import * as root from "./index";

describe("@gabreusi/hyrax (root entrypoint)", () => {
  it("loads in a plain Node environment, without DOM globals", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });

  it("has named exports only (no default export or aggregate object)", () => {
    expect("default" in root).toBe(false);
    expect(root.noop).toBeTypeOf("function");
  });
});
```

- [ ] **Step 3: Rodar e ver falhar (RED).**

```bash
npx vitest run
```

Esperado: falha com `Failed to resolve import "./noop"` (e `"./index"`). Se passar, algo está errado.

- [ ] **Step 4: Implementar.** `src/core/noop.ts`:

```ts
/**
 * A function that does nothing. Accepts any arguments and returns `undefined`.
 * Useful as a default callback or placeholder.
 *
 * @example
 * ```ts
 * noop(1, 2, 3); // => undefined
 * ```
 *
 * @param _values - Ignored.
 */
export function noop(..._values: unknown[]): void {}
```

`src/index.ts`:

```ts
export { noop } from "./core/noop";
```

- [ ] **Step 5: Rodar e ver passar (GREEN).**

```bash
npx vitest run --project core
```

Esperado: `Test Files  2 passed (2)`, `Tests  4 passed (4)`.

- [ ] **Step 6: Commit.**

```bash
git add vitest.config.ts src
git commit -q -m "test: add Vitest projects and the noop canary" \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Esqueleto dos entrypoints `/dom` e `/react`

**Files:** criar `src/dom/index.ts`, `src/dom/index.test.ts`, `src/react/index.ts`, `src/react/index.test.ts`.

- [ ] **Step 1: Escrever os testes primeiro.** `src/dom/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import * as dom from "./index";

describe("@gabreusi/hyrax/dom", () => {
  it("runs in a DOM environment", () => {
    expect(typeof document).toBe("object");
  });

  it("has named exports only", () => {
    expect("default" in dom).toBe(false);
  });
});
```

`src/react/index.test.ts` é idêntico, trocando `dom` por `react` e o nome do `describe` para `"@gabreusi/hyrax/react"`.

- [ ] **Step 2: Rodar e ver falhar.**

```bash
npx vitest run --project dom --project react
```

Esperado: falha por `Failed to resolve import "./index"` nos dois projetos.

- [ ] **Step 3: Criar os módulos vazios.** `src/dom/index.ts` e `src/react/index.ts`, com o mesmo conteúdo:

```ts
export {};
```

- [ ] **Step 4: Rodar e ver passar.**

```bash
npx vitest run
```

Esperado: `Test Files  4 passed (4)` e `Tests  8 passed (8)`, com os três projetos (`core`, `dom`, `react`) rodando.

- [ ] **Step 5: Commit.**

```bash
git add src/dom src/react
git commit -q -m "feat: add empty /dom and /react entrypoints" \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: TypeScript por entrypoint e a guarda "núcleo sem DOM"

**Files:** criar os sete `tsconfig*.json`, `test-fixtures/core-boundary/uses-dom.ts`, `scripts/check-core-boundary.mjs`.

- [ ] **Step 1: Criar os `tsconfig`.** Todos herdam de `tsconfig.base.json`, que define `"types": []` (nenhum `@types/*`
      entra por acidente; com isso o `core` também não vê `@types/node`).

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "forceConsistentCasingInFileNames": true,
    "types": []
  }
}
```

`tsconfig.core.json` (**sem DOM**):

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "lib": ["ES2022"] },
  "include": ["src/core/**/*.ts", "src/index.ts"],
  "exclude": ["**/*.test.ts"]
}
```

`tsconfig.dom.json`:

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "lib": ["ES2022", "DOM", "DOM.Iterable"] },
  "include": ["src/dom/**/*.ts"],
  "exclude": ["**/*.test.ts"]
}
```

`tsconfig.react.json`:

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "lib": ["ES2022", "DOM", "DOM.Iterable"], "jsx": "react-jsx" },
  "include": ["src/react/**/*.ts", "src/react/**/*.tsx"],
  "exclude": ["**/*.test.ts", "**/*.test.tsx"]
}
```

`tsconfig.test.json` (testes e configs, com `@types/node`; é ele que faz o `expectTypeOf` valer, porque o Vitest não
verifica tipos em runtime):

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["node"]
  },
  "include": ["src/**/*.test.ts", "src/**/*.test.tsx", "*.config.ts"]
}
```

`tsconfig.json` (raiz: editor e ESLint com type-check; o `projectService` exige um `tsconfig.json` aqui):

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["node"]
  },
  "include": ["src", "*.config.ts"]
}
```

`tsconfig.boundary.json`:

```json
{
  "extends": "./tsconfig.core.json",
  "include": ["test-fixtures/core-boundary/**/*.ts"],
  "exclude": []
}
```

- [ ] **Step 2: Criar a fixture que DEVE falhar.** `test-fixtures/core-boundary/uses-dom.ts`:

```ts
// Must FAIL to compile under tsconfig.core.json: the core has no DOM lib.
export const width = window.innerWidth;
export const el = document.body;
```

- [ ] **Step 3: Criar o script da guarda.** `scripts/check-core-boundary.mjs`:

```js
// The core entrypoint must compile without the DOM lib. The fixture uses
// `window`/`document`; compiling it against tsconfig.core.json MUST fail.
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["tsc", "-p", "tsconfig.boundary.json"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});
const output = `${result.stdout}${result.stderr}`;

if (result.status === 0) {
  console.error("Boundary check FAILED: DOM globals compiled inside core.");
  process.exit(1);
}
if (!output.includes("TS2304") && !output.includes("TS2584")) {
  console.error("Boundary check FAILED: tsc failed for an unexpected reason:\n" + output);
  process.exit(1);
}
console.log("Boundary check passed: core rejects DOM globals.");
```

- [ ] **Step 4: Verificar os quatro projetos e a guarda.**

```bash
npm run typecheck
npm run check:boundary
```

Esperado: `typecheck` sem saída e código 0; `check:boundary` imprime `Boundary check passed: core rejects DOM globals.`
Para ver a guarda "por dentro": `npx tsc -p tsconfig.boundary.json` deve falhar com
`error TS2304: Cannot find name 'window'` e `error TS2584: Cannot find name 'document'`.

- [ ] **Step 5: Provar que o `expectTypeOf` é verificado.** Troque temporariamente, em `src/core/noop.test.ts`, o tipo
      esperado por `(a: number) => string`, rode `npx tsc -p tsconfig.test.json` e confirme o erro `TS2344`. Reverta
      com `git checkout src/core/noop.test.ts`.

- [ ] **Step 6: Commit.**

```bash
git add tsconfig*.json test-fixtures scripts/check-core-boundary.mjs
git commit -q -m "build: per-entrypoint tsconfigs and a core-without-DOM boundary check" \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: tsdown, build e validação do pacote

**Files:** criar `tsdown.config.ts`.

- [ ] **Step 1: Criar `tsdown.config.ts`.**

```ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    dom: "src/dom/index.ts",
    react: "src/react/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  target: "es2022",
  platform: "neutral",
});
```

- [ ] **Step 2: Construir.**

```bash
npm run build && ls dist
```

Esperado: 12 arquivos: `index`, `dom` e `react`, cada um com `.js`, `.cjs`, `.d.ts` e `.d.cts`. Os nomes precisam bater
com o `exports` do `package.json`; é o `publint` que confirma isso no passo seguinte.

- [ ] **Step 3: Validar o pacote.**

```bash
npm run check:package
```

Esperado: `publint` termina em `All good!`, e o `attw` mostra 🟢 em `node16 (from CJS)`, `node16 (from ESM)` e `bundler`
para os três entrypoints e o `package.json`. As linhas `node10: ... 💀 Resolution failed` dos subpaths `/dom` e `/react`
aparecem como *ignoradas*: é o desvio 3 e é esperado.

- [ ] **Step 4: Provar que a validação falha de verdade.** Em `package.json`, troque temporariamente
      `"./dist/dom.d.ts"` por `"./dist/missing.d.ts"`, rode `npm run check:package`, confirme código de saída ≠ 0
      (`echo $?` imprime `1`) e reverta com `git checkout package.json`.

- [ ] **Step 5: Commit.**

```bash
git add tsdown.config.ts
git commit -q -m "build: bundle three entrypoints as ESM and CJS with tsdown" \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Smoke test do tarball

**Files:** criar `scripts/smoke.mjs`.

- [ ] **Step 1: Criar `scripts/smoke.mjs`.** Instala o tarball num diretório limpo (junto com `react` e `react-dom`, que
      o `/react` vai exigir a partir da Fase 4) e importa cada entrypoint por ESM e por CJS.

```js
// Installs the library tarball into a clean directory and imports every
// entrypoint through ESM and CJS, exactly as a consumer would.
//
//   node scripts/smoke.mjs [path/to/tarball.tgz]   (packs the repo when omitted)
//   HYRAX_SMOKE_RUNTIMES=deno,bun node scripts/smoke.mjs   (also checks those runtimes)
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const NAME = "@gabreusi/hyrax";
const entrypoints = [NAME, `${NAME}/dom`, `${NAME}/react`];

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
    ["--input-type=module", "-e", `import { noop } from "${NAME}"; console.log(typeof noop);`],
    dir,
  ).trim();
  const cjs = run("node", ["-e", `console.log(typeof require("${NAME}").noop);`], dir).trim();
  if (esm !== "function" || cjs !== "function") {
    throw new Error(`noop is ${esm} (ESM) / ${cjs} (CJS), expected function / function`);
  }

  const runtimes = (process.env.HYRAX_SMOKE_RUNTIMES ?? "").split(",").filter(Boolean);
  const code = `${entrypoints.map((id, i) => `import * as m${i} from "${id}";`).join("")}
    if (typeof m0.noop !== "function") throw new Error("noop missing");`;
  for (const runtime of runtimes) {
    if (runtime === "deno") run("deno", ["eval", "--node-modules-dir=manual", code], dir);
    else if (runtime === "bun") run("bun", ["-e", code], dir);
    else throw new Error(`Unknown runtime: ${runtime}`);
  }

  console.log(
    `Smoke test passed: ${entrypoints.length} entrypoints x (ESM + CJS)` +
      (runtimes.length ? ` + ${runtimes.join(", ")}` : ""),
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
```

- [ ] **Step 2: Rodar (o `dist/` da Task 7 já existe).**

```bash
npm run smoke
```

Esperado: `Smoke test passed: 3 entrypoints x (ESM + CJS)`.

- [ ] **Step 3: Rodar com um tarball explícito e com Deno** (é assim que o CI usa).

```bash
D=$(mktemp -d) && npm pack --pack-destination "$D" >/dev/null && node scripts/smoke.mjs "$D"/*.tgz
HYRAX_SMOKE_RUNTIMES=deno node scripts/smoke.mjs
```

Esperado: a segunda linha termina em `... (ESM + CJS) + deno`. Se o Deno não estiver instalado, pule. O caminho do Bun
**não foi validado**: é o motivo de o job dele ser `continue-on-error`.

- [ ] **Step 4: Commit.**

```bash
git add scripts/smoke.mjs
git commit -q -m "test: smoke-test the packed tarball through ESM, CJS and Deno" \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: ESLint e Prettier

**Files:** criar `eslint.config.js`, `.prettierrc.json`, `.prettierignore`.

- [ ] **Step 1: Criar `eslint.config.js`.** TSDoc com `@example` é obrigatório em todo símbolo exportado (spec, seção 6);
      `react-hooks` só vale dentro de `src/react`.

```js
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
          require: { FunctionDeclaration: true, ClassDeclaration: true, MethodDefinition: true },
          contexts: ["ExportNamedDeclaration > VariableDeclaration"],
        },
      ],
      "jsdoc/require-example": "error",
    },
  },
  {
    files: ["src/react/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.flat.recommended.rules,
  },
  prettier,
);
```

O objeto `globals.node` fica **separado** do `disableTypeChecked` de propósito: no mesmo objeto, o `languageOptions` do
`disableTypeChecked` sobrescreve o seu e os scripts passam a acusar `'process' is not defined`.

- [ ] **Step 2: Criar `.prettierrc.json` e `.prettierignore`.**

`.prettierrc.json`:

```json
{ "printWidth": 100, "trailingComma": "all" }
```

`.prettierignore` (`docs/superpowers` guarda os documentos de design internos, que não são a documentação pública):

```
dist
coverage
node_modules
package-lock.json
docs/superpowers
```

- [ ] **Step 3: Formatar e ver o lint passar.**

```bash
npx prettier --write .
npm run lint && npm run format:check
```

Esperado: sem erros; `All matched files use Prettier code style!`.

- [ ] **Step 4: Provar que as regras disparam.** Crie arquivos temporários, confira a mensagem e apague-os.

```bash
cat > src/core/tmp-nodoc.ts <<'EOF'
export function nodoc(n: number): number {
  return n;
}
EOF
cat > src/core/tmp-noexample.ts <<'EOF'
/** Documented but without an example. */
export function noexample(n: number): number {
  return n;
}
EOF
cat > src/react/tmp-bad.tsx <<'EOF'
import { useState } from "react";

export function useBad(flag: boolean) {
  if (flag) {
    const [a] = useState(0);
    return a;
  }
  return 0;
}
EOF
npx eslint src/core/tmp-nodoc.ts src/core/tmp-noexample.ts src/react/tmp-bad.tsx 2>&1 | grep -E "jsdoc/|react-hooks/"
rm src/core/tmp-nodoc.ts src/core/tmp-noexample.ts src/react/tmp-bad.tsx
```

Esperado: aparecem `jsdoc/require-jsdoc` (nodoc), `jsdoc/require-example` (noexample) e `react-hooks/rules-of-hooks`
(bad). O ESLint sai com erro nesses arquivos; depois de removê-los `npm run lint` volta a passar.

- [ ] **Step 5: Commit.**

```bash
git add eslint.config.js .prettierrc.json .prettierignore
git commit -q -m "build: ESLint with mandatory TSDoc examples and Prettier" \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

Se o `format --write` alterou arquivos das tasks anteriores, inclua-os neste commit (`git add -u`).

---

## Task 10: Higiene do repositório

**Files:** criar `.gitignore` (reescrever), `.nvmrc`, `LICENSE`, `README.md`, `CONTRIBUTING.md`.

- [ ] **Step 1: `.gitignore`.**

```
node_modules
dist
coverage
.idea
*.tsbuildinfo
.DS_Store
```

- [ ] **Step 2: `.nvmrc`** com o conteúdo `24`.

- [ ] **Step 3: `LICENSE`** (MIT) com o titular obtido na Task 1. Use o ano `2026`:

```
MIT License

Copyright (c) 2026 <AUTHOR>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

(Substitua `<AUTHOR>` pelo valor real; o arquivo final não pode conter o marcador.)

- [ ] **Step 4: `README.md`** (esqueleto em inglês, como decidido para a documentação pública; o texto final vem na Fase 5):

````markdown
# Hyrax

[![CI](https://github.com/gabreusi/hyrax/actions/workflows/ci.yml/badge.svg)](https://github.com/gabreusi/hyrax/actions/workflows/ci.yml)

An isomorphic TypeScript toolkit: seeded random, number and string helpers, and DOM and React utilities.
Zero runtime dependencies. Works in Node, browsers, Deno and Bun.

> **Status:** being rebuilt from scratch toward 1.0. The package is not published yet under its new name
> (`@gabreusi/hyrax`). The old 0.x code (`@gpsign/hyrax`) lives at the git tag `legacy-0.6.1`.

## Entrypoints

| Import                  | Runs in                | Contents                           |
| ----------------------- | ---------------------- | ---------------------------------- |
| `@gabreusi/hyrax`       | Anywhere               | Universal helpers (no DOM, no React) |
| `@gabreusi/hyrax/dom`   | Browsers               | DOM utilities                      |
| `@gabreusi/hyrax/react` | React 18+ (optional peer) | Hooks and components            |

## Requirements

Node 20 or newer. TypeScript consumers need `moduleResolution` set to `node16`, `nodenext` or `bundler`
(the `/dom` and `/react` subpaths use the package `exports` map).

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
````

- [ ] **Step 5: `CONTRIBUTING.md`.**

````markdown
# Contributing

## Setup

Use Node 24 (`nvm use`, see `.nvmrc`; Node 22 or newer works) and install with `npm ci`.

## Commands

| Command                 | What it does                                                        |
| ----------------------- | ------------------------------------------------------------------- |
| `npm test`              | Runs the tests (`core` in Node, `dom` and `react` in happy-dom)     |
| `npm run test:coverage` | Same, with coverage. `src/core` must stay at 95% or above           |
| `npm run lint`          | ESLint. Every exported symbol needs TSDoc with an `@example`        |
| `npm run typecheck`     | Type-checks each entrypoint and the tests                           |
| `npm run check:boundary`| Fails if `src/core` starts compiling against DOM globals            |
| `npm run build`         | Builds `dist/` (ESM, CJS and type declarations)                     |
| `npm run check:package` | `publint` and Are the Types Wrong on the built package              |
| `npm run smoke`         | Installs the packed tarball and imports every entrypoint            |
| `npm run check`         | Everything above, in CI order                                       |

## Rules of the repo

- `src/core` is universal: no `window`, `document` or Node-only APIs. The compiler enforces it (no DOM lib there).
- Only named exports. No default export and no aggregate object.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `build:`, `ci:`, `test:`, `chore:`).
````

- [ ] **Step 6: Formatar e commitar.**

```bash
npx prettier --write README.md CONTRIBUTING.md
git add .gitignore .nvmrc LICENSE README.md CONTRIBUTING.md
git commit -q -m "docs: add LICENSE, README skeleton, CONTRIBUTING and repo hygiene files" \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: CI (GitHub Actions)

**Files:** criar `.github/workflows/ci.yml`.

- [ ] **Step 1: Criar o workflow.** Versões das Actions consultadas na API do GitHub em 2026-09-18: `checkout` v7,
      `setup-node` v7, `upload-artifact` v7, `download-artifact` v8.

```yaml
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
      - run: mkdir pack && npm pack --pack-destination pack
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
```

O job `smoke` **não roda `npm ci`**: só precisa do script e do tarball, e por isso funciona em Node 20, onde o
ferramental de desenvolvimento não instala.

- [ ] **Step 2: Validar o YAML** (não há como rodar o Actions localmente; a primeira execução real é o push). O
      Prettier já rejeita YAML inválido (`npx prettier --check .github`). Para conferir a estrutura, use o parser do
      Deno (o `pyyaml` não vem instalado por padrão):

```bash
deno eval --no-lock 'import { parse } from "jsr:@std/yaml"; const d = parse(await Deno.readTextFile(".github/workflows/ci.yml")); console.log(Object.keys(d.jobs).sort());'
```

Esperado: `[ "build", "quality", "runtimes", "smoke", "test", "test-react-18" ]`. Se `actionlint` estiver instalado,
rode `actionlint`.

- [ ] **Step 3: Conferir que os comandos do CI funcionam localmente**, já que o workflow só os encadeia.

```bash
npx vitest run --project react
```

Esperado: `Test Files  1 passed (1)`.

- [ ] **Step 4: Formatar o workflow** (o `format:check` do CI também cobre o YAML) e conferir.

```bash
npx prettier --write .github && npm run format:check
```

Esperado: `All matched files use Prettier code style!`.

- [ ] **Step 5: Commit.**

```bash
git add .github
git commit -q -m "ci: lint, test matrix, package validation and tarball smoke tests" \
  -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Verificação final da fase

- [ ] **Step 1: Instalação limpa, exatamente como o CI faz.**

```bash
rm -rf node_modules dist coverage
npm ci
npm run check
```

Esperado: `npm run check` termina com código 0, passando por lint, `format:check`, `typecheck`, guarda de fronteira,
testes com cobertura, build, `publint`/`attw` e `Smoke test passed: 3 entrypoints x (ESM + CJS)`.

- [ ] **Step 2: Conferir o conteúdo do tarball.**

```bash
npm pack --dry-run 2>&1 | grep -E "npm notice [0-9.]+ ?[kB]+ "
```

Esperado: só `dist/*` (12 arquivos), `package.json`, `LICENSE` e `README.md`. Nada de `src/`, `scripts/` ou testes.

- [ ] **Step 3: Conferir a árvore.**

```bash
git status --short
git log --oneline main..HEAD
```

Esperado: nenhum arquivo pendente (o `.idea/` agora é ignorado) e 10 commits na branch (Tasks 2 a 11, um por task).

- [ ] **Step 4: Checklist de aceitação da Fase 0** (cada item precisa estar verdadeiro):

  - [ ] `npm run check` passa a partir de um clone limpo com `npm ci`
  - [ ] `core` rejeita `window` e `document` em tempo de compilação (guarda de fronteira verde)
  - [ ] Os três entrypoints resolvem em Node ESM e CJS pelo tarball instalado
  - [ ] `publint` e `attw` sem avisos (fora o `node10` ignorado do desvio 3)
  - [ ] `package.json` sem `dependencies`; `react` e `react-dom` como peers **opcionais**
  - [ ] Nenhum `dist/`, `.npmrc` ou configuração do Jest no repositório
  - [ ] `LICENSE` sem marcador de placeholder e com o titular real
  - [ ] O workflow de CI está no repositório (a primeira execução acontece no primeiro push)

- [ ] **Step 5: Parar aqui e pedir autorização ao usuário** antes de qualquer ação que saia da máquina: `git push` da
      branch, abertura de PR e push da tag `legacy-0.6.1`. O `gh` local está autenticado como `gpsign`, e o remote é
      `gabreusi/hyrax`, então o push pode exigir trocar de conta. Depois do primeiro push, confira a execução do
      workflow (`gh run list`) e corrija o que só o Actions revelar (em especial o job do Bun, que não foi validado).

---

## Notas para as próximas fases (descobertas desta)

1. **`core` e os globais de timer/crypto (Fase 2).** Como o `core` compila só com `lib: ["ES2022"]` e sem
   `@types/node`, `setInterval`, `clearInterval` e `crypto` **não têm tipos ali**. `Suspend` e a semente de `Random`
   precisam de uma declaração ambiente mínima em `src/core/` (`declare function setInterval(...)`, etc.), sem puxar a
   lib DOM. Validar que ela convive com a lib DOM quando o `core` é importado por `/dom`.
2. **Ajuste fino do `jsdoc/require-jsdoc` (Fase 1 e 2).** A regra de `MethodDefinition` deve ser conferida contra métodos
   `private` das classes; se exigir TSDoc neles, restrinja a métodos públicos.
3. **`size-limit` entra na Fase 1**, quando existir código para medir. Changesets e o trusted publisher ficam para a
   Fase 6.
4. **Bun** só será validado na primeira execução do CI.
5. **Quem consome o pacote** precisa de `moduleResolution` `node16`, `nodenext` ou `bundler` (desvio 3). O README já
   diz isso; a página *Design notes* da Fase 5 deve repetir.
6. **Node local do usuário.** O `eslint-plugin-jsdoc` mais novo declara Node `>=24.15`. A versão resolvida no spike
   (63.x) funciona no Node 24.11 do usuário. Se o `npm install` avisar `EBADENGINE`, atualizar o Node resolve.
