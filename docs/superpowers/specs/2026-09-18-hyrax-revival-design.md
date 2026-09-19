# Hyrax 1.0: design da ressurreição

Data: 2026-09-18 (seção 4, `Random`, revista em 2026-09-19) · Status: aguardando revisão · Pacote: `@gabreusi/hyrax`

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
| Peças mantidas | `Random` (com modo seguro, `luck`, `fork` e `state`), `Suspend`, `alias`, `StringBuilder`, `fabricate`, `nvl` (como `coalesce`), `hx`, `Portal`, matemática e casing de strings |
| Peças removidas | `length`, `useAudioRecorder`, `ChildrenRefs`, `BlurListener`, `useChildrenRefs`, `getBoundingClientRect`, `getCSSProperties`, tipos `Any`/`Widen`/`Count`/`Index`/`AnyRecord` |
| Documentação | Site VitePress em inglês, API gerada por TypeDoc, exemplos do TSDoc testados no CI |

### Fora de escopo

- Entrypoints para outros frameworks (`/vue`, `/svelte`). O desenho permite adicioná-los depois; nenhum é entregue no 1.0.
- Segurança criptográfica do `Random` **com seed**: ele é reproduzível e, por isso, previsível. Só `Random.secure()` é seguro.
- Compatibilidade retroativa com a API 0.x.
- Publicação no GitHub Packages.
- O modo `stateless` do `useInterval`.

## 2. Estrutura do repositório e empacotamento

```
src/
  index.ts              → raiz universal (@gabreusi/hyrax)
  core/                 number, string, random, alias, tree, fabricate, coalesce,
                        suspend, string-builder, types
    internal/           (não exportado) host, engines, luck, dice
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

Uma classe, sem métodos `static` duplicados, com **dois motores** atrás da mesma API e uma instância compartilhada e
sem seed, `random`. O desenho foi revisto em 2026-09-19, antes de qualquer implementação, porque o algoritmo, os vetores de
saída e os formatos de `fork` e `state` viram contrato no 1.0.

```ts
import { Random, random } from "@gabreusi/hyrax";

random.int(1, 6);                              // uso rápido, sem seed
const rng = new Random("fixture-42");          // reproduzível; um número vale como a sua string
const lucky = new Random({ seed: "x", luck: 1 });
const secure = Random.secure();                // fonte criptográfica: sem seed, sem reprodutibilidade

rng.int(1, 6); rng.float(0, 1); rng.boolean(0.75);
rng.from(["a", "b"]); rng.pop(list); rng.shuffle(list); rng.sample(list, 3);
rng.weighted({ comum: 80, raro: 15, epico: 5 }); rng.roll("2d6+3");
rng.normal(100, 15); rng.exponential(2);
rng.date("2020-01-01", "2020-12-31"); rng.id(12); rng.uuid(); rng.bytes(16);
rng.fork("terreno", 3, 4); rng.state(); Random.restore(estado);
secure.token(); // base64url, só existe no modo seguro
```

**Garantias (cada uma é um teste que pode falhar)**

| Método | Viés | `luck` | Fonte |
|---|---|---|---|
| `int` (com `luck = 0`), `from`, `pop`, `shuffle`, `sample`, `id`, `date` | **Zero, por rejeição** (sorteia de novo quando cai fora) | só `int` | 1 palavra de 32 bits (2 acima de 2^32, até 2^53) |
| `float`, `boolean` | Resolução de 2^-53, o limite do `double` | sim | 2 palavras: 53 bits |
| `weighted` | Zero para pesos representáveis; peso 0 nunca é sorteado | sim | 53 bits |
| `normal`, `exponential` | Contínuas, sem `log(0)` (usam `1 - next()`) | nunca | 53 bits |
| `uuid`, `id`, `bytes`, `token` | Sem viés | nunca | o motor |

- **Motor com seed:** sfc32 semeado por cyrb128, com 12 saídas descartadas. **Não é criptográfico**: quem observa algumas saídas
  consegue prever as próximas, inclusive na instância `random` sem seed. O estado tem 128 bits, então `shuffle` com seed só
  alcança todas as permutações até 34 elementos (34! < 2^128 < 35!). Os dois limites ficam documentados.
- **Motor seguro:** `crypto.getRandomValues` com buffer de 256 palavras (medido: 43 ns por palavra, contra 3,1 µs sem buffer).
  Se `crypto` não existir, `Random.secure()` **lança erro**, e nunca cai em `Math.random`. Sem o limite de 34 elementos.
- **`Random.secure()` devolve `SecureRandom`**, uma classe irmã de `Random` (as duas herdam os métodos de sorteio de uma base
  comum) sem `seed` nem `state` (`secure.state()` não compila) e com `fork()` sem chaves, que devolve outro gerador seguro.
  `token(bytes = 32)` (base64url, sem padding) **só existe em `SecureRandom`**: no tipo `Random` ele não existe, então
  `rng.token()` nem compila (em JavaScript puro é um `TypeError`), porque um "token" reproduzível seria uma armadilha de
  segurança. `SecureRandom` é exportado só como **tipo**.

**`luck`: vantagem contínua.** Só na criação (`new Random({ seed, luck })` ou `Random.secure({ luck })`), imutável, `0` por padrão
(`RangeError` para valores não finitos; a documentação recomenda de -5 a 5). Sobre um sorteio uniforme `u`:
`luck >= 0`: `u' = u^(1/(1+luck))` (equivale a manter o melhor de `1 + luck` sorteios); `luck < 0`: `u' = 1 - (1-u)^(1/(1-luck))`
(o pior de `1 - luck`), calculado como `-expm1(log1p(-u) / (1 - luck))` porque a forma direta perde precisão para `u`
minúsculo (`1 - u` só existe em passos de 2^-53) e empurraria esse sorteio para cima em vez de para baixo. Com `luck = 0` é a
identidade exata. `u'` é limitado a `1 - 2^-53`: sem isso, com `luck >= 2` e o maior
`u` possível, `u'` chega a `1.0` e `float` devolveria o próprio `max` e `int` um índice fora do intervalo.

