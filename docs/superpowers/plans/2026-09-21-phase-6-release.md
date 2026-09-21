# Hyrax Fase 6 (release): plano de implementação

Spec: `docs/superpowers/specs/2026-09-18-hyrax-revival-design.md` (seção 6, "Release", e a seção 9, "Pendências", detalhadas em 2026-09-21). Fases anteriores: `docs/superpowers/plans/2026-09-18-phase-0-foundation.md`, `2026-09-19-phase-1-core-pure-functions.md`, `2026-09-19-phase-2-core-classes.md`, `2026-09-19-phase-3-dom.md`, `2026-09-20-phase-4-react.md` e `2026-09-21-phase-5-docs.md`.

**Objetivo.** Deixar o pacote pronto para ser publicado, e publicá-lo sem token npm de longa duração: o Changesets decide as versões (PR "Version Packages" e `CHANGELOG` automáticos), o npm recebe o pacote por **trusted publishing** (OIDC) com provenance, o que sobe para o npm é conferido antes e o que o npm serve é testado depois, e o pacote é experimentado do jeito que os usuários o usam (esbuild, Vite e webpack). O caminho é `1.0.0-rc.0`, depois `1.0.0`, e no fim `npm deprecate @gpsign/hyrax`.

**Esta fase tem três partes, e só a primeira é "executar o plano":**

| Parte | Quem | O quê |
|---|---|---|
| **6a** (Tasks 1 a 8, abaixo) | eu, com o seu aval para o push e o PR | Tudo o que é código e CI: as conferências, o Changesets, o `release.yml` (desligado), o smoke com bundlers, e o commit que põe o pacote em `1.0.0-rc.0` |
| **6b** (o roteiro "Depois do merge") | **você**, nos passos que pedem a sua conta do npm e as configurações do repositório; eu, nos passos de verificação e no PR de documentação | Publicar a `1.0.0-rc.0` à mão, configurar o trusted publisher, ligar o workflow, e conferir o que o npm serve |
| **6c** (o roteiro "Da rc ao 1.0.0") | você e eu | Validar em uso real, provar o caminho OIDC com uma `rc.1`, sair do modo rc, publicar a `1.0.0` e deprecar o pacote antigo |

**O que eu não faço, em nenhuma parte:** entrar no npm, publicar, deprecar um pacote, criar tags no remoto, nem mudar configurações ou variáveis do repositório. Tudo isso está nos roteiros, com o comando exato, para você rodar.

**Arquitetura.**
- `scripts/release/checks.mjs` (funções puras: o que pode entrar no tarball, o que tem de estar nele, e por que um `package.json` ainda não pode ser publicado) e `scripts/check-pack.mjs` (roda o `npm pack --dry-run` e aplica as funções), testados por `checks.test.mjs`.
- `scripts/smoke.mjs` passa a aceitar uma especificação do registro (`@gabreusi/hyrax@versão`), e `scripts/smoke-bundlers.mjs` empacota o tarball com três bundlers.
- `.changeset/` (configuração, README e o primeiro changeset), em modo pré-release `rc`.
- `.github/workflows/release.yml` (desligado até `RELEASE_ENABLED=true`), e um job `bundlers` no `ci.yml`.

**Fora desta fase:** publicar os tipos separadamente, um `SECURITY.md`, modelos de issue, e as configurações do repositório (descrição, tópicos): são decisões suas, e nada aqui depende delas.

## Ponto de partida

