# Hyrax 1.0: design da ressurreição

Data: 2026-09-18 · Status: aguardando revisão · Pacote: `@gabreusi/hyrax`

## 1. Objetivo

Transformar a Hyrax, hoje uma coleção informal de utilitários TypeScript + React (0.6.1), numa biblioteca
robusta, com API coerente, código de qualidade, documentação excepcional e distribuição no padrão das
grandes bibliotecas do npm.

Requisito central: **a biblioteca não é uma lib de frontend React.** O núcleo roda em qualquer runtime
(Node, browser, Deno, Bun). O que depende de DOM ou React fica em entrypoints separados e opcionais.

### Decisões já tomadas

| Tema | Decisão |
|---|---|
| Posicionamento | Toolkit isomórfico, um único pacote, zero dependências de runtime |
| Nome e registro | `@gabreusi/hyrax` no npmjs (o escopo `@gpsign` não faz mais sentido). Em paralelo, tentar reivindicar `hyrax` (abandonado desde 2017). `@gpsign/hyrax` recebe `npm deprecate` no 1.0 |
| Compatibilidade | Sem compat com a API 0.x. O 0.x permite quebras, e o guia de migração cobre a transição |
| Entrypoints | Três, por ambiente: raiz (universal), `/dom`, `/react`. Só exports nomeados, sem o objeto default `Hyrax` |
| Peças mantidas | `Random`, `Suspend`, `alias`, `StringBuilder`, `fabricate`, `nvl` (como `coalesce`), `hx`, `Portal`, matemática e casing de strings |
| Peças removidas | `length`, `useAudioRecorder`, `ChildrenRefs`, `BlurListener`, `useChildrenRefs`, `getBoundingClientRect`, `getCSSProperties`, tipos `Any`/`Widen`/`Count`/`Index`/`AnyRecord` |
| Documentação | Site VitePress em inglês, API gerada por TypeDoc, exemplos do TSDoc testados no CI |

### Fora de escopo

- Entrypoints para outros frameworks (`/vue`, `/svelte`). O desenho permite adicioná-los depois; nenhum é entregue no 1.0.
- Aleatoriedade criptograficamente segura.
- Compatibilidade retroativa com a API 0.x.
- Publicação no GitHub Packages.
- O modo `stateless` do `useInterval`.

## 2. Estrutura do repositório e empacotamento

```
src/
  index.ts              → raiz universal (@gabreusi/hyrax)
  core/                 number, string, random, alias, tree, fabricate, coalesce,
                        suspend, string-builder, types
  dom/index.ts          → @gabreusi/hyrax/dom
  react/index.ts        → @gabreusi/hyrax/react
docs/                   site VitePress (a pasta docs/superpowers/ é ignorada via srcExclude)
```

- Testes ficam ao lado do código (`*.test.ts`) e fora do build. Hoje o `dist/test/` vaza para o pacote publicado.
- **A fronteira é imposta pelo compilador.** O `core/` compila com um `tsconfig` sem a lib `DOM` e sem
  `@types/node`. Referências a `window`, `document` ou `NodeJS.Timeout` viram erro de compilação. Cada
  entrypoint tem seu `tsconfig`.
- `package.json`:
  - `"type": "module"`. `exports` para os três entrypoints, cada um com condições `import` e `require` e seus
    próprios `.d.ts` e `.d.cts`.
  - `sideEffects: false`, `files: ["dist"]`, `engines.node >= 20`.
  - Zero `dependencies`.
  - `peerDependencies`: `react >= 18` e `react-dom >= 18`, ambos **opcionais** (`peerDependenciesMeta`). Só o
    `/react` os exige, e só o `Portal` usa `react-dom`.
- `dist/` sai do git e é gerado no CI. O `.npmrc` do GitHub Packages é removido. A publicação vai só para o
  npmjs, com provenance.
- Compilação: ES2022, `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`.

## 3. Núcleo: funções puras

Todo símbolo público tem TSDoc completo, com `@example` executado como teste.