| luck | d20 médio | P(d20 >= 15) | teste de 50% |
|---|---|---|---|
| -2 | 5,5 | 2,7% | 12,5% |
| -1 | 7,2 | 8,9% | 24,9% |
| 0 | 10,5 | 30,1% | 50,1% |
| 1 | 13,8 | 50,9% | 75,0% |
| 2 | 15,5 | 65,7% | 87,5% |
| 4 | 17,2 | 83,2% | 96,9% |

- Age só nos métodos de **resultado**: `int`, `float`, `boolean`, `weighted`, `roll`. Os **estruturais** (`from`, `pop`, `shuffle`,
  `sample`, `date`, `id`, `uuid`, `bytes`, `token`, `normal`, `exponential`) ignoram o `luck`.
- **Monotonia:** cada chamada consome sempre o mesmo número de sorteios, com qualquer `luck`. Para a mesma seed e a mesma sequência
  de chamadas, aumentar o `luck` nunca piora nenhum resultado individual de `int`, `boolean`, `weighted` e `roll`; em `float` vale
  até um degrau de arredondamento (2^-52), porque `Math.pow` não é exatamente monótona no último bit. Para o `int` exato isso
  custa uma fração de 32 bits a mais por chamada, ignorada quando `luck = 0`.
- `boolean(chance)` é `true` quando `u' >= 1 - chance`; com `luck = 1` um teste de 50% vira 75%. Em `weighted`, `luck` positivo
  desliza o peso para o **fim da lista**: liste do mais comum ao mais raro.

**Métodos**
- `next()`: `float` justo em `[0, 1)`, 53 bits, nunca afetado por `luck`.
- `float(min, max)`: `[min, max)` de verdade (o resultado nunca é `max`), limites em qualquer ordem, `RangeError` se não finitos.
- `int(min, max)`: inclusivo nos dois lados, limites fracionários arredondados para dentro, ordem invertida aceita, `RangeError`
  quando não há inteiro no intervalo.
- `boolean(chance = 0.5)`: `chance` de 0 a 1; fora disso `RangeError` (`boolean(50)` não vira "sempre").
- `from(fonte)`: elemento de array, ponto de código de string ou valor de objeto; `undefined` se vazio. `pop(array)` remove por
  posição. `shuffle(array)` devolve uma cópia (Fisher-Yates).
- `sample(itens, n)`: `n` posições distintas, em ordem aleatória, sem alterar o original; `RangeError` se `n` for negativo,
  fracionário ou maior que o tamanho.
- `weighted(itens, pesos)` e `weighted({ chave: peso })`: `RangeError` para tamanhos diferentes, lista vazia, peso negativo ou
  não finito e soma zero. Em objetos, chaves inteiras (`"1"`) o JavaScript reordena antes das demais.
- `normal(média = 0, desvio = 1)`: Box-Muller. `exponential(taxa = 1)`: `-ln(1 - next()) / taxa`.
- `roll(notação)`: soma de termos, cada um `NdM` (com `kh K` ou `kl K`) ou uma constante: `"2d6+3"`, `"4d6kh3"`,
  `"1d8+1d6-1"`. Sem distinção de maiúsculas, espaços ignorados, no máximo 1000 dados no total, `RangeError` que aponta o trecho
  inválido. Cada dado usa o `luck`.
- `date(after, before)`: até 2^53 ms, `RangeError` para datas inválidas; o limite superior padrão é "agora", então só é
  reproduzível se os dois limites forem passados.
- `id(length = 10, alphabet?)` com o `0` no alfabeto; `uuid()` v4 real; `bytes(n)`: 4 bytes por palavra, big-endian.
- `fork(...chaves)`: gerador independente e **estável**: depende só da seed do pai e das chaves, nunca de quantos sorteios o pai
  já fez. A seed do filho é o JSON de `[seedDoPai, ...chaves]` (então `fork("a/b")` nunca colide com `fork("a", "b")`) e
  reproduz o filho com `new Random(filho.seed)`. Herda o `luck`.