Parte do `main` com as Fases 0 a 5 mergeadas (PR #29, commit `88608a5`; o site já está no ar em https://gabreusi.github.io/hyrax/). Linha de base: `npm run check` com 53 arquivos e 568 testes.

## Todo o plano 6a foi validado antes de ser escrito

Implementei tudo num clone descartável e depois **repeti as tasks 1 a 8 deste plano, na ordem, num clone limpo, extraindo os arquivos direto deste documento**: o `npm run check` termina com código 0, com **54 arquivos e 586 testes** (Chromium incluído), o tarball conferido (**19 arquivos, 82,5 kB**), os bundlers passando em **7 casos** (esbuild, Vite e webpack), e o `npm publish --dry-run --tag rc` passando em `1.0.0-rc.0` e recusando `0.0.0` e `private`. Reintroduzi 4 defeitos e provei que cada um é pego. **O que não dá para provar daqui, e só o primeiro uso prova:** a publicação em si (não há login no npm), o caminho OIDC do `release.yml`, e o `changeset publish` dentro dele.

### O que a pesquisa e a implementação encontraram (já refletido nos arquivos abaixo)

| Achado | Consequência |
|---|---|
| **O trusted publishing só se configura para um pacote que já existe** (o `npm trust` diz: "The package you're configuring must already exist on the npm registry"; o registro responde 404 para `@gabreusi/hyrax`) | A **primeira versão é publicada à mão, uma vez**, por você, com 2FA, e **não tem provenance**. Só depois se roda `npm trust github`. O `release.yml` nasce desligado (`RELEASE_ENABLED`), como o `docs.yml`. Sugestão: a primeira publicação pelo workflow é uma `rc.1`, para provar o caminho OIDC antes do `1.0.0` |
| **O nome `hyrax` sem escopo não vai ser transferido.** É de outro autor (`petermetz`, GPL-3.0, um broker de mensagens, criado em 2017, com o último registro em 2022), e a política do npm diz que "não transfere ... simplesmente porque outro usuário quer o nome" e que squatting é "o pacote não tem função genuína" | O 1.0 sai como `@gabreusi/hyrax`, sem depender disso. O spec deixa de tratar a disputa como pendência bloqueante |
| **O `@gpsign/hyrax` tem 16 versões publicadas, de `0.0.1` a `0.6.0`.** A `0.6.1` (a tag `legacy-0.6.1` do git) nunca foi publicada | O `npm deprecate` vale para o pacote inteiro e a mensagem não cita `0.6.1` |
| **O Changesets numera a primeira prerelease como `1.0.0-rc.0`**, e não `rc.1`, e **a dist-tag é o nome do modo (`rc`)**, e não `next` (testado: `pre enter rc`, changeset `major`, `version` dá `1.0.0-rc.0`; um `patch` dá `1.0.0-rc.1`; `pre exit` dá `1.0.0`; as tags são `v1.0.0-rc.0` e `v1.0.0`) | Desvio do spec (`1.0.0-rc.1` na tag `next`), aceito para não brigar com a ferramenta: `npm install @gabreusi/hyrax@rc` |
| **O `changeset init` da versão 3 é interativo** (pergunta se usa a integração com o GitHub) e trava sem terminal | A configuração é escrita à mão (Task 5), com o `$schema` na versão do `@changesets/config` instalado |
| **O `changeset publish` chama o `npm publish` direto, sem `npm whoami`** (lido no código do CLI 3.0.3) | Compatível com o OIDC em princípio; **não verificado até o primeiro release pelo workflow** |
| **Adicionar as dependências do Changesets quebrou o `npm ci` do npm 10 de novo** (`Missing: @types/react@18.3.31 from lock file`), o mesmo defeito da Fase 5 | O lockfile é regenerado com o npm 10 e conferido com `npm ci --dry-run` nas versões 10, 11 e 12 (Task 5), num diretório sem `node_modules`: dentro do repositório o npm 11 e o 12 só dizem "up to date" e não provam nada |
| **O `npm publish --dry-run` roda o `prepublishOnly`, e o `attw --pack` que estava nele falhou** (`npm_config_dry_run` vaza para o `npm pack` filho, que então não gera o tarball) | O `prepublishOnly` é só build, `publint` e `check-pack --publish`. O `attw` continua no `check:package` (CI, em todo PR) |
| **A minha primeira mutação de tree-shaking não foi pega, por três motivos**: `new Random("x")` sem uso é descartado pelo bundler (a classe é analisável); o `Random` nem existia no `src/index.ts` (só se reexporta, e reexportar não cria um nome local: o build "passava" com uma variável global inexistente); e o `sideEffects: false` faz o bundler tratar o arquivo como puro | A mutação que vale é uma **chamada de método no nível do módulo, sobre a classe importada de verdade** (`new R("x").int(1, 6)`): as três ferramentas a veem (Task 8). E os casos "tudo de um entrypoint" existem para provar que as marcas procuradas (`"Random.restore()"`, `"PORTAL"`...) existem: sem eles, "não achei" pode ser uma marca que nunca existiu |
| **O registro demora a servir uma versão recém-publicada** | `smoke.mjs` tenta a instalação 6 vezes, com 10 s entre elas, só quando o argumento é uma especificação do registro (testado com uma versão que não existe) |
| **Os exemplos oficiais do npm** usam `registry-url`, `id-token: write`, `package-manager-cache: false` ("never use caching in release builds") e rodam `npm test` antes de publicar; e exigem que o `repository.url` do `package.json` seja igual ao repositório | O `release.yml` faz o mesmo. O `repository.url` já é `git+https://github.com/gabreusi/hyrax.git` |
| **O PR "Version Packages" é aberto com o `GITHUB_TOKEN`**, então o GitHub **não dispara os outros workflows nele** (regra do GitHub) e exige a opção "Allow GitHub Actions to create and approve pull requests" | O PR só mexe em `package.json`, `CHANGELOG.md` e `.changeset/`, e o job de release roda `npm test` antes de publicar. A opção é uma configuração sua (roteiro 6b) |
| **O tarball tem 19 arquivos e 82,5 kB** (`dist/` em ESM e CJS com os tipos, mais README, LICENSE e `package.json`), sem mapas de código-fonte | `check-pack` trava nesse conjunto e em 100 kB: um arquivo a mais (ou mapas, se um dia forem desejados) passa a ser uma decisão |
| **O `@changesets/cli` 3 exige Node `^22.11 \|\| ^24 \|\| >=26`** | Sem efeito: é devDependency, e o desenvolvimento já exige o Node 22.12 por causa do Vitest |

### Decisões de implementação (o desenho está no spec; estas são as do código)

1. **`1.0.0-rc.0` na dist-tag `rc`** (o Changesets não separa o nome do modo da dist-tag).
2. **`private` sai do `package.json` na Task 2, junto com a guarda** (`prepublishOnly`): um `npm publish` acidental com a versão `0.0.0` é recusado.
3. **`publishConfig.access: "public"`** (um pacote com escopo é privado por padrão). **Não** há `provenance: true` no `package.json`: ele quebraria a publicação local; o provenance vem sozinho no CI.
4. **O `release.yml` já entra no `main`, desligado.** Se `RELEASE_ENABLED` for ligado depois da `rc.0` já estar publicada e versionada, ele não tem o que publicar (é idempotente).
5. **`@changesets/changelog-github`** para o `CHANGELOG` (a integração precisa de `GITHUB_TOKEN` em `changeset version`: no CI, o da action; local, `gh auth token`). O primeiro changeset é a nota de lançamento do 1.0, em inglês.
6. **Os majors dos bundlers ficam fixados** (`esbuild@0.28`, `vite@8`, `webpack@5`): um major novo é notícia, e não deve quebrar o build sem aviso.
7. **O PR de documentação (tirar o "Not published yet", pôr o selo do npm) só vem depois da primeira publicação** (roteiro 6b): o site diz a verdade em cada momento.
8. **O commit "chore: version 1.0.0-rc.0" entra no PR da 6a**, porque a publicação manual sai de um checkout limpo da `main` no commit da versão.

### Como executar (6a)

Executadas na ordem. Os blocos de arquivo usam cercas de quatro crases porque o Markdown e o YAML contêm blocos de três. **A primeira linha de cada bloco é o caminho do arquivo (`// caminho`) e não faz parte dele**; o resto é o conteúdo exato. Para sobrescrever um arquivo existente, leia-o antes. **Nunca use `git checkout -- .` para "limpar" a árvore durante o plano** (reverte edições ainda não commitadas) **nem `pkill -f`** (casa com a própria linha de comando do shell: pare o servidor pelo PID). Use `timeout` em todo `vitest run`. Depois de escrever os arquivos de uma task, rode `npx prettier --write <arquivos>` antes de commitar: os arquivos abaixo já estão formatados, e isto é só uma rede de segurança. **O lockfile é escrito pelo npm 10** (regra do CONTRIBUTING): depois de qualquer `npm install`, `npx -y npm@10 install --package-lock-only --ignore-scripts --no-audit --no-fund`.

---

## Task 1: Branch e linha de base

**Files:** nenhum.

- [ ] **Step 1: Entrar na branch e conferir a linha de base.**

```bash
cd /home/gabriel/Desktop/hyrax
git switch phase-6-release   # já contém este plano; em um clone novo: git switch main && git pull --ff-only origin main && git switch -c phase-6-release
npm ci
npx playwright install chromium
npm run check
```

Esperado: código 0 (linha de base da Fase 5: 53 arquivos, 568 testes).

---

## Task 2: O que entra no tarball, e a guarda de publicação

**Files:** criar `scripts/release/checks.test.mjs`, `scripts/release/checks.mjs` e `scripts/check-pack.mjs`; modificar `package.json`.

- [ ] **Step 1: Escrever os testes primeiro.** `unexpectedFiles` aceita o pacote construído, o README, a LICENSE e o `package.json` (e os nomes de chunk com hash), e recusa o código-fonte, o site, os planos, os scripts, o CI, mapas de código-fonte, subpastas de `dist/`, um `.env`, um `CHANGELOG.md.bak` e um arquivo de configuração; `missingFiles` nomeia o que falta (um entrypoint, um formato, a LICENSE); `publishProblems` recusa `private`, a versão `0.0.0` e um pacote com escopo sem `access: public`, e lista tudo de uma vez.

````js
// scripts/release/checks.test.mjs
import { describe, expect, it } from "vitest";
import { REQUIRED, missingFiles, publishProblems, unexpectedFiles } from "./checks.mjs";

describe("unexpectedFiles", () => {
  it("accepts the built package, the readme, the license and the package.json", () => {
    expect(unexpectedFiles(REQUIRED)).toEqual([]);
    expect(unexpectedFiles(["dist/onClickOutside-1MUT2CB8.js", "dist/x-Ab_1.d.cts"])).toEqual([]);
  });

  it.each([
    "src/core/number.ts",
    "site/index.md",
    "docs/superpowers/plans/x.md",
    "scripts/smoke.mjs",
    ".github/workflows/ci.yml",
    "dist/index.js.map",
    "dist/nested/index.js",
    ".env",
    "CHANGELOG.md.bak",
    "vitest.config.ts",
  ])("flags %s", (path) => {
    expect(unexpectedFiles([path])).toEqual([path]);
  });
});

describe("missingFiles", () => {
  it("is empty when everything is there", () => {
    expect(missingFiles([...REQUIRED, "dist/chunk-1.js"])).toEqual([]);
  });

  it("names what is not, for each entrypoint and format", () => {
    const without = REQUIRED.filter((p) => p !== "dist/react.cjs" && p !== "LICENSE");
    expect(missingFiles(without)).toEqual(["dist/react.cjs", "LICENSE"]);
  });
});

describe("publishProblems", () => {
  const ready = {
    name: "@gabreusi/hyrax",
    version: "1.0.0-rc.0",
    publishConfig: { access: "public" },
  };

  it("accepts a versioned, public package", () => {
    expect(publishProblems(ready)).toEqual([]);
  });

  it("refuses a private package", () => {
    expect(publishProblems({ ...ready, private: true })).toHaveLength(1);
  });

  it("refuses the 0.0.0 placeholder", () => {
    expect(publishProblems({ ...ready, version: "0.0.0" })[0]).toMatch(/changeset version/);
  });

  it("refuses a scoped package that is not marked public", () => {
    expect(publishProblems({ ...ready, publishConfig: undefined })[0]).toMatch(/access/);
    expect(publishProblems({ name: "plain", version: "1.0.0" })).toEqual([]);
  });

  it("reports every problem at once", () => {
    expect(publishProblems({ name: "@a/b", version: "0.0.0", private: true })).toHaveLength(3);
  });
});
````

- [ ] **Step 2: Rodar e ver falhar (RED).**

```bash
timeout 90 npx vitest run --project scripts scripts/release
```

Esperado: 1 arquivo falha com `Cannot find module './checks.mjs'` (e `no tests`).

- [ ] **Step 3: Implementar as funções puras.**

````js
// scripts/release/checks.mjs
// What may go to npm, as pure functions (unit-tested in checks.test.mjs). A mistake here ships the
// wrong files, or a placeholder version, to everyone.

/** Every file of the published tarball must match one of these. */
const ALLOWED = [
  /^dist\/[\w.-]+\.(?:js|cjs|d\.ts|d\.cts)$/,
  /^(?:README\.md|LICENSE|package\.json)$/,
];

/** The files that have to be there: the three entrypoints, both formats, with their types. */
export const REQUIRED = [
  ...["index", "dom", "react"].flatMap((entry) => [
    `dist/${entry}.js`,
    `dist/${entry}.cjs`,
    `dist/${entry}.d.ts`,
    `dist/${entry}.d.cts`,
  ]),
  "README.md",
  "LICENSE",
  "package.json",
];

/** Anything in the tarball that should not be: source, tests, docs, source maps, secrets. */
export function unexpectedFiles(paths) {
  return paths.filter((path) => !ALLOWED.some((pattern) => pattern.test(path)));
}

/** What the tarball is missing. */
export function missingFiles(paths) {
  return REQUIRED.filter((path) => !paths.includes(path));
}

/** Why this `package.json` must not be published yet (an empty list means it can). */
export function publishProblems(pkg) {
  const problems = [];
  if (pkg.private) problems.push('"private" is true, so npm would refuse it');
  if (pkg.version === "0.0.0") {
    problems.push('the version is still the placeholder 0.0.0: run "changeset version" first');
  }
  if (pkg.name?.startsWith("@") && pkg.publishConfig?.access !== "public") {
    problems.push('a scoped package needs "publishConfig": { "access": "public" }');
  }
  return problems;
}
````

- [ ] **Step 4: O verificador do tarball.** Roda o `npm pack --dry-run --json` (lida com o npm 11, que devolve uma lista, e o 12, que devolve um objeto), aplica as funções, confere o tamanho (100 kB; hoje são 82,5 kB) e, com `--publish`, também recusa um pacote `private` ou em `0.0.0`.

````js
// scripts/check-pack.mjs
// Checks what `npm publish` would upload, before it does: the tarball holds the built package, the
// README, the LICENSE and the package.json and nothing else (no source, no tests, no source maps),
// nothing that must be there is missing, and it has not grown by accident.
//
//   npm run build && node scripts/check-pack.mjs
//   node scripts/check-pack.mjs --publish     (what `prepublishOnly` runs; also refuses a package
//                                              that is private or still at the 0.0.0 placeholder)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { missingFiles, publishProblems, unexpectedFiles } from "./release/checks.mjs";

const BUDGET_KB = 100; // measured: about 82 kB. A jump means something was added on purpose or by mistake.

const publishing = process.argv.includes("--publish");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const problems = publishing ? publishProblems(pkg) : [];

// `npm pack --json` prints an array up to npm 11 and an object keyed by package name on npm 12.
const packed = JSON.parse(
  execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }),
);
const { files, size } = Array.isArray(packed) ? packed[0] : Object.values(packed)[0];
const paths = files.map((file) => file.path);