### number
- `clamp(v, min, max)` e `clamp(v, max)`. Só `number`, sem strings numéricas. Tolera `min > max` por troca
  explícita (corrige o `sort()` lexicográfico atual: `clamp(50, 5, 100)` retorna o valor errado hoje).
- `lerp(a, b, t)`.
- `remap(v, [inMin, inMax], [outMin, outMax])` (antigo `map`, que recebia cinco números posicionais). Se o
  intervalo de entrada tem largura zero, retorna `outMin` (hoje divide por zero e devolve `NaN`/`Infinity`).
- `ratio(value, max = 100, min = 0)` (antigo `percent`). Devolve a fração do valor dentro do intervalo, para
  ser multiplicada por outros valores e manter proporções. Não faz clamp. Intervalo zero → `0`.
  - `ratio(50) // 0.5` · `ratio(30, 60) // 0.5` · `ratio(75, 100, 50) // 0.5`

### string
- `toCamelCase`, `toPascalCase`, `toSnakeCase`, `toKebabCase`, `splitWords`. Compartilham um único
  tokenizador Unicode (`\p{L}` e `\p{N}`).
- Dígitos preservados (`"foo2bar"` → `"foo2bar"`; hoje os dígitos são apagados).
- Siglas tratadas (`"XMLHttpRequest"` → `"xmlHttpRequest"`).
- Entrada não-string é erro de tipo, não retorno silencioso.

### nullish
- `coalesce(...values)`: primeiro valor não nulo. Retorno tipado como `NonNullable<T[number]> | null`.

### fabricate
- Os quatro overloads atuais (callback; callback + params; contexto + callback; contexto + callback +
  params). Comportamento inalterado. É uma expressão de bloco: inicializa uma `const` com early returns sem
  `let`. Novos testes cobrem retorno assíncrono e `this`.

### isNumeric / toNumber
- `isNumeric(v)`: aceita números finitos, `bigint` e strings decimais. Rejeita `Infinity`, strings vazias ou só
  com espaço, e hexadecimal.
- `toNumber(v, fallback = 0)`: puro. A resolução de unidades CSS vai para `/dom` (`toPixels`).

### tree
- `traceHierarchy(node, key)`: iterativo. Um ciclo lança `RangeError` (é dado corrompido, não algo a engolir).

### alias
- Mesma assinatura. Corrige um bug: `inverse[p]` num `{}` comum encontra `toString`/`constructor`
  herdados, então `aliased.toString` devolve `undefined`. Passa a usar um mapa sem protótipo.
- Encaminha `get`, `set`, `has` e `deleteProperty`, então `"alias" in obj` funciona. Aliases não aparecem em
  `Object.keys`.
- Alias duplicado, ou que colide com uma chave real, lança erro na criação. Um alias idêntico à própria chave
  é ignorado (como hoje).

### noop e tipos
- `noop` inalterado.
- Tipos públicos: `Nullable<T>`, `Maybe<T>` (antigo `Nullun`), `AnyString`, `Numeric`.

## 4. Núcleo: `Random`, `StringBuilder`, `Suspend`

### Random

Classe sem métodos `static`, mais uma instância compartilhada e sem seed, `random`.

```ts
import { Random, random } from "@gabreusi/hyrax";

random.int(1, 6);                    // uso rápido
const r = new Random("fixture-42");  // determinístico
r.int(1, 6); r.float(0, 1); r.boolean(0.75);
r.from(["a", "b", "c"]); r.shuffle(list); r.pop(list);
r.date("2020-01-01", "2020-12-31");
r.id(12); r.uuid();
```

- Motor sfc32 semeado por cyrb128. O estado avança de fato a cada chamada. Os caches globais e a reseed a
  cada `number()` saem, e com eles o vazamento de memória.
- `int(min, max)` é inclusivo nos dois lados e sem viés (o `Math.round` atual dá metade da chance aos
  extremos). `float(min, max)` cobre `[min, max)`. Substituem `number(min, max, digits)`.
