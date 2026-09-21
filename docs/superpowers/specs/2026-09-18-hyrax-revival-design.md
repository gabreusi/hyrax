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

Sem dependências e **autocontido**: não importa nada de `src/core` (um import faria o build emitir um chunk compartilhado e
amarraria os dois entrypoints por uma função de uma linha). Nada roda no import: só dentro das funções. (O `/react`, que é
construído sobre o `/dom`, importa dele, e o chunk que resulta é dos dois.)

Todas as funções são seguras em SSR: sem `document`, devolvem o fallback (ou uma função que não faz nada) em vez de lançar.

| API | Função |
|---|---|
| `getCSSVar(name, fallback?)` | Lê de `document.documentElement`, com `.trim()`. Valor ausente ou vazio devolve o `fallback` (qualquer tipo; `null` por padrão). Uma variável definida só no `<body>` não é vista |
| `toPixels(value, element?)` | Resolve `"2em"`, `"50%"`, `"10dvh"`, `calc()`, `min()`, `var(--gap)` e `"--gap"`. O `element` (padrão `<body>`) é o contexto de `em`, `%` e das variáveis. Aceita **negativos** (`-1rem`). Um número passa direto. Devolve **`NaN`** quando não consegue resolver |
| `listen(target, type, handler, options?)` | `addEventListener` tipado (janela, documento, elemento ou qualquer `EventTarget`) que devolve a função de desinscrever. Alvo `null`/`undefined` não faz nada |
| `onClickOutside(targets, handler, options?)` | Chama o `handler` para um toque fora dos `targets`. Devolve a função de desinscrever |

**`toPixels`.** Mede com um elemento auxiliar dentro do `element`, sem altura, invisível e removido depois (mesmo se algo lançar). O
valor vai em **`margin-left`** e não em `width`, porque `width` recusa negativos. As `var()` são resolvidas pela própria biblioteca
antes de medir (com fallbacks aninhados e proteção contra ciclos), porque uma `var()` que o navegador não resolve faz a propriedade
"não valer" e a medição devolveria, em silêncio, a largura do contêiner. `auto`, `inherit`, `initial`, `unset` e `revert` são
recusados (dão `NaN`), porque um navegador os mede como `0px`. **Precisa de um motor de layout:** um elemento com `display: none`, ou
solto do documento, dá `NaN` para `%`. O retorno é `NaN`, e não `0`, porque `0` é um tamanho válido e um `NaN` não se confunde com ele.

**`onClickOutside`.** Escuta `pointerdown` no `document`, **na fase de captura**, por padrão (cobre mouse, toque e caneta, e um
`stopPropagation()` interno não esconde o toque). Decide "dentro" pelo **`composedPath()`**, que é fixado no despacho: por isso
enxerga um nó que um handler anterior removeu e atravessa Shadow DOM (onde `event.target` chega retargetado para o host). Opções:

| Opção | Padrão | Efeito |
|---|---|---|
| `event` | `"pointerdown"` | Qualquer evento do `document` (`"click"`, `"mousedown"`, `"focusin"`...); o tipo do `handler` acompanha |
| `capture` | `true` | Escuta na captura; `false` escuta no borbulhamento |
| `ignore` | nenhum | Elementos que contam como "dentro", tipicamente o botão que abre o popup (evita fechar e reabrir no mesmo clique) |
| `requireInsideFirst` | `false` | O comportamento antigo do `BlurListener`: só chama depois de um toque *dentro*, e só volta a chamar depois de outro |

`targets` aceita um elemento, uma lista, ou uma **função** lida a cada toque (para refs e elementos que aparecem depois); entradas
`null`/`undefined` são toleradas.

**Bugs do código legado que isto corrige.** `getBoundingClientRect` e `getCSSProperties` saem. O `useHTMLEventListener` chamava
`removeEventListener(type, callback)` sem repassar a captura, então um listener de captura **nunca** era removido. O
`getPropertySize` media com `position: fixed`, então `%` era relativo à janela e não ao contêiner. Uma variável ausente medida
por `toPixels` devolvia a largura do pai. O `BlurListener` decidia "dentro" subindo `parentElement`, que não atravessa Shadow DOM
nem enxerga nó removido.