for (const path of unexpectedFiles(paths)) problems.push(`unexpected file in the tarball: ${path}`);
for (const path of missingFiles(paths)) problems.push(`missing from the tarball: ${path}`);
if (size > BUDGET_KB * 1000) {
  problems.push(`the tarball is ${(size / 1000).toFixed(1)} kB, over the ${BUDGET_KB} kB budget`);
}

if (problems.length > 0) {
  console.error(`Not ready to publish:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Package contents OK: ${paths.length} files, ${(size / 1000).toFixed(1)} kB.`);
````

- [ ] **Step 5: Rodar (GREEN).**

```bash
npx prettier --write scripts
timeout 90 npx vitest run --project scripts scripts/release
npx eslint scripts
npm run build
node scripts/check-pack.mjs; echo "exit=$?"
node scripts/check-pack.mjs --publish; echo "exit=$?"
```

Esperado: 1 arquivo, 18 testes passando; `Package contents OK: 19 files, 82.3 kB.` com `exit=0` (o tamanho varia um pouco); e, com `--publish`, `exit=1` com **três** linhas: `"private" is true`, `the version is still the placeholder 0.0.0` e `a scoped package needs "publishConfig": { "access": "public" }` (o `package.json` ainda não está pronto: o passo seguinte o prepara).

- [ ] **Step 6: Preparar o `package.json` para ser publicado e ligar as conferências.** `private` sai, o acesso passa a ser público, o `check:package` ganha o `check-pack`, e o `prepublishOnly` constrói e confere antes de qualquer `npm publish` (sem o `attw`: veja os achados).

```bash
npm pkg delete private
npm pkg set publishConfig.access=public
npm pkg set scripts.check:package="publint && attw --pack . --profile node16 && node scripts/check-pack.mjs"
npm pkg set scripts.prepublishOnly="npm run build && publint && node scripts/check-pack.mjs --publish"
node scripts/check-pack.mjs --publish; echo "exit=$?"
```

Esperado: agora só **uma** linha, `the version is still the placeholder 0.0.0: run "changeset version" first`, com `exit=1`.

- [ ] **Step 7: Provar a guarda com o `npm publish` de verdade (mas sem publicar).** O `--dry-run` roda o `prepublishOnly` e não envia nada.

```bash
npm publish --dry-run --tag rc 2>&1 | grep -E "All good|Not ready|placeholder|error code|^\+ "
```

Esperado: `All good!` (o `publint`), depois `Not ready to publish:` e o motivo do `0.0.0`, e `npm error code 1`: **o `npm publish` é recusado**, e nada é enviado. (O `--dry-run` nunca envia, mas é a guarda que interessa: ela fala antes.)

- [ ] **Step 8: Rodar o lint, o formato e o type-check, e commitar.**

```bash
npm run lint && npm run format:check && npm run typecheck
git add scripts/release scripts/check-pack.mjs package.json package-lock.json
git commit -m "feat: check what the tarball holds and refuse to publish a placeholder" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: O smoke test aceita uma versão do registro

**Files:** modificar `scripts/smoke.mjs`.

O `smoke.mjs` instalava só um tarball. Depois de publicar, o que importa é o que o npm **serve**: o argumento pode agora ser uma especificação (`@gabreusi/hyrax@1.0.0`), e um erro de "ainda não disponível" é repetido, porque o registro demora a servir uma versão nova.

- [ ] **Step 1: Substituir o arquivo.** Só mudam o comentário do topo, a escolha do alvo e a instalação (com as tentativas); o resto é o mesmo da Fase 4.

````js
// scripts/smoke.mjs
// Installs the library tarball into a clean directory and imports every
// entrypoint through ESM and CJS, exactly as a consumer would.
//
//   node scripts/smoke.mjs [path/to/tarball.tgz]   (packs the repo when omitted)
//   node scripts/smoke.mjs @gabreusi/hyrax@1.0.0-rc.0   (installs from the registry: what npm serves)
//   HYRAX_SMOKE_RUNTIMES=deno,bun node scripts/smoke.mjs   (also checks those runtimes)
//   HYRAX_SMOKE_REACT=18 node scripts/smoke.mjs   (React 18 and its types instead of the latest)
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

// The /dom entrypoint must be importable and callable where there is no document (Node, Deno, Bun,
// a server render). This runs against the built package in each of them.
const DOM_SSR =
  '(dom) => [dom.getCSSVar("--x", "fallback"), Number.isNaN(dom.toPixels("2em")), typeof dom.listen(null, "click", () => {}), typeof dom.onClickOutside(null, () => {})].join(" ")';
const DOM_SSR_EXPECTED = "fallback true function function";

// /react must render on the server (no document, no effects) and, being all hooks and components,
// must say "use client" so that a Server Components bundler knows where the client boundary is.
// Only the /react entrypoint says it: the root and /dom stay usable from a server component.
const REACT_SSR =
  '(react, h, renderToString) => { const Page = () => { react.useForceUpdate(); react.useInterval(() => {}, 10, { autoStart: true }); react.useEventListener(globalThis.window, "resize", () => {}); react.useClickOutside(null, () => {}); return h(react.hx.div, { display: "flex" }, h(react.Portal, null, "popup"), h(react.hx.canvas, { width: 5 }), h("p", null, "ok")); }; return renderToString(h(Page)); }';
const REACT_SSR_EXPECTED = '<div style="display:flex"><canvas width="5"></canvas><p>ok</p></div>';

// A real TypeScript consumer of the public API. `@ts-expect-error` lines make the
// compile fail if the types ever become looser than intended.
const CONSUMER = `
import { alias, clamp, fabricate, isNumeric, random, Random, StringBuilder, Suspend, toCamelCase, traceHierarchy } from "${NAME}";
import type { RandomState, SecureRandom } from "${NAME}";
import { getCSSVar, listen, onClickOutside, toPixels } from "${NAME}/dom";
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

export const primary: string | null = getCSSVar("--primary");
export const gap: string = getCSSVar("--gap", "8px");
export const size: number = toPixels("2em");
export const stopResize: () => void = listen(window, "resize", (event: UIEvent) => void event);
export const stopOutside: () => void = onClickOutside(document.body, (event: PointerEvent) => void event);

// @ts-expect-error resize gives a UIEvent, not a KeyboardEvent
listen(window, "resize", (event: KeyboardEvent) => void event);
// @ts-expect-error toPixels takes a string or a number
toPixels(null);
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

const CONSUMER_REACT = `
import { hx, Portal, useClickOutside, useEventListener, useForceUpdate, useInterval } from "${NAME}/react";
import type { HxProps, PortalProps } from "${NAME}/react";
import { useRef } from "react";

export function Demo(props: PortalProps) {
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const forceUpdate: () => void = useForceUpdate();
  const timer: { start: () => void; stop: () => void; isRunning: boolean } = useInterval(forceUpdate, 1000, { autoStart: true, immediate: true });
  useEventListener(window, "resize", (event: UIEvent) => void event);
  useEventListener(box, "click", (event: MouseEvent) => void event);
  useClickOutside(box, (event: PointerEvent) => void event, { ignore: opener });
  const canvas: HxProps<"canvas"> = { width: 300, height: 150 };
  return (
    <hx.div display="flex" padding="8px" ref={box} rendered={timer.isRunning}>
      <hx.canvas {...canvas} backgroundColor="red" />
      <Portal {...props} container={document.body}>popup</Portal>
    </hx.div>
  );
}

// @ts-expect-error resize gives a UIEvent, not a KeyboardEvent
useEventListener(window, "resize", (event: KeyboardEvent) => void event);
// @ts-expect-error the delay is required
useInterval(() => {});
// @ts-expect-error a div has no href
void (<hx.div href="/" />);
// @ts-expect-error opacity is a number or a string, not a boolean
void (<hx.div opacity={true} />);
`;

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

const dir = mkdtempSync(join(tmpdir(), "hyrax-smoke-"));
try {
  // A tarball, or (when the argument is not a file) a package spec such as `@gabreusi/hyrax@1.0.0`.
  const argument = process.argv[2];
  const fromRegistry = argument !== undefined && !existsSync(resolve(argument));
  let tarball = argument && !fromRegistry ? resolve(argument) : undefined;
  if (!argument) {
    // `npm pack --json` prints an array up to npm 11 and an object keyed by package name on npm 12.
    const packed = JSON.parse(
      run("npm", ["pack", "--json", "--pack-destination", dir], process.cwd()),
    );
    const { filename } = Array.isArray(packed) ? packed[0] : Object.values(packed)[0];
    tarball = join(dir, filename);
  }
  const target = fromRegistry ? argument : tarball;

  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "smoke", private: true }));
  // react/react-dom are optional peers that /react needs; their types are needed to type-check a
  // consumer. HYRAX_SMOKE_REACT=18 checks the package against React 18 and its types instead.
  const at = process.env.HYRAX_SMOKE_REACT ? `@${process.env.HYRAX_SMOKE_REACT}` : "";
  const install = () =>
    run(
      "npm",
      [
        "install",
        "--no-audit",
        "--no-fund",
        target,
        ...["react", "react-dom", "@types/react", "@types/react-dom"].map((name) => name + at),
      ],
      dir,
    );
  // A version that was just published can take a moment to be served: try again before giving up.
  for (let attempt = 1; ; attempt++) {
    try {
      install();
      break;
    } catch (error) {
      if (!fromRegistry || attempt === 6) throw error;
      console.error(`${target} is not available yet (try ${attempt} of 6), waiting...`);
      await new Promise((done) => setTimeout(done, 10_000));
    }
  }

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

  const domScript = `console.log((${DOM_SSR})(dom));`;
  const domEsm = run(
    "node",
    ["--input-type=module", "-e", `import * as dom from "${NAME}/dom"; ${domScript}`],
    dir,
  ).trim();
  const domCjs = run(
    "node",
    ["-e", `const dom = require("${NAME}/dom"); ${domScript}`],
    dir,
  ).trim();
  if (domEsm !== DOM_SSR_EXPECTED || domCjs !== DOM_SSR_EXPECTED) {
    throw new Error(
      `/dom is not safe without a DOM: ESM "${domEsm}", CJS "${domCjs}", expected "${DOM_SSR_EXPECTED}"`,
    );
  }

  const reactScript = `console.log((${REACT_SSR})(react, h, renderToString));`;
  const reactEsm = run(
    "node",
    [
      "--input-type=module",
      "-e",
      `import * as react from "${NAME}/react"; import { createElement as h } from "react"; import { renderToString } from "react-dom/server"; ${reactScript}`,
    ],
    dir,
  ).trim();
  const reactCjs = run(
    "node",
    [
      "-e",
      `const react = require("${NAME}/react"); const { createElement: h } = require("react"); const { renderToString } = require("react-dom/server"); ${reactScript}`,
    ],
    dir,
  ).trim();
  if (reactEsm !== REACT_SSR_EXPECTED || reactCjs !== REACT_SSR_EXPECTED) {
    throw new Error(
      `/react does not render on the server: ESM "${reactEsm}", CJS "${reactCjs}", expected "${REACT_SSR_EXPECTED}"`,
    );
  }

  const client = (file) =>
    run(
      "node",
      [
        "-e",
        `console.log(require("fs").readFileSync(require.resolve("${NAME}/${file}"), "utf8").startsWith('"use client";'))`,
      ],
      dir,
    ).trim();
  // Resolved through the package `exports`: a file per entrypoint and per module format.
  const flags = {
    react: client("react"),
    dom: client("dom"),
    root: run(
      "node",
      [
        "-e",
        `console.log(require("fs").readFileSync(require.resolve("${NAME}"), "utf8").startsWith('"use client";'))`,
      ],
      dir,
    ).trim(),
  };
  if (flags.react !== "true" || flags.dom !== "false" || flags.root !== "false") {
    throw new Error(
      `"use client" must be on /react and only there: react=${flags.react} dom=${flags.dom} root=${flags.root}`,
    );
  }

  // Type-check a consumer against the installed package. Needs the repo's own
  // TypeScript, so it is skipped where dependencies are not installed.
  const tsc = resolve(process.cwd(), "node_modules/typescript/lib/tsc.js");
  const typed = existsSync(tsc);
  if (typed) {
    writeFileSync(join(dir, "consumer.mts"), CONSUMER);
    writeFileSync(join(dir, "consumer-react.tsx"), CONSUMER_REACT);
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
          "--jsx",
          "react-jsx",
          "--target",
          "es2022",
          "--module",
          module,
          "--moduleResolution",
          moduleResolution,
          "consumer.mts",
          "consumer-react.tsx",
        ],
        dir,
      );
    }
  }

  const runtimes = (process.env.HYRAX_SMOKE_RUNTIMES ?? "").split(",").filter(Boolean);
  const code = `${entrypoints.map((id, i) => `import * as m${i} from "${id}";`).join("")}
    import { createElement as h } from "react";
    import { renderToString } from "react-dom/server";
    if (m0.clamp(15, 10) !== 10) throw new Error("clamp broken");
    const { Random } = m0;
    const reactResult = (${REACT_SSR})(m2, h, renderToString);
    if (reactResult !== '${REACT_SSR_EXPECTED}') throw new Error("/react does not render on the server: " + reactResult);
    const domResult = (${DOM_SSR})(m1);
    if (domResult !== "${DOM_SSR_EXPECTED}") throw new Error("/dom is not safe without a DOM: " + domResult);
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

- [ ] **Step 2: Rodar as três formas de argumento.**

```bash
npx prettier --check scripts/smoke.mjs && npx eslint scripts/smoke.mjs
node scripts/smoke.mjs                                        # empacota o repositório
pack=$(mktemp -d) && npm pack --pack-destination "$pack" >/dev/null
node scripts/smoke.mjs "$pack"/*.tgz                          # um tarball
node scripts/smoke.mjs "file:$(ls "$pack"/*.tgz)"             # uma especificação (o npm a instala)
```

Esperado: as três terminam com `Smoke test passed: 3 entrypoints x (ESM + CJS) + consumer types`.

- [ ] **Step 3: Provar a repetição.** Uma versão que não existe deve ser tentada de novo e falhar no fim. A cópia abaixo encurta as esperas (2 tentativas e 0,5 s) só para o teste.

```bash
sed 's/attempt === 6/attempt === 2/; s/10_000/500/' scripts/smoke.mjs > scripts/smoke_short.tmp.mjs
node scripts/smoke_short.tmp.mjs "@gabreusi/hyrax@9.9.9" 2>&1 | grep -E "not available yet|E404"
rm scripts/smoke_short.tmp.mjs
```

Esperado: `npm error code E404`, depois `@gabreusi/hyrax@9.9.9 is not available yet (try 1 of 6), waiting...` e um segundo `E404`, e o comando termina com erro.

- [ ] **Step 4: Commit.**

```bash
git add scripts/smoke.mjs
git commit -m "feat: smoke-test a package from the registry, not only a tarball" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: O pacote nas mãos de esbuild, Vite e webpack

**Files:** criar `scripts/smoke-bundlers.mjs`; modificar `.github/workflows/ci.yml` e `package.json`.

A documentação promete que "uma função custa o que ela pesa". Este teste empacota o tarball com os três bundlers que os usuários usam e confere o tree-shaking e o tamanho. Cada caso importa **uma** coisa (ou, para provar que as marcas procuradas existem, **tudo** de um entrypoint). As marcas são textos que só um código contém: `"Random.restore()"` (o `Random`), `"This Suspend has been disposed"` (o `Suspend`), `"getComputedStyle"` (o `getCSSVar` e o `toPixels`) e `"PORTAL"` e `"hx."` (o `Portal` e o `hx`).

- [ ] **Step 1: Escrever o script.** Instala o tarball e `esbuild@0.28`, `vite@8`, `webpack@5`, `react` e `react-dom` num diretório temporário (o `type: module`), gera um `bundle.mjs` que roda os três bundlers sobre cada caso, e confere as marcas e os tamanhos. `HYRAX_SMOKE_VERBOSE=1` imprime o tamanho de cada bundle.

````js
// scripts/smoke-bundlers.mjs
// Bundles the installed package with esbuild, Vite and webpack, the way an app would, and checks the
// claims the documentation makes: an unused function is not in the bundle (tree-shaking), and importing
// one function costs about what it weighs, in each entrypoint.
//
//   node scripts/smoke-bundlers.mjs [path/to/tarball.tgz | package@spec]   (packs the repo when omitted)
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const NAME = "@gabreusi/hyrax";

// A case imports one thing (or, to prove the markers mean something, everything from an entrypoint).
// `present` and `absent` are strings that only some code contains: an error message or a name that
// survives minification. Importing everything must show the markers, so that "not found" in a
// single-function bundle is real tree-shaking and not a marker that never existed.
const RANDOM = "Random.restore()";
const SUSPEND = "This Suspend has been disposed";
const CASES = [
  {
    name: "everything from the root",
    source: `import * as all from "${NAME}"; console.log(all);`,
    present: [RANDOM, SUSPEND],
    absent: [],
    maxBytes: 60_000,
  },
  {
    name: "clamp from the root",
    source: `import { clamp } from "${NAME}"; console.log(clamp(15, 0, 10));`,
    present: [],
    absent: [RANDOM, SUSPEND],
    maxBytes: 600,
  },
  {
    name: "Random from the root",
    source: `import { Random } from "${NAME}"; console.log(new Random("x").int(1, 6));`,
    present: [RANDOM],
    absent: [SUSPEND],
    maxBytes: 14_000,
  },
  {
    name: "everything from /dom",
    source: `import * as all from "${NAME}/dom"; console.log(all);`,
    present: ["getComputedStyle"],
    absent: [],
    maxBytes: 60_000,
  },
  {
    name: "listen from /dom",
    source: `import { listen } from "${NAME}/dom"; listen(window, "resize", () => {});`,
    present: [],
    absent: ["getComputedStyle"],
    maxBytes: 600,
  },
  {
    name: "everything from /react",
    source: `import * as all from "${NAME}/react"; console.log(all);`,
    present: ["PORTAL", "hx."],
    absent: [],
    maxBytes: 60_000,
  },
  {
    name: "useForceUpdate from /react",
    source: `import { useForceUpdate } from "${NAME}/react"; console.log(useForceUpdate);`,
    present: [],
    absent: ["PORTAL", "hx."],
    maxBytes: 800,
  },
];

// Written into the temporary project, so that the bundlers resolve everything the way an app would.
const BUNDLE = `
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build as esbuild } from "esbuild";
import { build as vite } from "vite";
import webpack from "webpack";

const cases = JSON.parse(readFileSync("cases.json", "utf8"));
const external = ["react", "react-dom", "react/jsx-runtime"];
const results = {};

for (const [index, { source }] of cases.entries()) {
  const entry = join("entries", "case" + index + ".mjs");
  writeFileSync(entry, source);
  const out = {};

  const e = await esbuild({ entryPoints: [entry], bundle: true, minify: true, format: "esm", platform: "browser", external, write: false, logLevel: "silent" });
  out.esbuild = e.outputFiles[0].text;

  const v = await vite({ configFile: false, logLevel: "silent", build: { write: false, minify: true, lib: { entry, formats: ["es"], fileName: "out" }, rollupOptions: { external } } });
  const chunks = (Array.isArray(v) ? v : [v]).flatMap((r) => r.output);
  out.vite = chunks.map((c) => c.code ?? "").join("\\n");

  const dir = join("webpack-out", String(index));
  mkdirSync(dir, { recursive: true });
  await new Promise((done, fail) =>
    webpack({ mode: "production", entry: "./" + entry, target: "web", output: { path: join(process.cwd(), dir) }, externals: Object.fromEntries(external.map((name) => [name, name])) }, (error, stats) =>
      error || stats.hasErrors() ? fail(error ?? new Error(stats.toString({ all: false, errors: true }))) : done(),
    ),
  );
  out.webpack = readdirSync(dir).filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(dir, f), "utf8")).join("\\n");
  results[index] = out;
}
console.log(JSON.stringify(results));
`;

const run = (cmd, args, cwd, stdio = ["ignore", "pipe", "inherit"]) =>
  execFileSync(cmd, args, { cwd, encoding: "utf8", stdio, maxBuffer: 64 * 1024 * 1024 });

const dir = mkdtempSync(join(tmpdir(), "hyrax-bundlers-"));
try {
  const argument = process.argv[2];
  let target = argument && (existsSync(resolve(argument)) ? resolve(argument) : argument);
  if (!target) {
    // `npm pack --json` prints an array up to npm 11 and an object keyed by package name on npm 12.
    const packed = JSON.parse(
      run("npm", ["pack", "--json", "--pack-destination", dir], process.cwd()),
    );
    target = join(dir, (Array.isArray(packed) ? packed[0] : Object.values(packed)[0]).filename);
  }

  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "bundlers", private: true, type: "module" }),
  );
  // The majors are pinned: a new major of a bundler is news, and should not break the build unannounced.
  run(
    "npm",
    [
      "install",
      "--no-audit",
      "--no-fund",
      target,
      "esbuild@0.28",
      "vite@8",
      "webpack@5",
      "react",
      "react-dom",
    ],
    dir,
  );
  writeFileSync(join(dir, "cases.json"), JSON.stringify(CASES));
  writeFileSync(join(dir, "bundle.mjs"), BUNDLE);
  run("node", ["-e", 'require("fs").mkdirSync("entries", { recursive: true })'], dir);

  const results = JSON.parse(run("node", ["bundle.mjs"], dir));
  const problems = [];
  const sizes = [];
  for (const [index, c] of CASES.entries()) {
    for (const [bundler, code] of Object.entries(results[index])) {
      const bytes = Buffer.byteLength(code);
      sizes.push(`${bundler}/${c.name}: ${bytes} B`);
      const where = `${bundler}, "${c.name}"`;
      for (const text of c.absent) {
        if (code.includes(text))
          problems.push(`${where}: found "${text}", so it was not tree-shaken`);
      }
      for (const text of c.present) {
        if (!code.includes(text)) problems.push(`${where}: "${text}" is missing`);
      }
      if (bytes > c.maxBytes)
        problems.push(`${where}: ${bytes} B, over the ${c.maxBytes} B this case may take`);
    }
  }
  if (process.env.HYRAX_SMOKE_VERBOSE) console.log(sizes.join("\n"));
  if (problems.length > 0) throw new Error(`Bundler problems:\n- ${problems.join("\n- ")}`);
  console.log(
    `Bundlers passed: esbuild, Vite and webpack x ${CASES.length} cases (tree-shaking and size).`,
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
````

- [ ] **Step 2: Rodar.**

```bash
npx prettier --check scripts/smoke-bundlers.mjs && npx eslint scripts/smoke-bundlers.mjs
npm run build
HYRAX_SMOKE_VERBOSE=1 node scripts/smoke-bundlers.mjs 2>&1 | grep -v "npm warn"
```

Esperado: os tamanhos (sem compressão, minificados) e `Bundlers passed: esbuild, Vite and webpack x 7 cases (tree-shaking and size).` Medido: `clamp` 102 a 267 B, `listen` 142 a 344 B, `useForceUpdate` 160 a 348 B, `Random` 9 a 11,3 kB, e "tudo" do `/react` 3,7 a 5,1 kB.

- [ ] **Step 3: O `smoke:bundlers` entra no `check` e o CI ganha um job.** Em `.github/workflows/ci.yml`, entre o job `build` e o job `docs`, acrescente:

```yaml
  bundlers:
    name: Bundlers (esbuild, Vite, webpack)
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - uses: actions/download-artifact@v8
        with:
          name: tarball
          path: pack
      # Tree-shaking and size, as an app would bundle the installed package.
      - run: node scripts/smoke-bundlers.mjs pack/*.tgz
```

```bash
npm pkg set scripts.smoke:bundlers="node scripts/smoke-bundlers.mjs"
npm pkg set scripts.check="npm run lint && npm run format:check && npm run typecheck && npm run check:boundary && npm run test:coverage && npm run build && npm run check:package && npm run size && npm run smoke && npm run smoke:bundlers && npm run docs:examples && npm run docs:build"
npx prettier --write .github package.json
node -e '
const YAML = require("yaml"); const fs = require("fs");
console.log(Object.keys(YAML.parse(fs.readFileSync(".github/workflows/ci.yml", "utf8")).jobs).join(", "));'
```

Esperado: `quality, test, browser, test-react-18, build, bundlers, docs, smoke, runtimes`.

- [ ] **Step 4: Commit.** (A prova de que o teste pega um defeito de verdade vem na Task 8, junto com as outras.)

```bash
git add scripts/smoke-bundlers.mjs .github/workflows/ci.yml package.json
git commit -m "test: bundle the package with esbuild, Vite and webpack and check tree-shaking" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: O Changesets, em modo `rc`, com o primeiro changeset

**Files:** criar `.changeset/config.json`, `.changeset/README.md` e `.changeset/first-release.md`; modificar `package.json` e `package-lock.json`.

- [ ] **Step 1: Instalar.**

```bash
npm install -D @changesets/cli@3.0.3 @changesets/changelog-github@1.0.1
```

- [ ] **Step 2: Regenerar o lockfile com o npm 10 e conferir as três versões do npm.** Num diretório **sem** `node_modules` (dentro do repositório, o npm 11 e o 12 só respondem "up to date" e não provam nada).

```bash
npx -y npm@10 install --package-lock-only --ignore-scripts --no-audit --no-fund
d=$(mktemp -d) && cp package.json package-lock.json "$d" && (cd "$d" && for v in 10 11 12; do echo "npm@$v:"; npx -y npm@$v ci --dry-run --ignore-scripts --no-audit --no-fund 2>&1 | grep -E "EUSAGE|Missing|added"; done); rm -rf "$d"
```

Esperado: `added N packages` nas três versões (cerca de 596 no npm 10 e 501 nas outras duas), sem `EUSAGE` nem `Missing`. (Sem o passo anterior, o npm 10 recusa o lockfile com `Missing: @types/react@18.3.31 from lock file`: é o defeito da Fase 5, de novo.)

- [ ] **Step 3: A configuração, escrita à mão** (o `changeset init` é interativo). O `$schema` usa a versão instalada do `@changesets/config` (`4.0.1` na hora de escrever este plano: confira com `node -p "require('./node_modules/@changesets/config/package.json').version"` e ajuste se for outra). O `access` é `public`, o `baseBranch` é `main`, e o `CHANGELOG` usa a integração com o GitHub.

````json
// .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config@4.0.1/schema.json",
  "changelog": ["@changesets/changelog-github", { "repo": "gabreusi/hyrax" }],
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
````

````md
// .changeset/README.md
# Changesets

Every pull request that changes what a user of the package sees adds a changeset: a small file that says
which bump it is (`patch`, `minor` or `major`) and what to write in the changelog.

```sh
npm run changeset
```

On `main`, the release workflow collects the changesets into a "Version Packages" pull request, and publishing
happens when that pull request is merged. See "Releasing" in CONTRIBUTING.md.
````

- [ ] **Step 4: O primeiro changeset.** É a nota de lançamento do 1.0: vira o `CHANGELOG` e o texto do GitHub release. Um `major`, porque a versão 1.0 é a reescrita.

````md
// .changeset/first-release.md
---
"@gabreusi/hyrax": major
---

Hyrax is rebuilt from scratch as an isomorphic TypeScript toolkit, and is now published as `@gabreusi/hyrax` (the 0.x package was `@gpsign/hyrax`).

- **Three entrypoints, split by where the code runs.** `@gabreusi/hyrax` runs anywhere (numbers, strings, `Random`, `StringBuilder`, `Suspend` and more), `@gabreusi/hyrax/dom` needs a browser (`getCSSVar`, `toPixels`, `listen`, `onClickOutside`), and `@gabreusi/hyrax/react` has the hooks, `hx` and `Portal` for React 18 and 19. ESM and CommonJS builds with their own types, no runtime dependencies, tree-shakeable, and safe to render on the server.
- **`Random` is reproducible and has no bias.** A seed gives the same numbers in every runtime. It has an optional `luck`, `fork`, `state` and `restore`, weighted choices, dice notation, and `Random.secure()` for secrets.
- **The DOM and React utilities were rewritten**, and they fix a number of bugs of 0.x: capture listeners that were never removed, percentages measured against the window and not the container, a click-outside that could not cross Shadow DOM, and a `Portal` that broke server rendering.
- **Documented, and the examples are tests.** There is a site with a guide per module and a generated API reference, and every code example in them is checked against the built package.

This is a breaking change from 0.x in every corner: the API uses named imports only, and several functions were renamed, changed or removed. The migration guide lists all of it: https://gabreusi.github.io/hyrax/migration
````

- [ ] **Step 5: Entrar no modo `rc` e os scripts.** `changeset:version` roda o `changeset version` e formata o `CHANGELOG.md` e o `package.json` (o nome não pode ser `version`: é um gancho do npm). `release` é o que o workflow chama para publicar.

```bash
npx changeset pre enter rc
npm pkg set scripts.changeset="changeset"
npm pkg set scripts.changeset:version="changeset version && prettier --write CHANGELOG.md package.json"
npm pkg set scripts.release="changeset publish"
npx prettier --write .changeset package.json
ls .changeset
```

Esperado: `Entered pre mode with tag rc!` (a primeira linha da saída do `pre enter` é o cabeçalho `changeset v3.0.3`) e a pasta com `README.md`, `config.json`, `first-release.md` e `pre.json` (`{ "mode": "pre", "tag": "rc" }`).

- [ ] **Step 6: Conferir e commitar.**

```bash
npm run lint && npm run format:check && npm run typecheck
git add .changeset package.json package-lock.json
git commit -m "build: add Changesets, in rc pre-release mode, with the first changeset" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

O `changeset status` só enxerga o que foi **commitado**, e compara com a `main`: num clone novo, que não tem um `main` local, use `--since=origin/main`.

```bash
npx changeset status --since=origin/main
```

Esperado: `Packages to be bumped:`, `- major` e `- @gabreusi/hyrax`.

---

## Task 6: O workflow de release (desligado) e o CONTRIBUTING

**Files:** criar `.github/workflows/release.yml`; substituir `CONTRIBUTING.md`.

- [ ] **Step 1: O workflow.** Segue o exemplo oficial do npm (`registry-url`, `id-token: write`, `package-manager-cache: false`, `npm test` antes) com a action do Changesets no meio: com changesets pendentes ela abre (ou atualiza) o PR "Version Packages"; quando esse PR é mesclado, não há changesets, e ela roda `npm run release`. Só roda com `RELEASE_ENABLED=true`. O job `verify` instala do registro a versão que acabou de ser publicada e roda o smoke test (com as tentativas da Task 3) e confere a atestação de provenance.

````yaml
// .github/workflows/release.yml
name: Release

# Opens (or updates) the "Version Packages" pull request while there are changesets, and publishes to
# npm when that pull request is merged. It publishes with npm trusted publishing: there is no npm token
# anywhere, GitHub proves to npm which repository and workflow this is (OIDC), and the package gets a
# provenance statement.
#
# It does nothing until the repository variable RELEASE_ENABLED is "true". Set it after the trusted
# publisher is configured on npm, which can only be done once the package exists, so the first version is
# published by hand (see "Releasing" in CONTRIBUTING.md). The filename of this workflow is part of that
# configuration: renaming it breaks publishing until npm is told.

on:
  push:
    branches: [main]

permissions: {}

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  release:
    name: Version or publish
    if: ${{ vars.RELEASE_ENABLED == 'true' }}
    runs-on: ubuntu-latest
    permissions:
      contents: write # the version branch, the git tags and the GitHub releases
      pull-requests: write # the "Version Packages" pull request
      id-token: write # npm trusted publishing (OIDC) and provenance
    outputs:
      published: ${{ steps.changesets.outputs.published }}
      publishedPackages: ${{ steps.changesets.outputs.publishedPackages }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          registry-url: https://registry.npmjs.org
          # Never cache in a release build: a poisoned cache would end up in the package.
          package-manager-cache: false
      - run: npm ci
      # Trusted publishing needs npm 11.5.1 or newer (Node 24 ships a newer one).
      - name: Check the npm version
        run: |
          v=$(npm --version)
          echo "npm $v"
          [ "$(printf '%s\n11.5.1\n' "$v" | sort -V | head -1)" = "11.5.1" ]
      - run: npm test
      - id: changesets
        uses: changesets/action@v2
        with:
          version: npm run changeset:version
          publish: npm run release
          title: "chore: version packages"
          commit: "chore: version packages"
          createGithubReleases: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  # What npm serves is what gets tested: the version that was just published is installed from the
  # registry and run through the same smoke test as the tarball, and its provenance is checked.
  verify:
    name: Verify the published package
    needs: release
    if: ${{ needs.release.outputs.published == 'true' }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          package-manager-cache: false
      - run: npm ci
      - name: Smoke test the version on the registry
        env:
          PUBLISHED: ${{ needs.release.outputs.publishedPackages }}
        run: |
          version=$(node -e 'console.log(JSON.parse(process.env.PUBLISHED)[0].version)')
          echo "Verifying @gabreusi/hyrax@$version"
          node scripts/smoke.mjs "@gabreusi/hyrax@$version"
          npm view "@gabreusi/hyrax@$version" dist.attestations.provenance.predicateType --json
````

- [ ] **Step 2: O CONTRIBUTING.** Ganha as duas linhas novas da tabela de comandos (`smoke:bundlers` e a descrição do `check:package`) e a seção "Releasing": os changesets, o PR "Version Packages", o modo `rc`, o que é conferido, a variável `RELEASE_ENABLED` e o roteiro da primeira publicação. Substitua o arquivo inteiro.

````md
// CONTRIBUTING.md
# Contributing

## Setup

Use Node 24 (`nvm use`, see `.nvmrc`; Node 22 or newer works) and install with `npm ci`.

## One-time setup for the browser tests

The `/dom` and `/react` tests that need a real browser (layout, Shadow DOM, real clicks) run in Chromium. Install it once with
`npx playwright install chromium` (on Linux CI: `--with-deps`). `npm test` needs none of this.

## Commands

| Command                  | What it does                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `npm test`               | Runs the tests (`core` and `scripts` in Node, `dom` and `react` in happy-dom), without the browser       |
| `npm run test:browser`   | Runs only the tests that need a real browser (Chromium)                                                  |
| `npm run test:coverage`  | Everything, browser included, with coverage. `src/core`, `src/dom` and `src/react` must stay at 95%      |
| `npm run lint`           | ESLint. Every exported symbol needs TSDoc with an `@example`                                             |
| `npm run typecheck`      | Type-checks each entrypoint and the tests                                                                |
| `npm run check:boundary` | Fails if `src/core` starts compiling against DOM globals                                                 |
| `npm run build`          | Builds `dist/` (ESM, CJS and type declarations)                                                          |
| `npm run check:package`  | `publint`, Are the Types Wrong, and what the tarball holds (no source, nothing missing, under 100 kB)    |
| `npm run size`           | Enforces the bundle-size budget (whole entrypoint and one function)                                      |
| `npm run bench`          | Prints how fast the `Random` methods are next to `Math.random` and `crypto` (a report, not a gate)       |
| `npm run smoke`          | Installs the packed tarball, imports every entrypoint and type-checks a consumer                         |
| `npm run smoke:bundlers` | Bundles the packed tarball with esbuild, Vite and webpack, and checks tree-shaking and size              |
| `npm run docs:examples`  | Type-checks every code example (TSDoc, guides, README) against the built package, and runs the core ones |
| `npm run docs:build`     | Generates the API pages with TypeDoc, then builds the VitePress site (a dead link fails it)              |
| `npm run docs:dev`       | The same generation, then the site with live reload                                                      |
| `npm run check`          | Everything above, in CI order                                                                            |

## Rules of the repo

- `src/core` is universal: no `window`, `document` or Node-only APIs. The compiler enforces it (no DOM lib there).
- Only named exports. No default export and no aggregate object.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `build:`, `ci:`, `test:`, `chore:`).
- **The lockfile is written by npm 10**, the npm that Node 22 ships and the oldest one CI installs with:
  `npx -y npm@10 install --package-lock-only --ignore-scripts`. A lockfile written by npm 12 failed `npm ci` on npm 10
  (`Missing: react@18.3.1 from lock file`) while npm 11 and 12 accepted it, and only the Node 22 job of the CI noticed.

## Writing TSDoc

Every exported function and type gets a summary, `@param`, `@returns` and an `@example`. The lint rule enforces
the summary and the `@example`; the rest is on review.

- Document **each overload** separately, since editors show the doc of the signature the caller matched. The
  linter only guarantees the first one, so check the others by hand.
- The lint rules apply to what is exported. Private members (`#field`, `private`) and everything under
  `src/core/internal/` are exempt. A class needs an `@example` on the class itself; document each public
  method with `@param` and `@returns`.
- Write examples as one statement per line with the result in a trailing `// => value` comment. They are tested:
  see "Writing documentation" below.
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

## Testing `/dom`

- **Where a test goes.** Logic that a simulated DOM handles (events, cleanup, options) goes in `name.test.ts`
  (happy-dom). What needs a real browser goes in `name.browser.test.ts` (Chromium): layout (`em`, `%`, `dvh`,
  `calc()`), Shadow DOM event retargeting, real mouse clicks, and any regression that happy-dom would not notice.
  happy-dom does not resolve `%` or `dvh`, does not inherit custom properties from `<html>`, does not retarget
  shadow events, computes `composedPath()` when called (not at dispatch) and removes a capture listener even when
  the removal forgets the capture flag: a test for those behaviours passes there and proves nothing.
- **Server-side rendering.** Every function has a `name.ssr.test.ts` that starts with
  `// @vitest-environment node` and checks it returns its fallback (or a no-op) instead of throwing.
- **No imports from `src/core`.** `/dom` does not depend on the root entrypoint: an import from the core would
  make the build emit a chunk shared by the two and tie them together over a one-line function. (`/dom` does
  share one chunk with `/react`, which is built on it: that is the point of the layering.)

## Testing `/react`

- **Same three kinds of test as `/dom`.** `name.test.tsx` (happy-dom, with Testing Library), `name.ssr.test.tsx`
  (`// @vitest-environment node`, rendered with `renderToString`: nothing may read `document` or `window`
  while rendering) and `name.browser.test.tsx` (Chromium, real clicks with `userEvent` from `vitest/browser`).
- **Hooks are tested in StrictMode too.** It runs every effect twice in development: a hook that leaks a
  listener or a timer, or fires twice, shows up there.
- **Both React versions.** CI runs the `react` project, the type-check and the smoke test against React 18 and
  its types as well. Write source that compiles under both: do not name `RefObject` in a signature, since it
  means different things in 18 and 19.
- **`"use client"`** is added by the build to the `/react` entrypoint only (see `tsdown.config.ts`), and the
  smoke test fails without it.

## Writing documentation

The site is in `site/` (VitePress): a guide per module in `site/guide/`, the design notes in `site/notes/`, the migration
guide, and the API reference, which is **generated** from the TSDoc by TypeDoc into `site/api/` and never edited by hand.
`npm run docs:dev` shows it.

- **Examples are tests.** `npm run docs:examples` (it needs `npm run build` first) takes every `@example` in `src/`, every
  `ts` or `tsx` fence in `site/guide/` and in the README, and type-checks it against the **built package**, resolved through
  its `exports`. The examples of the universal core (and the guides for it) are also **run**. `/dom` and `/react` examples
  are type-checked only, because they need a browser or a component.
- **A trailing `// => value` is an assertion** when the value is a literal (a number, string, boolean, `null`, `undefined`,
  `NaN`, an array or an object of those): `clamp(15, 0, 10); // => 10`. Anything else after `=>` is prose (`// => 1 to 6`)
  and the line still runs. It must follow an expression or a single `const x = ...`.
- **Hyrax names are in scope**, imported for you from the right entrypoint. Write out every other import
  (`import { useRef } from "react";`), and declare whatever else the snippet uses: each example stands alone. A snippet
  that imports from a Hyrax entrypoint itself is left as it is.
- **To skip a fence** in a guide, put `<!-- untested -->` on the line before it.
- **Helper types that shape a signature but are not exported** are listed in `intentionallyNotExported` in
  `typedoc.json`; TypeDoc treats a warning as an error, so a new one has to be decided on.
- **Publishing.** The `docs` job of the CI builds the site on every pull request. `.github/workflows/docs.yml` deploys it
  to GitHub Pages from `main`, but only after Pages is set to deploy from GitHub Actions (Settings, Pages, Source) and the
  repository variable `DOCS_DEPLOY` is `true`.

## Releasing

Versions are decided by [Changesets](https://github.com/changesets/changesets), and published by the `release` workflow
with npm **trusted publishing**: there is no npm token in the repository, GitHub proves to npm which repository and
workflow is publishing (OIDC), and the package gets a provenance statement.

- **A pull request that changes what users see adds a changeset**: `npm run changeset` (pick `patch`, `minor` or
  `major`, and write the line for the changelog). One that changes nothing they see (tests, tooling, docs) adds none.
- **On `main`, the workflow opens a "Version Packages" pull request** with the new version and the changelog. **Merging
  it publishes**, creates the tag `vX.Y.Z` and the GitHub release.
- **The `rc` pre-release mode is on** until 1.0.0: versions are `1.0.0-rc.N` and are published under the dist-tag `rc`
  (`npm install @gabreusi/hyrax@rc`). To leave it, run `npx changeset pre exit` in a pull request, review the changesets
  in `.changeset/pre/` (they become the 1.0.0 changelog), and merge the "Version Packages" pull request that follows.
- **What the tarball holds is checked** (`npm run check:package`), and `npm publish` from a machine refuses a package that
  is private or still at the `0.0.0` placeholder (`prepublishOnly`).
- **The workflow does nothing until the repository variable `RELEASE_ENABLED` is `true`.** Its filename (`release.yml`) is part
  of the trusted publisher configuration on npm: renaming it breaks publishing until npm is told.
- **One-time setup.** npm can only configure a trusted publisher for a package that already exists, so the first version is
  published by hand, once, from a clean checkout of `main` at the version commit, with an npm account that has two-factor
  authentication on and owns the `@gabreusi` scope:

  ```sh
  npm login
  npm publish --tag rc           # prepublishOnly builds and checks first; this first version has no provenance
  git tag v1.0.0-rc.0 && git push origin v1.0.0-rc.0
  npm trust github @gabreusi/hyrax --file release.yml --repo gabreusi/hyrax --allow-publish
  ```

  `npm trust` needs npm 11.15 or newer. Then, in the repository settings, allow GitHub Actions to create and approve pull
  requests (Settings, Actions, General), and set the variable `RELEASE_ENABLED` to `true`. From then on every release is made
  by the workflow, and no npm token needs to exist.
````

- [ ] **Step 3: Conferir e commitar.**

```bash
npx prettier --write .github CONTRIBUTING.md
node -e '
const YAML = require("yaml"); const fs = require("fs");
console.log(Object.keys(YAML.parse(fs.readFileSync(".github/workflows/release.yml", "utf8")).jobs).join(", "));'
printf '%s\n11.5.1\n' "$(npm --version)" | sort -V | head -1    # o mesmo teste do workflow: imprime 11.5.1 se o npm for 11.5.1 ou mais novo
printf '%s\n11.5.1\n' "10.9.2" | sort -V | head -1               # imprime 10.9.2: o teste falharia
git add .github/workflows/release.yml CONTRIBUTING.md
git commit -m "ci: add the release workflow (trusted publishing, off until enabled) and document releasing" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

Esperado: `release, verify`; e as duas comparações de versão como descrito.

---

## Task 7: A versão `1.0.0-rc.0`

**Files:** modificar `package.json`; criar `CHANGELOG.md` e `.changeset/pre/first-release.md`; mover o changeset.

A publicação manual da `rc.0` sai de um checkout limpo da `main` **no commit da versão**, então esse commit entra no mesmo PR.

- [ ] **Step 1: Versionar.** A integração do `changelog-github` consulta a API do GitHub, e por isso precisa de um `GITHUB_TOKEN` (aqui, o do `gh`).

```bash
GITHUB_TOKEN=$(gh auth token) npm run changeset:version
grep -E '"version"|"private"' package.json
head -14 CHANGELOG.md | cut -c1-110
git status --short
```

Esperado: `"version": "1.0.0-rc.0"` e nenhum `"private"`; o `CHANGELOG.md` com `## 1.0.0-rc.0`, `### Major Changes` e a nota do lançamento; e o `git status` com `D .changeset/first-release.md`, ` M package.json`, `?? .changeset/pre/` e `?? CHANGELOG.md` (o changeset foi consumido e guardado em `.changeset/pre/`, e o `pre.json` mantém o modo).

- [ ] **Step 2: O `npm publish` de verdade, sem enviar nada.**

```bash
npm publish --dry-run --tag rc 2>&1 | grep -E "All good|Package contents OK|Publishing to|^\+ "
```

Esperado: `All good!`, `Package contents OK: 19 files`, `Publishing to https://registry.npmjs.org/ with tag rc and public access (dry-run)` e `+ @gabreusi/hyrax@1.0.0-rc.0`. **Nada é publicado** (`--dry-run`).

- [ ] **Step 3: Rodar tudo.**

```bash
rm -rf dist coverage site/api site/.vitepress/dist
npm run check; echo "exit=$?"
```

Esperado: `exit=0`, **54 arquivos e 586 testes**, `Package contents OK`, `Smoke test passed`, `Bundlers passed: esbuild, Vite and webpack x 7 cases`, `Examples passed: 130 type-checked, 99 of 99 run with 132 assertions` e `build complete`.

- [ ] **Step 4: Commit.**

```bash
git add package.json CHANGELOG.md .changeset
git commit -m "chore: version 1.0.0-rc.0" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Verificação final da 6a

**Files:** nenhum (só verificação). Nada aqui é commitado.

- [ ] **Step 1: Instalação limpa, o `check` completo e o lockfile nas três versões do npm.**

```bash
rm -rf node_modules dist coverage site/api site/.vitepress/dist .vitest .examples
npm ci
npx playwright install chromium
npm run check; echo "exit=$?"
d=$(mktemp -d) && cp package.json package-lock.json "$d" && (cd "$d" && for v in 10 11 12; do npx -y npm@$v ci --dry-run --ignore-scripts --no-audit --no-fund 2>&1 | grep -E "EUSAGE|Missing|added"; done); rm -rf "$d"
```

Esperado: `exit=0`, 54 arquivos, 586 testes, e `added N packages` nas três versões do npm.

- [ ] **Step 2: Reintroduzir quatro defeitos e ver cada um ser pego.** Salve o script abaixo **fora do repositório** e rode-o da raiz, depois do `npm run build`. Cada mutação restaura o que tocou.

````sh
// /tmp/prove_release.sh
#!/bin/bash
# Reintroduces four defects, one at a time, and shows that each is caught. Run from the repository root
# after `npm run build`. Every mutation restores what it touched.
set -u

echo "[1] a pack checker that accepts everything: the unit tests must fail"
cp scripts/release/checks.mjs /tmp/checks.bak
python3 - <<'PY'
path = "scripts/release/checks.mjs"
text = open(path).read()
old = "return paths.filter((path) => !ALLOWED.some((pattern) => pattern.test(path)));"
assert old in text
open(path, "w").write(text.replace(old, "return [];"))
PY
timeout 60 npx vitest run --project scripts scripts/release 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "Tests  "
cp /tmp/checks.bak scripts/release/checks.mjs

echo "[2] a source map in the tarball: check-pack must refuse it"
touch dist/leak.js.map
node scripts/check-pack.mjs 2>&1 | sed -n 2p
rm dist/leak.js.map

echo "[3] the 0.0.0 placeholder: the publish check must refuse it"
cp package.json /tmp/package.bak
npm pkg set version=0.0.0 >/dev/null
node scripts/check-pack.mjs --publish 2>&1 | sed -n 2p
cp /tmp/package.bak package.json

echo "[4] a module-level call to Random in the root entrypoint: every bundler must see the tree-shaking break"
cp src/index.ts /tmp/index.bak
printf '\nimport { Random as R } from "./core/random";\n(globalThis as Record<string, unknown>).__hyrax = new R("x").int(1, 6);\n' >> src/index.ts
npm run build >/dev/null 2>&1
rm -f /tmp/hyrax-mutant.tgz
mkdir -p /tmp/hyrax-mutant && npm pack --pack-destination /tmp/hyrax-mutant >/dev/null 2>&1
node scripts/smoke-bundlers.mjs /tmp/hyrax-mutant/*.tgz 2>&1 | grep -E "^- " | head -3
cp /tmp/index.bak src/index.ts
rm -rf /tmp/hyrax-mutant
npm run build >/dev/null 2>&1
git status --short src scripts package.json | grep -v "^??" || echo "nothing left modified by the mutations"
````

```bash
npm run build
bash /tmp/prove_release.sh
git status --short
```

Esperado: `[1]` `Tests  10 failed | 8 passed (18)`; `[2]` `- unexpected file in the tarball: dist/leak.js.map`; `[3]` `- the version is still the placeholder 0.0.0: run "changeset version" first`; `[4]` linhas `- esbuild, "clamp from the root": found "Random.restore()", so it was not tree-shaken` (e as do Vite e do webpack), e no fim `nothing left modified by the mutations`; e o `git status` vazio.

- [ ] **Step 3: O tarball final.**

```bash
pack=$(mktemp -d) && npm pack --pack-destination "$pack" 2>&1 | tail -3
tar -tzf "$pack"/*.tgz | sort
node scripts/smoke.mjs "$pack"/*.tgz
```

Esperado: o `prepublishOnly` **não** roda no `npm pack`; o tarball `gabreusi-hyrax-1.0.0-rc.0.tgz` com 19 entradas (`package/LICENSE`, `package/README.md`, `package/package.json` e os `package/dist/*`), e o smoke test passando.

- [ ] **Step 4: Estabilidade.** O que é novo (os testes de `scripts/release`) é determinístico, mas o laço custa pouco:

```bash
f=0; for i in $(seq 1 20); do timeout 60 npx vitest run --project scripts >/dev/null 2>&1 || f=$((f+1)); done; echo "scripts falhas: $f/20"
```

Esperado: `0/20`.

- [ ] **Step 5: Conferir a árvore e o histórico.**

```bash
git status --short          # vazio
git log --oneline main..HEAD
git tag --list 'v*'         # vazio: nenhuma tag foi criada
```

Esperado: a árvore limpa; **7 commits** (o plano e o spec, e um por task de 2 a 7: `feat:`, `feat:`, `test:`, `build:`, `ci:` e `chore:`; a Task 1 não commita); e nenhuma tag `v*`.

- [ ] **Step 6: Parar aqui e pedir autorização ao usuário.** Só com a autorização explícita: `git push -u origin phase-6-release` e abrir o PR (título: `Phase 6: release tooling and version 1.0.0-rc.0`), com o resumo, o que a implementação encontrou, o plano de teste e, no fim, o que só o GitHub confirma: o job novo `bundlers` e o `release.yml` aparecendo como *skipped* (a variável `RELEASE_ENABLED` não existe ainda). Depois de aberto: `gh pr checks <n> --watch` e ler o log do job `bundlers` pelo link de `gh pr checks <n> --json name,link` (nunca `gh run list --branch`). **Depois do merge, o roteiro 6b é seu.**

---

## 6b. Depois do merge: publicar a `1.0.0-rc.0` (roteiro do dono)

Tudo aqui pede a **sua** conta do npm e as **suas** configurações do repositório, então é você quem roda. Eu volto no passo 7.

1. **Confirme a conta e o escopo do npm.** Entre em https://www.npmjs.com com o usuário `gabreusi` (crie, se não existir) e ligue o 2FA no nível da conta ("Authorization and writes"). No terminal: `npm login` e `npm whoami` (deve dizer `gabreusi`). O escopo `@gabreusi` é o do usuário e existe sozinho. O registro hoje responde 404 para `@gabreusi/hyrax`, o que é o esperado.
2. **Um checkout limpo da `main`, no commit da versão.**

   ```bash
   git switch main && git pull --ff-only origin main
   git status --short                      # vazio
   grep '"version"' package.json           # 1.0.0-rc.0
   npm ci && npm run check                 # exit 0
   ```
3. **Publique.** O `prepublishOnly` constrói e confere antes; o npm pede o código do 2FA.

   ```bash
   npm publish --tag rc
   ```

   Esperado: `+ @gabreusi/hyrax@1.0.0-rc.0`. **Esta versão não tem provenance** (não há OIDC fora do CI); as seguintes terão.
4. **Veja as dist-tags** e decida: `npm view @gabreusi/hyrax dist-tags`. Se o npm também apontou `latest` para a `rc.0` (é o que ele costuma fazer com a primeira versão de um pacote), pode deixar até o 1.0.0. Se só houver `rc`, um `npm install @gabreusi/hyrax` sem tag dá "No matching version": os documentos vão dizer `@rc`.
5. **A tag e a release do GitHub.**

   ```bash
   git tag v1.0.0-rc.0 && git push origin v1.0.0-rc.0
   gh release create v1.0.0-rc.0 --prerelease --title "v1.0.0-rc.0" --notes-file <(sed -n '/^## 1.0.0-rc.0/,/^## /p' CHANGELOG.md | sed '1d;$d')
   ```
6. **Configure o trusted publisher.** Precisa do npm 11.15 ou mais novo e da conta com 2FA (você tem o 11.19). Ou, sem a linha de comando: npmjs.com, o pacote, Settings, Trusted publishing.

   ```bash
   npm trust github @gabreusi/hyrax --file release.yml --repo gabreusi/hyrax --allow-publish
   npm trust list @gabreusi/hyrax
   ```

   O nome do arquivo (`release.yml`), o repositório (`gabreusi/hyrax`) e o ambiente (nenhum) precisam ser exatamente estes.
7. **Ligue o workflow.** Em https://github.com/gabreusi/hyrax/settings/actions marque **"Allow GitHub Actions to create and approve pull requests"**, e crie a variável:

   ```bash
   gh variable set RELEASE_ENABLED --body true --repo gabreusi/hyrax
   ```
8. **Me avise.** Eu confiro o que o npm serve, sem precisar de login nenhum:

   ```bash
   npm view @gabreusi/hyrax dist-tags versions
   node scripts/smoke.mjs @gabreusi/hyrax@rc
   node scripts/smoke-bundlers.mjs @gabreusi/hyrax@rc
   ```

   e abro o **PR de documentação**: o aviso "Not published yet" do *Getting started* vira uma nota de release candidate com `npm install @gabreusi/hyrax@rc`, a nota de *Status* do README idem, e o selo do npm entra no README. Não precisa de changeset (só documentação).

## 6c. Da rc ao 1.0.0 (você e eu)

1. **Validar em uso real.** É o motivo da rc. Instale `@gabreusi/hyrax@rc` em projetos de verdade e procure o que os testes não veem:
   - um app **Vite + React + TypeScript**: importe os três entrypoints, `vite build`, e olhe o tamanho e os avisos;
   - scripts de **Node** em ESM e em CJS, e em **Deno** (`npm:@gabreusi/hyrax@rc`) e **Bun**;
   - um app **Next.js (App Router)**: os hooks e o `Portal` em um Client Component, e o entrypoint raiz e o `/dom` em um Server Component (a diretiva `"use client"` só está no `/react`);
   - o editor: os tipos, o autocompletar e o TSDoc aparecem em cada função?

   O que aparecer vira um changeset `patch` (ou `minor`) e uma `rc.N`.
2. **Provar o caminho OIDC antes do 1.0.0.** Abra um PR com um changeset `patch` pequeno ("Release candidate 2: the first version published from the CI"), mescle, e o workflow abre o PR "Version Packages"; mescle-o, e ele publica a `1.0.0-rc.1` **com provenance**. O job `verify` instala a versão do registro. Se o passo de publicação falhar por autenticação, confira: o nome do arquivo (`release.yml`), o repositório e o ambiente do `npm trust list`; o `id-token: write`; o npm (11.5.1 ou mais novo); e o `repository.url` do `package.json`. O plano B é publicar a rc à mão de novo, como no 6b.
3. **Sair do modo rc.** Um PR com `npx changeset pre exit` (revise `.changeset/pre/`: eles viram o changelog do 1.0.0) e um changeset se preciso; mescle, mescle o "Version Packages" que o workflow abre, e o `1.0.0` sai na dist-tag `latest`, com a tag `v1.0.0` e o GitHub release. Confira: `npm view @gabreusi/hyrax dist-tags` (`latest: 1.0.0`).
4. **Deprecar o pacote antigo** (o dono do `@gpsign/hyrax`, com 2FA). Vale para as 16 versões:

   ```bash
   npm login     # como gpsign
   npm deprecate @gpsign/hyrax "Moved to @gabreusi/hyrax (1.0 and newer). Migration guide: https://gabreusi.github.io/hyrax/migration"
   ```
5. **O PR de documentação final** (eu): tira a nota de release candidate, `npm install @gabreusi/hyrax`, e o README sem "Status".
6. **Do dono, sem código:** a descrição e os tópicos do repositório no GitHub, e onde você quiser anunciar.

**Definição de pronto do 1.0 (spec, seção 8):** zero dependências de runtime (sim), o núcleo compila sem DOM (sim, o `check:boundary`), `publint` e `attw` sem avisos (sim, a cada PR), todo símbolo exportado com TSDoc e exemplo (sim, e os exemplos são testados), cobertura e orçamento de tamanho dentro dos limites (sim), e o pacote construído funciona em Node ESM e CJS (sim, e agora também nos três bundlers). Falta só o que a Fase 6 entrega: o pacote no npm.