- `shuffle` usa Fisher-Yates sobre `int` e devolve uma cópia (hoje só há 101 valores possíveis por passo).
- `boolean(chance = 0.5)` recebe uma fração de 0 a 1. Fora do intervalo lança `RangeError`.
- `uuid()` devolve um UUID v4 real, gerado a partir do fluxo com seed (determinístico quando há seed). O
  método antigo vira `id(length, alphabet?)`, agora com o `0` no alfabeto. O `UUID_CACHE` sai, e a doc avisa
  que não há garantia de unicidade.
- `from`, `pop`, `date` permanecem. O `pop` usa o índice sorteado direto, sem `indexOf`.
- Saem `Symbol.toPrimitive`, `toString` e o `console.error` de combinações esgotadas.
- **Contrato de determinismo:** mesma seed e mesma sequência de chamadas produzem a mesma saída em qualquer
  runtime. Os testes fixam vetores conhecidos. Mudar o algoritmo é uma quebra major. Documentado como **não
  criptográfico**.

### StringBuilder

- Mantém o encadeamento: `append`, `remove`, `if`, `elif`, `else`.
- Configuração por objeto: `new StringBuilder({ separator: " ", unique: true })`. `StringBuilder.init` sai.
- O prefixo é aplicado uma única vez. `unique` e `remove` comparam o texto final (hoje `append("x", "a-")` seguido
  de `remove("x")` não remove nada, e `unique` ignora o prefixo).
- `get(delim)` vira `build(separator?)`. `toString()` usa o separador configurado. `Symbol.toPrimitive` sai.
- Semântica de `if`/`elif`/`else` documentada e testada: cada `if` abre uma cadeia nova, e `else` só dispara
  se nenhum ramo da cadeia atual entrou.

### Suspend

Deixa de ser um singleton estático e passa a ser por instância.

```ts
const suspend = new Suspend({ threshold: 3000, interval: 1000 });
const off = suspend.on((elapsed) => reconnect(elapsed), { once: false });
off();
suspend.dispose();
```

- Sem referência a `window`. O timer usa `unref()` quando existe, para não segurar um processo Node vivo. A
  limpeza em `beforeunload` sai.
- Bug corrigido: o `last` era fixado no carregamento da classe, então um primeiro listener adicionado
  10 minutos depois disparava "suspenso por 600 s". Passa a ser zerado ao iniciar.
- O timer inicia no primeiro listener e para no último. `threshold` e `interval` são configuráveis. Um
  listener que lança erro não impede os outros de rodar.
- Limitação documentada: usa `Date.now()`, então ajuste manual do relógio pode causar falso positivo. Os testes
  usam timers falsos para simular saltos de tempo.

## 5. `/dom` e `/react`

A lógica fica em `/dom`, sem framework. O `/react` só a embrulha. Quem usa Vue, Svelte ou JS puro consome
`/dom` direto.

### `/dom` (só browser)

Todas as funções são seguras em SSR: sem `document`, devolvem o fallback em vez de lançar.

| API | Função |
|---|---|
| `getCSSVar(name, fallback?)` | Lê de `document.documentElement`, com `.trim()` no valor |
| `toPixels(value, element?)` | Resolve `"2em"`, `"50%"`, `"10dvh"`, `"var(--gap)"` e `"--gap"`. O `element` define o contexto de `em` e `%` (padrão `body`) |
| `listen(target, type, handler, options?)` | `addEventListener` tipado que devolve a função de desinscrever |
| `onClickOutside(targets, handler, options?)` | Usa `composedPath()` (Shadow DOM e nós removidos durante o clique). Opção `requireInsideFirst` (padrão `false`) reproduz a exigência antiga do `BlurListener`. Devolve a função de desinscrever |

### `/react` (React >= 18, testado em 18 e 19)

- `useEventListener(target, type, handler, options?)`: o handler fica numa ref, sem array de dependências.
  Aceita `window`, `document`, elemento ou ref.
- `useClickOutside(ref | refs, handler, options?)`: embrulha `onClickOutside`.
- `useInterval(handler, delay, { autoStart, immediate })`: retorna `{ start, stop, isRunning }`. Handler numa
  ref e reinício correto quando `delay` muda.