**Testes.** O `happy-dom` não é um navegador: não resolve `%`, `dvh` nem `calc()`; não herda variáveis de `<html>` para `<body>`; não
retarget eventos de Shadow DOM; calcula `composedPath()` na hora da chamada (e não no despacho); e remove um listener de captura
mesmo quando a remoção esquece a flag. Testes desses comportamentos **passam lá sem provar nada**. Por isso `/dom` tem três tipos
de teste: `nome.test.ts` (`happy-dom`: lógica, eventos, limpeza), `nome.ssr.test.ts` (Node puro, com
`// @vitest-environment node`: o fallback em vez de lançar) e `nome.browser.test.ts` (**Chromium real**, pelo modo *browser* do Vitest
com Playwright: layout, Shadow DOM, cliques reais com `userEvent`, e as regressões que o `happy-dom` não perceberia).

### `/react` (React >= 18, testado em 18 e 19)

O `/react` embrulha o `/dom`: importa dele, então o build emite um chunk que **só os dois compartilham** (`listen` e
`onClickOutside`); a raiz continua sem chunk. O entrypoint começa com **`"use client";`** (o build o põe só nele, nunca
na raiz nem no `/dom`, que continuam usáveis em um Server Component) para que Next.js e outros bundlers de React Server
Components saibam onde termina o servidor. Tudo renderiza no servidor, sem `document` e sem lançar; os efeitos só rodam
no cliente.

| API | Função |
|---|---|
| `useEventListener(target, type, handler, options?)` | `listen` durante a vida do componente. O `handler` fica numa ref (sem array de dependências, sem reinscrever). Aceita `window`, `document`, elemento, `EventTarget` ou uma ref, e `null`/`undefined` não faz nada. As `options` são desmontadas em `capture`/`once`/`passive`/`signal`: um objeto novo a cada render não reinscreve |
| `useClickOutside(refs, handler, options?)` | `onClickOutside` durante a vida do componente. `refs` e `ignore` aceitam uma ref, um elemento ou uma lista deles, lidos **a cada toque** (um elemento que aparece depois é achado). Só `event`, `capture` e `requireInsideFirst` reinscrevem |
| `useInterval(handler, delay, { autoStart, immediate })` | Devolve `{ start, stop, isRunning }`. O `handler` fica numa ref; trocar o `delay` com o intervalo rodando reinicia o temporizador; `start` e `stop` são estáveis e valem quando o React confirma a atualização, não na mesma linha |
| `useForceUpdate()` | Função estável (`setState` funcional). Sem `.id` e `.counter` |
| `hx` | Ver abaixo |
| `Portal` | Ver abaixo |

**`useEventListener`.** Uma ref é lida quando o efeito roda, depois do primeiro render: um elemento renderizado
condicionalmente (que aparece depois) escapa de uma ref. Para esse caso, guarde o elemento em estado com uma ref de função
(`<div ref={setNode}>`) e passe o estado. No servidor `window` não existe e nomeá-lo lança `ReferenceError`: passe
`globalThis.window` (ou `globalThis.document`), que ali é `undefined` e o hook ignora. Uma ref é distinguida de um alvo
de eventos por ter `addEventListener`, e não por ter `current`: uma página pode definir uma global `current`, e o `window`
pareceria uma ref.

**`useClickOutside`.** "Dentro" é decidido pelo DOM, não pela árvore do React: o conteúdo de um `Portal` está em outro
lugar da página, então liste-o em `refs`, ou um toque nele conta como fora.

**`useInterval`.** `autoStart` é `false` por padrão, como o `initial` do legado. O estado `isRunning` é um estado de
verdade (o modo `stateless`, que devolvia uma ref, sai) e o temporizador é um efeito dele e do `delay`, então o StrictMode
não duplica nada. `immediate` chama o `handler` no momento em que o intervalo **começa**, e não de novo quando o `delay`
muda (isso é um reinício do temporizador, não um começo). Não há `delay: null`: para pausar, use `stop()`. No StrictMode, em desenvolvimento, o React roda todo efeito duas vezes ao montar: `immediate` junto com `autoStart` chama o `handler` duas vezes
nessa hora (`start()` chama uma).