- `state()` devolve `{ version: 1, seed, luck, engine: [a, b, c, d] }`, JSON puro; `Random.restore(estado)` valida o formato e
  retoma exatamente de onde parou.
- Saem `Symbol.toPrimitive`, `toString`, o `console.error` de combinações esgotadas, o parâmetro `digits` do `number` legado e o
  `UUID_CACHE`.

**Desempenho** (medido na implementação final, Node 26): `uuid()` **127 ns**, mais rápido que o `crypto.randomUUID` nativo (161 ns);
`id(16)` de 1,8 µs para **218 ns**; `roll("2d6+3")` de 855 ns para **265 ns** com o cache de notações; `int(1, 6)` 16 ns (o
`Math.random` faz 7 ns). No modo seguro: `int` 46 ns, `uuid()` 183 ns e `token()` 390 ns. `int` exato por rejeição custa ~10 ns a mais que o `floor` de um
`float` (30 contra 20 ns), preço aceito pela garantia de viés zero. Um `scripts/bench.mjs` (`npm run bench`) reproduz os números
sem ser gate de CI.

**Forma da API.** Os métodos ficam na própria classe, e não como funções soltas. Medido na implementação final (brotli, minificado):
o `Random` inteiro custa **3,15 kB**, e o seu núcleo sem `weighted`, `sample`, `normal`, `exponential` e `roll` custa **2,23 kB**, ou
seja, os cinco extras somam **0,92 kB** que todo usuário de `Random` paga, mesmo se só usar `int`. A aposta é que ~1 kB não compensa
perder autocomplete e encadeamento; se isso mudar, mover os extras para funções tree-shakeable (`roll(rng, "2d6")`) é mecânico e
não altera nenhuma saída. Importar só `clamp` continua custando 76 B.

**Organização do código.** `random-base.ts` (a classe abstrata com os métodos de sorteio), `random.ts` (`Random`: seed, `fork`,
`state`, `restore`, `secure`) e `secure-random.ts` (`SecureRandom`, `token`). Em `internal/`: `engines.ts` (sfc32 e o motor com
`crypto`), `luck.ts`, `float.ts` (`MAX_UNIT` e `nextDown`), `dice.ts` (a gramática de `roll` e um cache pequeno e limitado das
notações) e `scripted.ts` (o motor roteirizado dos testes). **Nenhum trabalho no nível do módulo**: os arrays e os tipos
tipados são criados na primeira chamada e as constantes `2 ** 53` viram literais, porque um empacotador mantém qualquer chamada de
topo que não consiga provar inofensiva, e isso fez `clamp` isolado passar de 76 B para 238 B antes da correção.

**Contrato de determinismo (congelado no 1.0).** Vale bit a bit, em qualquer runtime, para tudo o que usa aritmética inteira: o
motor, `next`, `int` com `luck = 0`, `from`, `pop`, `shuffle`, `sample`, `weighted` com `luck = 0`, `roll` com `luck = 0`, `date`,
`id`, `uuid`, `bytes`, `fork` e `state`. Para o que usa `Math.pow`, `Math.log` e `Math.cos` (`luck` diferente de zero, `normal`,
`exponential`) o ECMAScript **não exige** o mesmo arredondamento em todo motor: a saída é idêntica na prática (V8 e
JavaScriptCore descendem do fdlibm) e o smoke test confere isso no Node, no Deno e no Bun, mas a garantia formal é só a de
"dentro de um arredondamento". Para uma seed ficam fixos: o motor, a fórmula de `next()`, a rejeição
(quais bits, quantos sorteios), a transformação do `luck` e o seu limite, a derivação de `fork`, o formato `state` v1, as
fórmulas de `normal` e `exponential`, a gramática de `roll`, a ordem cumulativa de `weighted`, o layout de `uuid` e `bytes` e a
codificação de `token`. **Mudar a saída de qualquer método para uma mesma seed é uma versão major; adicionar métodos é minor.**
Os vetores de cada método ficam fixados nos testes e o smoke test exige a mesma saída em Node ESM, Node CJS, Deno e Bun.

**Fora, de propósito:** `poisson`, `bigint`, tabela de alias para `weighted` de milhões de itens, ruído de Perlin e geradores de
dados falsos. São adições compatíveis, então podem esperar.

**Testes.** O viés zero é provado sem estatística: no modo seguro, um `crypto.getRandomValues` falso alimenta palavras
roteirizadas, e para `int(0, 5)` (3 bits) os 8 padrões de bits devem produzir 0 a 5 exatamente uma vez e rejeitar 6 e 7. O
mesmo mecanismo força `u` máximo com `luck` alto. Também: monotonia do `luck` com `fast-check`, médias contra a tabela teórica,
`fork` independente do uso do pai, ida e volta de `state`, buffer do modo seguro, peso 0 nunca sorteado, e mutações que
reintroduzem cada defeito para provar que os testes o pegam.

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
| `Random.<método>` estático | Instância `random` ou `new Random(seed)`; para tokens, `Random.secure()` |
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