- `useForceUpdate()`: função estável (`setState` funcional). Sem `.id` e `.counter`.
- `hx`:
  - Remove o `React.memo` (não protege nada, porque `style` e `children` mudam a cada render).
  - Passa a usar `forwardRef` e ter `displayName` (`hx.div`).
  - O `Proxy` ignora chaves `symbol`.
  - Conflito de atalhos com atributos nativos (`<hx.canvas width>`, `img`, `svg`, `video`, `border` de tabela):
    os tipos dos atalhos passam a ser `Omit` das props nativas do elemento, e uma pequena tabela de tags
    garante o mesmo no runtime.
  - `rendered` e `transient` inalterados.
- `Portal`: renderiza só depois de montado (hoje lê `document.body` durante o render e quebra em SSR). Ganha a
  prop `container` (padrão `body`). `open`, `disabled`, `transient` e `id` inalterados.
- Tipos usam `import type` do React, sem o namespace global `React.`.

## 6. Qualidade, documentação, CI e release

### Tooling
- tsdown (ESM + CJS + `.d.ts`); npm (mantém o lockfile atual). TypeScript fixado em `~6.0` (não 7.x):
  `typescript-eslint` declara suporte a `typescript < 6.1`.
- Vitest com testes ao lado do código, `happy-dom` e Testing Library para `/dom` e `/react`, `expectTypeOf`
  para tipos públicos, `fast-check` para propriedades (`clamp`, `remap`, casing, `shuffle`), vetores fixos para
  `Random`. Cobertura mínima de 95% no `core`.
- ESLint (flat config, typescript-eslint, `react-hooks` só em `/react`) e Prettier. Uma regra exige TSDoc com
  `@example` em todo símbolo exportado.
- `size-limit` por entrypoint, com o limite guardado no CI.

### CI (GitHub Actions)
Em todo PR: lint; typecheck por entrypoint; testes em Node 22, 24 e 26 (o Vitest 5 exige Node >= 22.12, e o
Node 20 está em EOL desde abril/2026); `/react` contra React 18 e 19; build; `publint`;
`@arethetypeswrong/cli` com `--profile node16`; smoke test do pacote construído, instalado a partir do tarball,
em Node 20, 22, 24 e 26 por ESM e CJS (Bun e Deno como jobs best-effort); `size-limit`; build do site de docs.
`engines.node` continua `>=20`: o código é ES2022 e o smoke test cobre o Node 20. Consumidores em TypeScript
precisam de `moduleResolution` `node16`, `nodenext` ou `bundler` para resolver `/dom` e `/react`.

### Release
- changesets (PR de versão e `CHANGELOG` automáticos).
- Publicação por **trusted publishing via OIDC**, sem token npm de longa duração e com provenance.
- Primeira publicação: `1.0.0-rc.1` na tag `next`. Depois de validar em uso real, `1.0.0`.
- No 1.0, `npm deprecate @gpsign/hyrax` apontando para `@gabreusi/hyrax`.

### Higiene
`LICENSE` (MIT), `CONTRIBUTING`, `.idea` no `.gitignore`, `.npmrc` removido, `package.json` com `repository`,
`bugs`, `homepage`, `keywords` apontando para `gabreusi/hyrax`.

### Documentação
- Site VitePress no GitHub Pages, com busca local. Páginas: *Getting started*, um guia por módulo (com o
  porquê), *Design notes* (contrato de determinismo, runtimes suportados), guia de migração 0.x → 1.0 e
  referência de API gerada do TSDoc via TypeDoc.
- README enxuto: badges, instalação, exemplo de 10 linhas, tabela dos três entrypoints.
- Exemplos testados: um script extrai os blocos `@example` do TSDoc e os executa, transformando `// => valor`
  em asserções. É o único tooling customizado e o mais caro de manter. Fallback se ficar frágil: só
  type-check dos exemplos.

## 7. Guia de migração (mapa 0.x → 1.0)