**`hx`.**
- Remove o `React.memo` (não protege nada, porque `style` e `children` mudam a cada render).
- Passa a usar `forwardRef` e ter `displayName` (`hx.div`, `hx(Card)`).
- O `Proxy` ignora chaves `symbol` (é assim que a linguagem e as ferramentas olham para um objeto, e nenhuma é uma tag).
- Conflito de atalhos com atributos nativos: **uma tabela** de tags (`canvas`, `img`, `video`, `svg`, `input`, `iframe`,
  `embed`, `object`, `source` e os elementos SVG que têm `width`/`height` para `width` e `height`; `table` para `border`)
  é lida pelos tipos e pelo runtime, então não podem discordar. Onde o atributo é nativo, a prop **continua atributo**
  (`<hx.canvas width={300}>` dimensiona o canvas; um `width` em CSS não dimensiona) e o tipo do atalho é omitido. A
  consulta usa `Object.hasOwn`: uma tag chamada `toString` não pode achar a função que todo objeto herda.
- Um atalho vence a mesma chave em `style`, e sem atalho o `style` passa como veio (e sem `style`, nenhum é criado).
- `children` vai nas props, e não como terceiro argumento do `createElement`.
- `hx(Component)` dá a qualquer componente só o `rendered` e o `transient`, **sem atalhos**. O legado tipava assim, mas o
  runtime consumia os nomes dos atalhos mesmo assim, então um componente que declarasse `width` nunca o recebia.
- `rendered` e `transient` inalterados.

**`Portal`.** Renderiza só depois de montado (o legado lia `document.body` durante o render e quebrava em SSR). Sem
`document`, e durante a hidratação, não renderiza nada; a árvore do cliente o renderiza logo depois, sem divergência de
hidratação. Ganha a prop `container` (padrão `document.body`; `null` significa "ainda não pronto" e não renderiza nada:
guarde o elemento em estado com uma ref de função). `open`, `disabled`, `transient` e `id` inalterados. Com `disabled`
os filhos saem no lugar, também no servidor.

**Tipos.** `import type` do React, sem o namespace global `React.`. `RefObject` significa coisas diferentes no React 18 e
no 19, então a API pública usa `RefLike<T>` (`{ readonly current: T | null }`) e `MaybeRef<T>`, que aceitam as duas.

**Testes.** Os mesmos três tipos do `/dom`: `nome.test.tsx` (`happy-dom` e Testing Library), `nome.ssr.test.tsx` (Node
puro, `renderToString`) e `nome.browser.test.tsx` (Chromium: cliques reais e a remoção de um listener de captura, que o
`happy-dom` faz mesmo quando esquece a flag). Todo hook é testado também em StrictMode. O CI roda o projeto `react`, o
type-check e o smoke test contra o React 18 e seus tipos.

## 6. Qualidade, documentação, CI e release

### Tooling
- tsdown (ESM + CJS + `.d.ts`); npm (mantém o lockfile atual). TypeScript fixado em `~6.0` (não 7.x):
  `typescript-eslint` declara suporte a `typescript < 6.1`.
- Vitest com testes ao lado do código, `happy-dom` e Testing Library para `/react`, `expectTypeOf` para tipos
  públicos, `fast-check` para propriedades (`clamp`, `remap`, casing, `shuffle`), vetores fixos para `Random`. `/dom`
  também roda em **Chromium real** (`@vitest/browser-playwright`, projeto `browser`, que também cobre o `/react`). Cobertura mínima de 95% no
  `core` e no `dom`, somando os três ambientes. `npm test` roda só o que não precisa de navegador; `npm run
  test:coverage` roda tudo e exige `npx playwright install chromium` uma vez.
- ESLint (flat config, typescript-eslint, `react-hooks` só em `/react`) e Prettier. Uma regra exige TSDoc com
  `@example` em todo símbolo exportado.
- `size-limit` por entrypoint, com o limite guardado no CI.

### CI (GitHub Actions)
Em todo PR: lint; typecheck por entrypoint; testes em Node 22, 24 e 26 (o Vitest 5 exige Node >= 22.12, e o
Node 20 está em EOL desde abril/2026), sem navegador; um job com **Chromium** que roda todos os projetos com a cobertura;
`/react` contra React 18 e 19; build; `publint`;
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

O site é em inglês (é a documentação de uma biblioteca de npm) e fica em `site/` (o `docs/` guarda os specs e os planos).