| 0.x | 1.0 |
|---|---|
| `Hyrax` (objeto default), `HyraxDOM`, `HyraxString`, `HyraxNumber`, `utils` | Removidos. Use imports nomeados |
| `map(x, inMin, inMax, outMin, outMax)` | `remap(x, [inMin, inMax], [outMin, outMax])` |
| `percent(v, hundred, zero)` | `ratio(v, max, min)` |
| `clamp` com strings numéricas | `clamp` só com `number` |
| `Random.number(min, max, digits)` | `random.int(min, max)` / `random.float(min, max)` |
| `Random.uuid(n)` | `random.id(n)` (o `uuid()` novo é um UUID v4 real) |
| `Random.boolean(75)` | `random.boolean(0.75)` |
| `Random.<método>` estático | Instância `random` ou `new Random(seed)` |
| `new StringBuilder(true)` | `new StringBuilder({ unique: true })` |
| `StringBuilder.get(delim)` | `build(separator)` |
| `Suspend.addListener(cb, once)` | `new Suspend(opts).on(cb, { once })` |
| `nvl` | `coalesce` |
| `Nullun<T>` | `Maybe<T>` |
| `toNumber("2em")` (com DOM) | `toPixels("2em")` em `/dom` |
| `getPropertySize` | `toPixels` em `/dom` |
| `useHTMLEventListener(ref, type, fn, deps)` | `useEventListener(ref, type, fn)` |
| `useUpdate` | `useForceUpdate` |
| `useInterval(..., { initial, stateless })` | `useInterval(..., { autoStart })` |
| `BlurListener`, `ChildrenRefs`, `useChildrenRefs` | `useClickOutside` / `onClickOutside` |
| `length`, `useAudioRecorder`, `getBoundingClientRect`, `getCSSProperties` | Removidos |

## 8. Fases de implementação

Cada fase vira um plano próprio. As fases 1 a 4 dependem só da fase 0 e podem ser reordenadas.

| # | Fase | Entrega |
|---|---|---|
| 0 | Fundação | Limpeza do repo, tsdown, `exports`, `tsconfig`s, Vitest, ESLint/Prettier, CI base, LICENSE, README-esqueleto |
| 1 | Núcleo puro | Seção 3, com testes e TSDoc |
| 2 | Classes do núcleo | `Random`, `StringBuilder`, `Suspend` (Seção 4) |
| 3 | `/dom` | `getCSSVar`, `toPixels`, `listen`, `onClickOutside` |
| 4 | `/react` | Hooks, `hx`, `Portal`, matriz React 18/19 |
| 5 | Docs | Site, TypeDoc, guia de migração, script dos exemplos |
| 6 | Release | `1.0.0-rc.1`, validação, `1.0.0`, `npm deprecate` no pacote antigo |

### Definição de pronto para o 1.0
- Zero dependências de runtime; o `core` compila sem DOM.
- `publint` e `attw` sem avisos.
- Todo símbolo exportado tem TSDoc e exemplo.
- Cobertura e orçamento de tamanho dentro dos limites.
- O pacote construído funciona em Node ESM e CJS.

## 9. Pendências fora do código

Não bloqueiam o design, mas precisam ser resolvidas antes da fase 6.

1. O usuário ou org `gabreusi` precisa existir no npm e ser dono do escopo `@gabreusi` (não foi possível
   verificar a partir do repositório).
2. Definir o titular do copyright no `LICENSE` (o `package.json` atual lista o autor como `gpsign`).
3. Abrir a disputa pelo nome `hyrax` no npm (pacote de terceiro sem publicações desde 2017). Se vier, trocar
   o nome é uma linha no `package.json`, e o rc ainda pode sair sob `@gabreusi/hyrax`.
4. O `gh` local está autenticado como `gpsign`, mas o remote é `gabreusi/hyrax`. O CI usa a identidade do
   próprio Actions, mas pushes locais podem exigir trocar a conta.
5. Configurar o trusted publisher no npm (repositório e workflow) antes do primeiro `publish`.