- **VitePress 1.6** (a 2.0 ainda é alpha) no GitHub Pages (`https://gabreusi.github.io/hyrax/`, `base: "/hyrax/"`), com busca local.
  Páginas: *Getting started*, um guia por módulo (números, textos, `Random`, ajudantes, `Suspend`, `/dom`, `/react`, cada um com o
  porquê e uma seção "Reference"), *Design notes* (contrato de determinismo, runtimes suportados, tamanhos, exemplos testados,
  camadas), guia de migração 0.x → 1.0 e a referência de API.
- **Referência de API gerada** do TSDoc pelo TypeDoc 0.28 (que suporta o TypeScript 6.0), com `typedoc-plugin-markdown` e
  `typedoc-vitepress-theme`. Vai para `site/api/`, **não é versionada** e é gerada em todo build. Um comentário `@module` em cada
  barrel dá o nome do módulo; `treatWarningsAsErrors` está ligado, e os tipos que aparecem numa assinatura pública sem serem
  exportados (`Shortcuts`, `NativeKeys`, `shortcutKeys`, `UnionToIntersection`, `AliasFor`) ficam em `intentionallyNotExported`,
  porque exportá-los ampliaria o que se promete. O VitePress falha o build com um link quebrado, e isso cobre os links dos guias
  para a API.
- **README enxuto:** selos, instalação, um exemplo curto, a tabela dos três entrypoints e o link para o site.
- **Exemplos testados** (`scripts/check-examples.mjs`, com a lógica pura em `scripts/examples/assertions.mjs`, testada à parte). É o
  único tooling customizado e o mais caro de manter. Extrai os `@example` do TSDoc (pela API do compilador) e as cercas `ts` e `tsx`
  dos guias e do README. **Todos** têm os tipos conferidos contra o **pacote construído** (`@gabreusi/hyrax` resolve pela própria
  `exports`, então o que se confere são os tipos publicados), e os do **núcleo** (`src/core`, `src/index.ts`, os guias do núcleo e o
  README) também são **executados**, com `// => valor` virando uma asserção. `/dom` e `/react` só têm os tipos conferidos, porque
  precisam de um navegador ou de um componente: é o "fallback" que o spec previa, aplicado só onde precisa.
  - O valor esperado tem de ser um **literal** (número, texto, booleano, `null`, `undefined`, `NaN`, `Infinity`, array ou objeto
    disso). O resto depois de `=>` é prosa e a linha só executa. "É uma expressão válida" não basta:
    `// => Uint8Array [ 213, 7, 88, 140 ]` é um acesso por índice com vírgula.
  - Um `// =>` só vale depois de uma expressão ou de um único `const x = ...`; em qualquer outro comando é um erro.
  - Os nomes do Hyrax estão em escopo (importados do entrypoint certo, a menos que o trecho importe dele), todo outro `import` é
    escrito, e o trecho declara o que usa. Nos guias, `<!-- untested -->` na linha antes de uma cerca a pula.
  - Achado da primeira execução: 36 dos 81 `@example` não eram autossuficientes (variáveis soltas, fragmentos de componente), e o de
    `traceHierarchy` não compilava com literais de objeto (é preciso declarar uma `interface`).
- **CI:** o job `docs` constrói o pacote, confere os exemplos e constrói o site em todo PR. O `docs.yml` publica no GitHub Pages a
  partir do `main`, mas só com o Pages configurado para publicar por GitHub Actions **e** a variável `DOCS_DEPLOY` igual a `true`:
  sem isso o job aparece como *skipped*, e não como falha.

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
| `useInterval(..., { initial, stateless })` | `useInterval(..., { autoStart })` (o `isRunning` é sempre estado) |
| `BlurListener`, `ChildrenRefs`, `useChildrenRefs` | `useClickOutside` / `onClickOutside` |
| `hx(Component)` com props de atalho (`width`...) | `hx(Component)` só dá `rendered` e `transient`; use `style`, ou `hx.<tag>` |
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
6. Habilitar o GitHub Pages (Settings, Pages, Source: *GitHub Actions*) e criar a variável de repositório `DOCS_DEPLOY` igual a
   `true`. O site é construído e checado em todo PR, mas só é publicado depois disso.
7. Na Fase 6, junto com o primeiro `publish`: tirar o aviso "Not published yet" do *Getting started* e a nota de *Status* do
   README, e pôr o selo do npm no README.
