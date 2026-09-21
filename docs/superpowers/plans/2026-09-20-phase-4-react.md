# Hyrax Fase 4 (`/react`): plano de implementação

Spec: `docs/superpowers/specs/2026-09-18-hyrax-revival-design.md` (seção 5, com o `/react` detalhado em 2026-09-20). Fases anteriores: `docs/superpowers/plans/2026-09-18-phase-0-foundation.md`, `2026-09-19-phase-1-core-pure-functions.md`, `2026-09-19-phase-2-core-classes.md` e `2026-09-19-phase-3-dom.md`.

**Objetivo.** Implementar o entrypoint `@gabreusi/hyrax/react`: `useEventListener`, `useClickOutside`, `useInterval`, `useForceUpdate`, `hx` e `Portal`. React 18 e 19, seguro em renderização no servidor, sem dependências de runtime (React e React DOM são peers opcionais), com TSDoc completo. `useEventListener` e `useClickOutside` embrulham o `listen` e o `onClickOutside` da Fase 3.

**Arquitetura.** Um arquivo por peça em `src/react/`, mais `internal/refs.ts` (o tipo `RefLike` e `resolveRef`) e `internal/useLatest.ts` (uma ref que guarda o valor do último render). Cada peça tem **três** tipos de teste, como o `/dom`: `nome.test.tsx` (`happy-dom` e Testing Library), `nome.ssr.test.tsx` (Node puro, `renderToString`) e, onde o `happy-dom` mente, `nome.browser.test.tsx` (Chromium). A Task 1 ajusta a infraestrutura de teste; a Task 10 põe `"use client"`, os orçamentos de tamanho, o smoke test e o CI.

**Fora desta fase:** docs (Fase 5), release (Fase 6).

## Ponto de partida

Parte do `main` com as Fases 0 a 3 mergeadas (PR #27, commit `83c1c49`). Linha de base: `npm run check` com 37 arquivos e 439 testes.

## Todo o plano foi validado antes de ser escrito

Implementei tudo num clone descartável e depois **repeti as tasks deste plano, na ordem, num clone limpo, extraindo os arquivos direto deste documento**: o `npm run check` termina com código 0, com **52 arquivos e 532 testes** (Chromium incluído), cobertura de 100% em linhas e instruções e de 96,8% em funções para `src/react` (o limite é 95%), 0 falhas em 20 execuções dos testes de Node e em 10 dos de navegador, os mesmos testes passam com **React 18** e o código compila com os tipos do React 18. Reintroduzi 13 defeitos e provei que os testes os pegam; **um deles só é pego no Chromium** (a remoção de um listener de captura, Task 8), e uma 14ª mutação que o teste **não** pegou revelou código morto, que saiu (Task 7).

### O que a implementação encontrou (já refletido nos arquivos abaixo)

| Achado | Consequência |
|---|---|
| **O `/react` importa o `/dom`, e o `tsdown` emite um chunk compartilhado** (`onClickOutside-*.js`, ~2 kB) que `dom.js` e `react.js` importam. A raiz continua com 0 imports | Aceito: é a camada de verdade (`/react` é construído sobre `/dom`), e quem usa os dois carrega uma cópia só. O spec e o CONTRIBUTING dizem isso. Importar `@gabreusi/hyrax/dom` por auto-referência seria pior (duas cópias entre ESM e CJS) |
| **`"use client"` só no `/react`.** `outputOptions.banner` recebe o chunk, então `chunk.name === "react"` põe a diretiva em `react.js` e `react.cjs` e em mais nenhum arquivo | Next.js e outros bundlers de Server Components sabem onde está a fronteira do cliente, e a raiz e o `/dom` continuam usáveis num Server Component. O smoke test falha sem a diretiva (provado) |
| **`react/jsx-runtime` já fica externo** (o `tsdown` externaliza os peers e seus subcaminhos) | Nada a configurar |
| **`RefObject` significa coisas diferentes no React 18 e no 19** (`current: T \| null` somente leitura, contra `current: T`). Compilar com `@types/react@18` deu 4 erros em `useLatest` | A API pública usa `RefLike<T>` (`{ readonly current: T \| null }`) e `useLatest` devolve `{ readonly current: T }`. O código compila com os tipos 18 **e** 19, e o CI passa a conferir isso |
| **`forwardRef` com props que têm assinatura de índice perde as props conhecidas** (`PropsWithoutRef` faz um `Omit` que colapsa o índice: `children` vira `unknown`) | A função de render anota o parâmetro (`props: AnyProps`) em vez de deixar o `forwardRef` inferi-lo |
| **O Testing Library só desmonta sozinho com os globais do teste ligados**, e aqui estão desligados | Um `test-setup.ts` registra `afterEach(cleanup)`. Ele importa o Testing Library só se houver `document`: um teste de SSR roda em Node puro, onde importá-lo quebraria |
| **`act(() => vi.advanceTimersByTime(ms))` devolve uma promessa** (o `vi` devolve a si mesmo, então a sobrecarga assíncrona de `act` é escolhida) e o ESLint (`no-floating-promises`) reclama | O callback usa chaves: `act(() => { vi.advanceTimersByTime(ms); })` |
| **No Vitest em modo navegador, a primeira execução depois de acrescentar testes de React falhou uma vez** com `Cannot read properties of null (reading 'useState')` (duas cópias do React: o Vite descobriu dependências no meio da execução e recarregou a página). **Não consegui reproduzir de novo**, nem com o cache apagado | `optimizeDeps.include` lista `react`, `react-dom`, `react/jsx-dev-runtime`, `react-dom/client` e `@testing-library/react` de antemão, que é o que a documentação do Vitest recomenda. 5 execuções seguidas com o cache frio e 10 do laço de estabilidade passam. Uma precaução, não uma correção provada |
| **O `happy-dom` remove um listener de captura mesmo quando a remoção esquece a flag** (achado da Fase 3), então o teste que impede o bug do `useHTMLEventListener` legado passa lá sem provar nada | O teste vive no Chromium (`useEventListener.browser.test.tsx`) e a mutação foi provada: o projeto `react` **deixa passar**, o `browser` pega |
| **O `Portal` legado lia `document.body` no render**, o que quebra em SSR. Um estado `mounted` posto por um efeito funcionaria, mas custa um render a mais no cliente | `useSyncExternalStore(subscribe, () => container ?? document.body, () => null)`: no servidor e durante a hidratação o instantâneo é `null` (não renderiza nada) e o cliente renderiza logo depois, sem divergência (teste de hidratação com `hydrateRoot`). Num app só de cliente, renderiza já no primeiro render. Provado: se o instantâneo do servidor lê `document`, 4 testes falham |
| **O `hx` legado dava aos componentes embrulhados (`hx(Component)`) tipos sem atalhos, mas o runtime consumia os nomes dos atalhos assim mesmo**: um componente com a própria prop `width` nunca a recebia | `hx(Component)` só dá `rendered` e `transient`, sem atalhos. Regressão coberta |
| **Os atalhos que são atributos nativos** (`<hx.canvas width>`: o canvas é dimensionado pelo atributo, não pelo CSS) | Uma tabela `nativeAttributes` lida pelos tipos (`Omit<Shortcuts, NativeKeys<T>>`) e pelo runtime, então não podem discordar. A consulta usa `Object.hasOwn`: sem ele, uma tag `toString` acha a função herdada e o `includes` lança (provado) |
| **A mutação "passar `ref: null` só quando há ref" não foi pega por nenhum teste**: o React não avisa por uma ref `null`, nem no 18 | Era código morto (um ramo que não faz nada observável). Saiu, e ficou um teste que garante que não há aviso quando ninguém passou ref (roda no CI do React 18) |
| **A ordem do `style` que sai do `hx` segue a lista de atalhos**, e não a ordem dos props | Só importa para quem compara a string: o teste de SSR usa a ordem da lista (`padding` antes de `display`) |
| **Sob o StrictMode, `immediate` com `autoStart` chama o handler duas vezes ao montar** (medido: `start()` chama uma; `autoStart` chama duas). É o efeito duplo do React em desenvolvimento | Documentado no TSDoc e no spec, sem tentar disfarçar |
| **O smoke test não conseguia type-checar `/react`**: sem `@types/react` no diretório de consumo, o `.d.ts` não resolve `react` | O smoke instala `@types/react` e `@types/react-dom`, e `HYRAX_SMOKE_REACT=18` troca tudo pelas versões 18 |
| **O Vitest engole o `console.log` no `happy-dom`** (achado da Fase 3, de novo) | Para sondar comportamento, grave num arquivo (`appendFileSync`) |

### Decisões de implementação (o desenho está no spec; estas são as do código)

1. **`useEventListener` lê uma ref quando o efeito roda**, depois do primeiro render. Um elemento renderizado condicionalmente escapa; a saída documentada é guardar o elemento em estado com uma ref de função (testado). No servidor, `globalThis.window` é `undefined` e o hook o ignora (testado); nomear `window` lançaria `ReferenceError`.
2. **Uma ref é distinguida de um alvo por `addEventListener`, não por `current`**: uma página pode definir uma global `current`, e o `window` pareceria uma ref.
3. **As `options` do `useEventListener` são desmontadas** em `capture`, `once`, `passive` e `signal`, para um objeto novo a cada render não reinscrever.
4. **`useClickOutside` lê as refs a cada toque**, então achar um elemento que aparece depois não exige reinscrever; só `event`, `capture` e `requireInsideFirst` reinscrevem. "Dentro" é decidido pelo DOM: o conteúdo de um `Portal` deve ser listado (testado no Chromium).
5. **`useInterval`:** `autoStart` é `false` por padrão (o `initial` do legado); `isRunning` é estado de verdade e o temporizador é um efeito dele e do `delay`; `immediate` é um efeito à parte, para trocar o `delay` (um reinício) não ser um começo; `start` e `stop` são estáveis. Sem `delay: null` (para pausar, `stop()`).
6. **`useForceUpdate`** é `useState` mais `useCallback`: `useReducer` daria uma função com outro tipo no React 18 e no 19.
7. **`Portal`:** `container` `undefined` é `document.body`, e `null` é "ainda não pronto" (não renderiza nada), para o elemento poder vir de um estado. Com `disabled` os filhos saem no lugar, também no servidor.
8. **`hx`:** o mesmo `Proxy` do legado, agora sem `React.memo`, com `forwardRef` e `displayName` (`hx.div`, `hx(Card)`), ignorando chaves `symbol`, com `children` nas props (não como terceiro argumento do `createElement`) e o `/* @__PURE__ */` no `new Proxy` para um `hx` não usado sair do bundle.
9. **Tipos públicos novos:** `RefLike`, `MaybeRef`, `ClickOutsideRefs`, `UseClickOutsideOptions`, `UseIntervalOptions`, `UseIntervalResult`, `PortalProps`, `HxProps`, `HxExtraProps`, `HxShortcutKey` e `HxType`.
10. **Um projeto de navegador só.** O projeto `dom-browser` vira `browser` e cobre `src/dom/**/*.browser.test.ts` e `src/react/**/*.browser.test.tsx`; `npm run test:browser` continua igual.

### Como executar

Executadas na ordem. As Tasks 2 a 7 (uma por peça) são independentes entre si depois da Task 1 (a Task 3 cria os dois arquivos internos que a 4 e a 5 usam, então a 4 e a 5 vêm depois dela), a Task 8 depende da 3 e da 4 (e da 6), a Task 9 (o barrel) depende de todas e a Task 10 fecha. Os blocos de arquivo usam cercas de quatro crases porque o TSDoc contém blocos de três. **A primeira linha de cada bloco é o caminho do arquivo (`// src/...`) e não faz parte dele**; o resto é o conteúdo exato. Para sobrescrever um arquivo existente, leia-o antes. **Nunca use `git checkout -- .` para "limpar" a árvore durante o plano** (reverte edições ainda não commitadas) **nem `pkill -f`** (casa com a própria linha de comando do shell). Use `timeout` em todo `vitest run`. Depois de escrever os arquivos de uma task, rode `npx prettier --write src/react` antes de commitar: os arquivos abaixo já estão formatados, e isto é só uma rede de segurança.

---

## Task 1: Branch, linha de base e a infraestrutura de teste do `/react`

**Files:** modificar `vitest.config.ts` e `package.json`; criar `src/react/test-setup.ts`.

- [ ] **Step 1: Entrar na branch e conferir a linha de base.**

```bash
cd /home/gabriel/Desktop/hyrax
git switch phase-4-react   # já contém este plano; em um clone novo: git switch main && git pull --ff-only origin main && git switch -c phase-4-react
npm ci
npx playwright install chromium
npm run check
```

Esperado: código 0 (linha de base da Fase 3: 37 arquivos, 439 testes).

- [ ] **Step 2: Criar o arquivo de setup dos testes de React.**

````ts
// src/react/test-setup.ts
import { afterEach } from "vitest";

// Testing Library only unmounts by itself when the test globals are on; here they are off.
// A server-render test runs in plain Node, where there is no document and nothing to clean up.
if (typeof document !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(cleanup);
}
````

- [ ] **Step 3: Substituir o `vitest.config.ts`.** O projeto de navegador passa a se chamar `browser` e a incluir os testes de React, os dois projetos de React usam o setup, o limite de cobertura de 95% passa a valer para `src/react`, e o `test-setup.ts` sai da cobertura.

````ts
// vitest.config.ts
import { playwright } from "@vitest/browser-playwright";
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
          exclude: ["src/dom/**/*.browser.test.ts"],
        },
      },
      {
        // Layout, Shadow DOM and real pointer events need a real browser: happy-dom does not resolve
        // `%`, `dvh` or `calc()`, does not retarget events that come out of a shadow tree, and
        // removes a capture listener even when the removal forgets the capture flag.
        extends: true,
        test: {
          name: "browser",
          include: ["src/dom/**/*.browser.test.ts", "src/react/**/*.browser.test.tsx"],
          setupFiles: ["./src/react/test-setup.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            screenshotFailures: false,
          },
        },
        // Listed up front: when Vite finds a dependency in the middle of a run it reloads the page,
        // and a test can then end up with two copies of React ("reading 'useState'").
        optimizeDeps: {
          include: [
            "react",
            "react/jsx-dev-runtime",
            "react-dom",
            "react-dom/client",
            "@testing-library/react",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "react",
          environment: "happy-dom",
          include: ["src/react/**/*.test.{ts,tsx}"],
          exclude: ["src/react/**/*.browser.test.tsx"],
          setupFiles: ["./src/react/test-setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "**/*.d.ts", "**/test-setup.ts"],
      thresholds: {
        "src/core/**": { statements: 95, branches: 95, functions: 95, lines: 95 },
        "src/dom/**": { statements: 95, branches: 95, functions: 95, lines: 95 },
        "src/react/**": { statements: 95, branches: 95, functions: 95, lines: 95 },
      },
    },
  },
});
````

- [ ] **Step 4: Renomear o script do navegador.**

```bash
npm pkg set scripts.test:browser="vitest run --project browser"
grep -rn "dom-browser" . --include='*' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs --exclude-dir=coverage --exclude-dir=dist -l
```

Esperado: o `grep` não lista nada (o nome antigo não aparece mais fora de `docs/`).

- [ ] **Step 5: Conferir que os dois projetos ainda rodam.**

```bash
timeout 120 npx vitest run --project react --project browser
```

Esperado: 6 arquivos, 28 testes passando (os 5 do `/dom` em Chromium mais o `index.test.ts` do `/react`).

- [ ] **Step 6: Commit.**

```bash
git add vitest.config.ts package.json src/react/test-setup.ts
git commit -m "test: run the React tests with cleanup, cover src/react and share one browser project" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `useForceUpdate`

**Files:** criar `src/react/useForceUpdate.test.tsx`, `src/react/useForceUpdate.ssr.test.tsx` e `src/react/useForceUpdate.ts`.

- [ ] **Step 1: Escrever os testes primeiro.** O primeiro prova que a função não muda entre renders, o segundo que cada chamada renderiza de novo, o terceiro que a tela acompanha um valor que mudou fora do estado do React. O teste de SSR renderiza o componente com `renderToString`, sem DOM.

````tsx
// src/react/useForceUpdate.test.tsx
import { act, render, renderHook, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { useForceUpdate } from "./useForceUpdate";

describe("useForceUpdate", () => {
  it("returns a function that never changes", () => {
    const { result, rerender } = renderHook(() => useForceUpdate());
    const first = result.current;
    rerender();
    act(() => first());
    expect(result.current).toBe(first);
  });

  it("renders the component again every time it is called", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useForceUpdate();
    });
    expect(renders).toBe(1);
    act(() => result.current());
    expect(renders).toBe(2);
    act(() => result.current());
    expect(renders).toBe(3);
  });

  it("shows a value that changed outside React state", () => {
    function Counter() {
      const forceUpdate = useForceUpdate();
      const clicks = useRef(0);
      return (
        <button
          onClick={() => {
            clicks.current += 1;
            forceUpdate();
          }}
        >
          clicks: {clicks.current}
        </button>
      );
    }
    render(<Counter />);
    expect(screen.getByRole("button").textContent).toBe("clicks: 0");
    act(() => screen.getByRole("button").click());
    expect(screen.getByRole("button").textContent).toBe("clicks: 1");
  });
});
````

````tsx
// src/react/useForceUpdate.ssr.test.tsx
// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useForceUpdate } from "./useForceUpdate";

describe("useForceUpdate on the server", () => {
  it("renders without a DOM", () => {
    function Page() {
      useForceUpdate();
      return <p>ready</p>;
    }
    expect(typeof document).toBe("undefined");
    expect(renderToString(<Page />)).toBe("<p>ready</p>");
  });
});
````

- [ ] **Step 2: Rodar e ver falhar (RED).**

```bash
timeout 90 npx vitest run --project react useForceUpdate
```

Esperado: 2 arquivos falham com `Failed to resolve import "./useForceUpdate"` (e `Cannot find module` no de SSR).

- [ ] **Step 3: Implementar.** Um `useState` e um `useCallback` sem dependências: a função é a mesma em todo render.

````ts
// src/react/useForceUpdate.ts
import { useCallback, useState } from "react";

/**
 * Returns a function that renders the component again, for the times the screen must follow
 * something that is not React state: a mutable ref, an external store, a plain object.
 *
 * @example
 * ```tsx
 * function Clicks() {
 *   const forceUpdate = useForceUpdate();
 *   const count = useRef(0);
 *   return <button onClick={() => { count.current += 1; forceUpdate(); }}>{count.current}</button>;
 * }
 * ```
 *
 * @returns A function that never changes between renders, so it is safe in a dependency array.
 */
export function useForceUpdate(): () => void {
  const [, setTick] = useState(0);
  return useCallback(() => setTick((tick) => tick + 1), []);
}
````

- [ ] **Step 4: Rodar (GREEN), o lint e o type-check.**

```bash
timeout 90 npx vitest run --project react useForceUpdate
npx eslint src/react && npx tsc -p tsconfig.react.json && npx tsc -p tsconfig.test.json
```

Esperado: 2 arquivos, 4 testes passando; lint e `tsc` sem saída.

- [ ] **Step 5: Commit.**

```bash
git add src/react/useForceUpdate.ts src/react/useForceUpdate.test.tsx src/react/useForceUpdate.ssr.test.tsx
git commit -m "feat: add useForceUpdate, a stable function that renders the component again" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `useEventListener` e os dois arquivos internos

**Files:** criar `src/react/internal/refs.ts`, `src/react/internal/useLatest.ts`, `src/react/useEventListener.test.tsx`, `src/react/useEventListener.ssr.test.tsx` e `src/react/useEventListener.ts`.

- [ ] **Step 1: Escrever os testes primeiro.** Cobrem `window`, `document`, elemento direto, ref, elemento guardado em estado, alvo nulo, o handler mais novo sem reinscrever (conta as chamadas de `addEventListener`), opções que são um objeto novo com o mesmo conteúdo, troca do tipo do evento, desmontagem, `once`, a flag de captura como booleano e o StrictMode (o saldo de adições menos remoções tem de ser 1 e o handler roda uma vez por evento). O de SSR usa `globalThis.window` e `globalThis.document`, que são `undefined` no servidor.

````tsx
// src/react/useEventListener.test.tsx
import { act, render, renderHook, screen } from "@testing-library/react";
import { StrictMode, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEventListener } from "./useEventListener";

afterEach(() => vi.restoreAllMocks());

const ping = (target: EventTarget, type = "hyrax:ping") =>
  act(() => {
    target.dispatchEvent(new Event(type));
  });

describe("useEventListener", () => {
  it("listens on the window", () => {
    const handler = vi.fn();
    renderHook(() => useEventListener(window, "hyrax:ping" as "resize", handler));
    ping(window);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("listens on the document", () => {
    const handler = vi.fn();
    renderHook(() => useEventListener(document, "visibilitychange", handler));
    ping(document, "visibilitychange");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("listens on an element, given directly", () => {
    const button = document.createElement("button");
    const handler = vi.fn();
    renderHook(() => useEventListener(button, "click", handler));
    act(() => button.click());
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("listens on the element a ref points to", () => {
    const handler = vi.fn();
    function Box() {
      const ref = useRef<HTMLDivElement>(null);
      useEventListener(ref, "click", handler);
      return <div ref={ref}>box</div>;
    }
    render(<Box />);
    act(() => screen.getByText("box").click());
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("listens on an element that arrives later, when it is kept in state", () => {
    const handler = vi.fn();
    function Late() {
      const [node, setNode] = useState<HTMLDivElement | null>(null);
      useEventListener(node, "click", handler);
      return <div ref={setNode}>late</div>;
    }
    render(<Late />);
    act(() => screen.getByText("late").click());
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does nothing while the target is null or undefined", () => {
    const add = vi.spyOn(window, "addEventListener");
    const empty = { current: null };
    expect(() => {
      renderHook(() => useEventListener(null, "click", vi.fn()));
      renderHook(() => useEventListener(undefined, "click", vi.fn()));
      renderHook(() => useEventListener(empty, "click", vi.fn()));
    }).not.toThrow();
    expect(add).not.toHaveBeenCalled();
  });

  it("calls the latest handler without listening again", () => {
    const add = vi.spyOn(window, "addEventListener");
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ handler }) => useEventListener(window, "hyrax:ping" as "resize", handler),
      { initialProps: { handler: first } },
    );
    rerender({ handler: second });
    ping(window);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(add.mock.calls.filter(([type]) => type === "hyrax:ping")).toHaveLength(1);
  });

  it("does not listen again when the options are a new object with the same content", () => {
    const add = vi.spyOn(window, "addEventListener");
    const { rerender } = renderHook(() =>
      useEventListener(window, "hyrax:ping" as "resize", vi.fn(), { passive: true }),
    );
    rerender();
    rerender();
    expect(add.mock.calls.filter(([type]) => type === "hyrax:ping")).toHaveLength(1);
  });

  it("listens again when the event type changes", () => {
    const handler = vi.fn();
    const { rerender } = renderHook(
      ({ type }) => useEventListener(window, type as "resize", handler),
      { initialProps: { type: "hyrax:a" } },
    );
    rerender({ type: "hyrax:b" });
    ping(window, "hyrax:a");
    expect(handler).not.toHaveBeenCalled();
    ping(window, "hyrax:b");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("stops listening when the component unmounts", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useEventListener(window, "hyrax:ping" as "resize", handler),
    );
    unmount();
    ping(window);
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes the options through", () => {
    const handler = vi.fn();
    renderHook(() => useEventListener(window, "hyrax:ping" as "resize", handler, { once: true }));
    ping(window);
    ping(window);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("accepts a capture flag as a boolean", () => {
    const add = vi.spyOn(window, "addEventListener");
    renderHook(() => useEventListener(window, "hyrax:ping" as "resize", vi.fn(), true));
    const call = add.mock.calls.find(([type]) => type === "hyrax:ping");
    expect(call?.[2]).toMatchObject({ capture: true });
  });

  it("ends a StrictMode render with exactly one listener and one call per event", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const handler = vi.fn();
    renderHook(() => useEventListener(window, "hyrax:ping" as "resize", handler), {
      wrapper: StrictMode,
    });
    const added = add.mock.calls.filter(([type]) => type === "hyrax:ping").length;
    const removed = remove.mock.calls.filter(([type]) => type === "hyrax:ping").length;
    expect(added - removed).toBe(1);
    ping(window);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
````

````tsx
// src/react/useEventListener.ssr.test.tsx
// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useEventListener } from "./useEventListener";

describe("useEventListener on the server", () => {
  it("renders without a DOM, and globalThis.window is a target that is simply ignored", () => {
    function Page() {
      useEventListener(globalThis.window, "resize", () => {});
      useEventListener(globalThis.document, "click", () => {});
      return <p>ready</p>;
    }
    expect(typeof window).toBe("undefined");
    expect(renderToString(<Page />)).toBe("<p>ready</p>");
  });
});
````

- [ ] **Step 2: Rodar e ver falhar (RED).**

```bash
timeout 90 npx vitest run --project react useEventListener
```

Esperado: 2 arquivos falham com `Failed to resolve import "./useEventListener"`.

- [ ] **Step 3: Criar os arquivos internos.** `RefLike` e `resolveRef` (a ref é reconhecida por **não** ter `addEventListener`) e `useLatest` (uma ref atualizada em um efeito de layout, ou em um efeito comum no servidor, onde o React 18 avisa sobre `useLayoutEffect`). Estão em `internal/`, então não exigem TSDoc com `@example`.

````ts
// src/react/internal/refs.ts
/**
 * Anything with a `current` that is either the thing or `null`: what `useRef` returns, in React 18
 * and 19. Read-only on purpose, so both `RefObject` and `MutableRefObject` fit.
 */
export interface RefLike<T> {
  readonly current: T | null;
}

/** A thing, a ref to it, or nothing yet. */
export type MaybeRef<T> = T | RefLike<T> | null | undefined;

/**
 * The thing itself: a ref is read, anything else passes through. A ref is told apart from an event
 * target by `addEventListener` and not by `current`, because a page can define a global called
 * `current`, and `window` would then look like a ref.
 */
export function resolveRef<T extends object>(value: MaybeRef<T>): T | null {
  if (value == null) return null;
  return "addEventListener" in value ? (value as T) : (value as RefLike<T>).current;
}
````

````ts
// src/react/internal/useLatest.ts
import { useEffect, useLayoutEffect, useRef } from "react";

// React 18 warns about `useLayoutEffect` during a server render, and effects never run there anyway.
const useIsomorphicLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

/**
 * A ref that always holds the value of the latest render. Read it from an event handler or a timer
 * to get the newest callback without listing it as a dependency (which would listen again). The
 * return type is spelled out because `RefObject` means different things in React 18 and 19.
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useIsomorphicLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
````

- [ ] **Step 4: Implementar o hook.** Quatro sobrecargas (janela, documento, elemento e qualquer `EventTarget`), cada uma com o próprio TSDoc, porque o editor mostra a documentação da assinatura que casou.

````ts
// src/react/useEventListener.ts
import { useEffect } from "react";
import { listen } from "../dom/listen";
import type { ListenOptions } from "../dom/listen";
import { resolveRef } from "./internal/refs";
import type { MaybeRef } from "./internal/refs";
import { useLatest } from "./internal/useLatest";

/**
 * Listens to an event on the window for as long as the component is mounted.
 *
 * The handler is read from the latest render, so it can use fresh props and state without a
 * dependency array and without listening again. Changing `type`, the target or an option does
 * listen again.
 *
 * @example
 * ```tsx
 * useEventListener(window, "resize", () => setWidth(window.innerWidth));
 * ```
 *
 * @param target - The window, a ref to it, or `null`/`undefined` (nothing is listened to). On the
 * server `window` does not exist: pass `globalThis.window`, which is `undefined` there.
 * @param type - The event name.
 * @param handler - Called with the event.
 * @param options - A capture flag or `addEventListener` options. A new object every render is fine.
 */
export function useEventListener<K extends keyof WindowEventMap>(
  target: MaybeRef<Window>,
  type: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: ListenOptions,
): void;
/**
 * Listens to an event on the document for as long as the component is mounted.
 *
 * @example
 * ```tsx
 * useEventListener(document, "visibilitychange", () => setHidden(document.hidden));
 * ```
 *
 * @param target - The document, a ref to it, or `null`/`undefined`. On the server pass
 * `globalThis.document`.
 * @param type - The event name.
 * @param handler - Called with the event.
 * @param options - A capture flag or `addEventListener` options.
 */
export function useEventListener<K extends keyof DocumentEventMap>(
  target: MaybeRef<Document>,
  type: K,
  handler: (event: DocumentEventMap[K]) => void,
  options?: ListenOptions,
): void;
/**
 * Listens to an event on an element for as long as the component is mounted.
 *
 * A ref is read when the effect runs, after the first render. An element that is rendered
 * conditionally, and so appears later, is missed by a ref: keep it in state with a callback ref
 * (`<div ref={setNode}>`) and pass the state instead.
 *
 * @example
 * ```tsx
 * const button = useRef<HTMLButtonElement>(null);
 * useEventListener(button, "click", (event) => console.log(event.clientX));
 * ```
 *
 * @param target - The element, a ref to it, or `null`/`undefined`.
 * @param type - The event name.
 * @param handler - Called with the event.
 * @param options - A capture flag or `addEventListener` options.
 */
export function useEventListener<K extends keyof HTMLElementEventMap>(
  target: MaybeRef<HTMLElement>,
  type: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  options?: ListenOptions,
): void;
/**
 * Listens to an event on any `EventTarget` (an SVG element, an `EventSource`, your own bus).
 *
 * @example
 * ```tsx
 * useEventListener(bus, "message", (event) => console.log(event));
 * ```
 *
 * @param target - The target, a ref to it, or `null`/`undefined`.
 * @param type - The event name.
 * @param handler - Called with the event.
 * @param options - A capture flag or `addEventListener` options.
 */
export function useEventListener(
  target: MaybeRef<EventTarget>,
  type: string,
  handler: (event: Event) => void,
  options?: ListenOptions,
): void;
export function useEventListener(
  target: MaybeRef<EventTarget>,
  type: string,
  handler: (event: never) => void,
  options?: ListenOptions,
): void {
  const latest = useLatest(handler as (event: Event) => void);
  // The options are taken apart so that a new object with the same content does not listen again.
  const { capture, once, passive, signal } =
    typeof options === "boolean" ? { capture: options } : (options ?? {});

  useEffect(
    () =>
      listen(resolveRef(target), type, (event) => latest.current(event), {
        capture,
        once,
        passive,
        signal,
      }),
    [target, type, capture, once, passive, signal, latest],
  );
}
````

- [ ] **Step 5: Rodar (GREEN), o lint e o type-check.**

```bash
timeout 90 npx vitest run --project react useEventListener
npx eslint src/react && npx tsc -p tsconfig.react.json && npx tsc -p tsconfig.test.json
```

Esperado: 2 arquivos, 14 testes passando; lint e `tsc` sem saída.

- [ ] **Step 6: Commit.**

```bash
git add src/react/internal src/react/useEventListener.ts src/react/useEventListener.test.tsx src/react/useEventListener.ssr.test.tsx
git commit -m "feat: add useEventListener, which keeps the latest handler without listening again" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `useClickOutside`

**Files:** criar `src/react/useClickOutside.test.tsx`, `src/react/useClickOutside.ssr.test.tsx` e `src/react/useClickOutside.ts`.

- [ ] **Step 1: Escrever os testes primeiro.** Cobrem um toque fora e dentro de uma ref, uma lista de refs, elementos misturados com refs (e `null`/`undefined`), `ignore`, uma ref que só é preenchida depois do primeiro render, uma ref vazia, o handler e a lista mais novos sem reinscrever, a opção `event`, `requireInsideFirst`, a desmontagem e o StrictMode.

````tsx
// src/react/useClickOutside.test.tsx
import { act, render, renderHook, screen } from "@testing-library/react";
import { StrictMode, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useClickOutside } from "./useClickOutside";

afterEach(() => vi.restoreAllMocks());

const press = (target: Element, type = "pointerdown") =>
  act(() => {
    target.dispatchEvent(new Event(type, { bubbles: true, composed: true }));
  });

/** A popup with an outside area, the way an app would use the hook. */
function Popup({ handler, ignore = false }: { handler: (event: Event) => void; ignore?: boolean }) {
  const popup = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  useClickOutside(popup, handler, ignore ? { ignore: opener } : undefined);
  return (
    <div>
      <button ref={opener}>open</button>
      <div ref={popup}>
        <span>inside</span>
      </div>
      <p>outside</p>
    </div>
  );
}

describe("useClickOutside", () => {
  it("calls the handler, with the event, for a press outside the ref", () => {
    const handler = vi.fn();
    render(<Popup handler={handler} />);
    press(screen.getByText("outside"));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toBeInstanceOf(Event);
  });

  it("does not call it for a press inside, however deep", () => {
    const handler = vi.fn();
    render(<Popup handler={handler} />);
    press(screen.getByText("inside"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("counts every ref of a list as inside", () => {
    const handler = vi.fn();
    function Two() {
      const a = useRef<HTMLDivElement>(null);
      const b = useRef<HTMLDivElement>(null);
      useClickOutside([a, b], handler);
      return (
        <>
          <div ref={a}>a</div>
          <div ref={b}>b</div>
          <p>out</p>
        </>
      );
    }
    render(<Two />);
    press(screen.getByText("a"));
    press(screen.getByText("b"));
    expect(handler).not.toHaveBeenCalled();
    press(screen.getByText("out"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("accepts an element, and mixes elements with refs", () => {
    const handler = vi.fn();
    const box = document.createElement("div");
    document.body.append(box);
    const ref = { current: null };
    renderHook(() => useClickOutside([box, ref, null, undefined], handler));
    press(box);
    expect(handler).not.toHaveBeenCalled();
    press(document.body);
    expect(handler).toHaveBeenCalledTimes(1);
    box.remove();
  });

  it("treats the elements in `ignore` as inside", () => {
    const handler = vi.fn();
    render(<Popup handler={handler} ignore />);
    press(screen.getByText("open"));
    expect(handler).not.toHaveBeenCalled();
    press(screen.getByText("outside"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("finds a ref that is only set after the first render", () => {
    const handler = vi.fn();
    function Late() {
      const [shown, setShown] = useState(false);
      const box = useRef<HTMLDivElement>(null);
      useClickOutside(box, handler);
      return (
        <>
          <button onClick={() => setShown(true)}>show</button>
          {shown && <div ref={box}>late</div>}
        </>
      );
    }
    render(<Late />);
    act(() => screen.getByText("show").click());
    press(screen.getByText("late"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("treats a ref that is empty as nothing inside", () => {
    const handler = vi.fn();
    renderHook(() => useClickOutside({ current: null }, handler));
    press(document.body);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("calls the latest handler without listening again", () => {
    const add = vi.spyOn(document, "addEventListener");
    const first = vi.fn();
    const second = vi.fn();
    const box = { current: null };
    const { rerender } = renderHook(
      ({ handler }) => useClickOutside(box, handler, { ignore: [] }),
      {
        initialProps: { handler: first },
      },
    );
    rerender({ handler: second });
    rerender({ handler: second });
    press(document.body);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(add.mock.calls.filter(([type]) => type === "pointerdown")).toHaveLength(1);
  });

  it("reads the latest targets, so a new list needs no new listener", () => {
    const handler = vi.fn();
    const a = document.createElement("div");
    const b = document.createElement("div");
    document.body.append(a, b);
    const { rerender } = renderHook(({ list }) => useClickOutside(list, handler), {
      initialProps: { list: [a] as Element[] },
    });
    rerender({ list: [b] });
    press(b);
    expect(handler).not.toHaveBeenCalled();
    press(a);
    expect(handler).toHaveBeenCalledTimes(1);
    a.remove();
    b.remove();
  });

  it("listens to the event named in the options", () => {
    const handler = vi.fn();
    renderHook(() => useClickOutside(null, handler, { event: "click" }));
    press(document.body, "pointerdown");
    expect(handler).not.toHaveBeenCalled();
    press(document.body, "click");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("only calls the handler after a press inside when requireInsideFirst is on", () => {
    const handler = vi.fn();
    const box = document.createElement("div");
    document.body.append(box);
    renderHook(() => useClickOutside(box, handler, { requireInsideFirst: true }));
    press(document.body);
    expect(handler).not.toHaveBeenCalled();
    press(box);
    press(document.body);
    expect(handler).toHaveBeenCalledTimes(1);
    box.remove();
  });

  it("stops listening when the component unmounts", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useClickOutside(null, handler));
    unmount();
    press(document.body);
    expect(handler).not.toHaveBeenCalled();
  });

  it("ends a StrictMode render with exactly one listener and one call per press", () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const handler = vi.fn();
    renderHook(() => useClickOutside(null, handler), { wrapper: StrictMode });
    const added = add.mock.calls.filter(([type]) => type === "pointerdown").length;
    const removed = remove.mock.calls.filter(([type]) => type === "pointerdown").length;
    expect(added - removed).toBe(1);
    press(document.body);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
````

````tsx
// src/react/useClickOutside.ssr.test.tsx
// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useClickOutside } from "./useClickOutside";

describe("useClickOutside on the server", () => {
  it("renders without a DOM", () => {
    function Page() {
      useClickOutside({ current: null }, () => {});
      return <p>ready</p>;
    }
    expect(typeof document).toBe("undefined");
    expect(renderToString(<Page />)).toBe("<p>ready</p>");
  });
});
````

- [ ] **Step 2: Rodar e ver falhar (RED).**

```bash
timeout 90 npx vitest run --project react useClickOutside
```

Esperado: 2 arquivos falham com `Failed to resolve import "./useClickOutside"`.

- [ ] **Step 3: Implementar.** Um `useEffect` que chama o `onClickOutside` com **funções** como alvos, que leem as refs mais novas a cada toque; as dependências são só `event`, `capture` e `requireInsideFirst` (mais as refs estáveis do `useLatest`).

````ts
// src/react/useClickOutside.ts
import { useEffect } from "react";
import { onClickOutside } from "../dom/onClickOutside";
import type { ClickOutsideOptions } from "../dom/onClickOutside";
import { resolveRef } from "./internal/refs";
import type { MaybeRef } from "./internal/refs";
import { useLatest } from "./internal/useLatest";

/** What counts as inside: a ref, an element, or a list mixing both. Empty refs are skipped. */
export type ClickOutsideRefs = MaybeRef<Element> | readonly MaybeRef<Element>[];

/** Options for {@link useClickOutside}: those of `onClickOutside`, with refs allowed in `ignore`. */
export interface UseClickOutsideOptions<
  K extends keyof DocumentEventMap = "pointerdown",
> extends Omit<ClickOutsideOptions<K>, "ignore"> {
  /** Refs or elements that count as inside, such as the button that opens the popup. */
  ignore?: ClickOutsideRefs;
}

function elements(refs: ClickOutsideRefs): (Element | null)[] {
  const list = Array.isArray(refs)
    ? (refs as readonly MaybeRef<Element>[])
    : [refs as MaybeRef<Element>];
  return list.map((ref) => resolveRef(ref));
}

/**
 * Calls `handler` when the user presses outside of `refs`, for as long as the component is
 * mounted: to close a popup, a menu or a dialog.
 *
 * Refs are read at the moment of each press, so an element that is rendered later is found, and
 * `refs`, `ignore` and `handler` may be new on every render without listening again. Only the
 * `event`, `capture` and `requireInsideFirst` options listen again when they change.
 *
 * "Inside" is decided by the DOM, not by the React tree: a `Portal` renders in another place of
 * the page, so list its content in `refs` too, or a press on it counts as outside.
 *
 * @example
 * ```tsx
 * const popup = useRef<HTMLDivElement>(null);
 * const opener = useRef<HTMLButtonElement>(null);
 * useClickOutside(popup, () => setOpen(false), { ignore: opener });
 * ```
 *
 * @param refs - What counts as inside: a ref, an element, or a list of them.
 * @param handler - Called with the event for every press outside.
 * @param options - The event, the capture phase, elements to ignore, and `requireInsideFirst`.
 */
export function useClickOutside<K extends keyof DocumentEventMap = "pointerdown">(
  refs: ClickOutsideRefs,
  handler: (event: DocumentEventMap[K]) => void,
  options: UseClickOutsideOptions<K> = {},
): void {
  const { event, capture, requireInsideFirst } = options;
  const latestRefs = useLatest(refs);
  const latestIgnore = useLatest(options.ignore);
  const latestHandler = useLatest(handler);

  useEffect(
    () =>
      onClickOutside(
        () => elements(latestRefs.current),
        (pressed) => latestHandler.current(pressed),
        { event, capture, requireInsideFirst, ignore: () => elements(latestIgnore.current) },
      ),
    [event, capture, requireInsideFirst, latestRefs, latestIgnore, latestHandler],
  );
}
````

- [ ] **Step 4: Rodar (GREEN), o lint e o type-check.**

```bash
timeout 90 npx vitest run --project react useClickOutside
npx eslint src/react && npx tsc -p tsconfig.react.json && npx tsc -p tsconfig.test.json
```

Esperado: 2 arquivos, 14 testes passando; lint e `tsc` sem saída.

- [ ] **Step 5: Commit.**

```bash
git add src/react/useClickOutside.ts src/react/useClickOutside.test.tsx src/react/useClickOutside.ssr.test.tsx
git commit -m "feat: add useClickOutside, built on onClickOutside and reading refs at each press" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `useInterval`

**Files:** criar `src/react/useInterval.test.tsx`, `src/react/useInterval.ssr.test.tsx` e `src/react/useInterval.ts`.

- [ ] **Step 1: Escrever os testes primeiro.** Com relógio falso. Cobrem esperar por `start()`, rodar a cada `delay` entre `start()` e `stop()`, `autoStart`, `immediate` (e que não repete quando só o `delay` muda), reiniciar com o novo `delay` (a fase do temporizador recomeça), não criar temporizador ao trocar o `delay` parado, o handler mais novo sem reiniciar (conta as chamadas de `setInterval`), `start`/`stop` estáveis e um segundo `start()` sem segundo temporizador, o handler que se interrompe sozinho, a limpeza ao desmontar e o StrictMode (um temporizador e o ritmo certo). O de SSR confere que nenhum temporizador é criado.

````tsx
// src/react/useInterval.test.tsx
import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInterval } from "./useInterval";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("useInterval", () => {
  it("waits for start() by default", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useInterval(handler, 100));
    tick(500);
    expect(handler).not.toHaveBeenCalled();
    expect(result.current.isRunning).toBe(false);
  });

  it("runs the handler every `delay` between start() and stop()", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useInterval(handler, 100));
    act(() => result.current.start());
    expect(result.current.isRunning).toBe(true);
    tick(350);
    expect(handler).toHaveBeenCalledTimes(3);
    act(() => result.current.stop());
    expect(result.current.isRunning).toBe(false);
    tick(500);
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it("starts by itself with autoStart", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useInterval(handler, 100, { autoStart: true }));
    expect(result.current.isRunning).toBe(true);
    tick(200);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("calls the handler right away when it starts, with `immediate`", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useInterval(handler, 100, { immediate: true }));
    act(() => result.current.start());
    expect(handler).toHaveBeenCalledTimes(1);
    tick(100);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("does not call it right away without `immediate`", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useInterval(handler, 100));
    act(() => result.current.start());
    expect(handler).not.toHaveBeenCalled();
  });

  it("restarts the timer with the new delay when `delay` changes while running", () => {
    const handler = vi.fn();
    const { result, rerender } = renderHook(({ delay }) => useInterval(handler, delay), {
      initialProps: { delay: 1000 },
    });
    act(() => result.current.start());
    tick(500);
    rerender({ delay: 200 });
    tick(199);
    expect(handler).not.toHaveBeenCalled();
    tick(1);
    expect(handler).toHaveBeenCalledTimes(1);
    tick(200);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("does not call an `immediate` handler again just because `delay` changed", () => {
    const handler = vi.fn();
    const { result, rerender } = renderHook(
      ({ delay }) => useInterval(handler, delay, { immediate: true }),
      { initialProps: { delay: 1000 } },
    );
    act(() => result.current.start());
    rerender({ delay: 200 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not start a timer when `delay` changes while stopped", () => {
    const { rerender } = renderHook(({ delay }) => useInterval(vi.fn(), delay), {
      initialProps: { delay: 100 },
    });
    rerender({ delay: 50 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("calls the latest handler without restarting the timer", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ handler }) => useInterval(handler, 100), {
      initialProps: { handler: first },
    });
    act(() => result.current.start());
    rerender({ handler: second });
    tick(100);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps start and stop the same function, and a second start() adds no second timer", () => {
    const { result, rerender } = renderHook(() => useInterval(vi.fn(), 100));
    const { start, stop } = result.current;
    act(() => start());
    act(() => start());
    rerender();
    expect(result.current.start).toBe(start);
    expect(result.current.stop).toBe(stop);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("lets the handler stop the interval", () => {
    const handler = vi.fn(() => stopRef.current());
    const stopRef = { current: () => {} };
    const { result } = renderHook(() => {
      const interval = useInterval(handler, 100, { autoStart: true });
      stopRef.current = interval.stop;
      return interval;
    });
    tick(100);
    expect(result.current.isRunning).toBe(false);
    tick(500);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("clears the timer when the component unmounts", () => {
    const { unmount } = renderHook(() => useInterval(vi.fn(), 100, { autoStart: true }));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps a single timer, and the right rate, in StrictMode", () => {
    const handler = vi.fn();
    renderHook(() => useInterval(handler, 100, { autoStart: true }), { wrapper: StrictMode });
    expect(vi.getTimerCount()).toBe(1);
    tick(300);
    expect(handler).toHaveBeenCalledTimes(3);
  });
});
````

````tsx
// src/react/useInterval.ssr.test.tsx
// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useInterval } from "./useInterval";

describe("useInterval on the server", () => {
  it("renders the initial state and starts no timer", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    function Page() {
      const { isRunning } = useInterval(() => {}, 100, { autoStart: true });
      return <p>{String(isRunning)}</p>;
    }
    expect(renderToString(<Page />)).toBe("<p>true</p>");
    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });
});
````

- [ ] **Step 2: Rodar e ver falhar (RED).**

```bash
timeout 90 npx vitest run --project react useInterval
```

Esperado: 2 arquivos falham com `Failed to resolve import "./useInterval"`.

- [ ] **Step 3: Implementar.** O estado `isRunning` e dois efeitos: o do `immediate` (depende só de `isRunning`) e o do temporizador (depende de `isRunning` e `delay`).

````ts
// src/react/useInterval.ts
import { useCallback, useEffect, useState } from "react";
import { useLatest } from "./internal/useLatest";

/** Options for {@link useInterval}. */
export interface UseIntervalOptions {
  /** Start on mount instead of waiting for `start()`. Defaults to `false`. */
  autoStart?: boolean;
  /** Also call the handler at the moment the interval starts, not only after the first `delay`. */
  immediate?: boolean;
}

/** What {@link useInterval} returns. */
export interface UseIntervalResult {
  /** Starts the interval. Does nothing if it is already running. */
  start: () => void;
  /** Stops the interval. Does nothing if it is not running. */
  stop: () => void;
  /** Whether the interval is running. */
  isRunning: boolean;
}

/**
 * Calls `handler` every `delay` milliseconds while the interval is running, and clears the timer
 * when the component unmounts.
 *
 * The handler is read from the latest render, so it can use fresh props and state and does not
 * restart the timer. Changing `delay` while it runs restarts the timer with the new delay.
 * `start()` and `stop()` never change between renders, and they take effect when React commits the
 * update, not on the same line.
 *
 * In StrictMode, during development, React runs every effect twice on mount, so `immediate` together
 * with `autoStart` calls the handler twice then. `start()` calls it once.
 *
 * @example
 * ```tsx
 * const { start, stop, isRunning } = useInterval(() => setSeconds((s) => s + 1), 1000);
 * return <button onClick={isRunning ? stop : start}>{isRunning ? "Pause" : "Play"}</button>;
 * ```
 *
 * @param handler - Called on every tick.
 * @param delay - The time between ticks, in milliseconds.
 * @param options - `autoStart` and `immediate`.
 * @returns `start`, `stop` and `isRunning`.
 */
export function useInterval(
  handler: () => void,
  delay: number,
  { autoStart = false, immediate = false }: UseIntervalOptions = {},
): UseIntervalResult {
  const [isRunning, setIsRunning] = useState(autoStart);
  const latestHandler = useLatest(handler);
  const latestImmediate = useLatest(immediate);

  // Its own effect, so that changing `delay` (which restarts the timer) is not a new start.
  useEffect(() => {
    if (isRunning && latestImmediate.current) latestHandler.current();
  }, [isRunning, latestHandler, latestImmediate]);

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => latestHandler.current(), delay);
    return () => clearInterval(timer);
  }, [isRunning, delay, latestHandler]);

  const start = useCallback(() => setIsRunning(true), []);
  const stop = useCallback(() => setIsRunning(false), []);
  return { start, stop, isRunning };
}
````

- [ ] **Step 4: Rodar (GREEN), o lint e o type-check.**

```bash
timeout 90 npx vitest run --project react useInterval
npx eslint src/react && npx tsc -p tsconfig.react.json && npx tsc -p tsconfig.test.json
```

Esperado: 2 arquivos, 14 testes passando; lint e `tsc` sem saída.

- [ ] **Step 5: Commit.**

```bash
git add src/react/useInterval.ts src/react/useInterval.test.tsx src/react/useInterval.ssr.test.tsx
git commit -m "feat: add useInterval with start, stop, autoStart and immediate" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `Portal`

**Files:** criar `src/react/Portal.test.tsx`, `src/react/Portal.ssr.test.tsx` e `src/react/Portal.tsx`.

- [ ] **Step 1: Escrever os testes primeiro.** Cobrem o invólucro fixo no `body` com um `id` que começa com `PORTAL`, dois portais com `id` diferentes, o `id` dado, `transient` (sem invólucro), `disabled` (no lugar), `open` virando `true`, `container` dado, `container={null}` (nada, e depois no elemento guardado em estado), a limpeza ao desmontar e uma **hidratação**: o HTML do servidor é `<main></main>`, `hydrateRoot` não gera erro no console e o portal aparece depois. Os de SSR conferem que sem `document` não renderiza nada, que `disabled` sai no lugar e que `open={false}` não renderiza nada.

````tsx
// src/react/Portal.test.tsx
import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Portal } from "./Portal";

afterEach(() => vi.restoreAllMocks());

describe("Portal", () => {
  it("renders its children in the body, inside a fixed wrapper with an id", () => {
    const { container } = render(
      <Portal>
        <span>menu</span>
      </Portal>,
    );
    expect(container.textContent).toBe("");
    const wrapper = screen.getByText("menu").parentElement;
    expect(wrapper?.parentElement).toBe(document.body);
    expect(wrapper?.style.position).toBe("fixed");
    expect(wrapper?.id).toMatch(/^PORTAL/);
  });

  it("gives two portals two different ids", () => {
    render(
      <>
        <Portal>
          <span>a</span>
        </Portal>
        <Portal>
          <span>b</span>
        </Portal>
      </>,
    );
    expect(screen.getByText("a").parentElement?.id).not.toBe(
      screen.getByText("b").parentElement?.id,
    );
  });

  it("uses the id it is given", () => {
    render(
      <Portal id="tooltip">
        <span>tip</span>
      </Portal>,
    );
    expect(screen.getByText("tip").parentElement?.id).toBe("tooltip");
  });

  it("renders no wrapper when transient", () => {
    render(
      <Portal transient>
        <span>bare</span>
      </Portal>,
    );
    expect(screen.getByText("bare").parentElement).toBe(document.body);
  });

  it("renders in place when disabled", () => {
    const { container } = render(
      <Portal disabled>
        <span>here</span>
      </Portal>,
    );
    expect(screen.getByText("here").parentElement).toBe(container);
  });

  it("renders nothing while open is false, and appears when it turns true", () => {
    function Toggle() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          <Portal open={open}>
            <span>panel</span>
          </Portal>
        </>
      );
    }
    render(<Toggle />);
    expect(screen.queryByText("panel")).toBeNull();
    act(() => screen.getByText("open").click());
    expect(screen.getByText("panel")).toBeTruthy();
  });

  it("renders into the container it is given", () => {
    const host = document.createElement("section");
    document.body.append(host);
    render(
      <Portal container={host} transient>
        <span>inside</span>
      </Portal>,
    );
    expect(screen.getByText("inside").parentElement).toBe(host);
    host.remove();
  });

  it("renders nothing while the container is null, then into it once it exists", () => {
    function Late() {
      const [host, setHost] = useState<HTMLElement | null>(null);
      return (
        <>
          <section ref={setHost} data-testid="host" />
          <Portal container={host} transient>
            <span>late</span>
          </Portal>
        </>
      );
    }
    render(<Late />);
    expect(screen.getByText("late").parentElement).toBe(screen.getByTestId("host"));
    render(
      <Portal container={null}>
        <span>never</span>
      </Portal>,
    );
    expect(screen.queryByText("never")).toBeNull();
  });

  it("removes its content when it unmounts", () => {
    const { unmount } = render(
      <Portal>
        <span>gone</span>
      </Portal>,
    );
    unmount();
    expect(screen.queryByText("gone")).toBeNull();
    expect(document.body.querySelector("[id^=PORTAL]")).toBeNull();
  });

  it("hydrates a server render without a mismatch, and then shows the portal", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = (
      <main>
        <Portal>
          <span>popup</span>
        </Portal>
      </main>
    );
    const root = document.createElement("div");
    document.body.append(root);
    root.innerHTML = renderToString(app);
    expect(root.innerHTML).toBe("<main></main>");
    act(() => {
      hydrateRoot(root, app);
    });
    expect(screen.getByText("popup").parentElement?.parentElement).toBe(document.body);
    expect(error).not.toHaveBeenCalled();
    root.remove();
  });
});
````

````tsx
// src/react/Portal.ssr.test.tsx
// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Portal } from "./Portal";

describe("Portal on the server", () => {
  it("renders nothing, and does not read document, which does not exist", () => {
    expect(typeof document).toBe("undefined");
    expect(
      renderToString(
        <Portal>
          <p>popup</p>
        </Portal>,
      ),
    ).toBe("");
  });

  it("renders its children in place when disabled, since nothing has to be moved", () => {
    expect(
      renderToString(
        <Portal disabled>
          <p>popup</p>
        </Portal>,
      ),
    ).toBe("<p>popup</p>");
  });

  it("renders nothing when it is not open", () => {
    expect(
      renderToString(
        <Portal open={false}>
          <p>popup</p>
        </Portal>,
      ),
    ).toBe("");
  });
});
````

- [ ] **Step 2: Rodar e ver falhar (RED).**

```bash
timeout 90 npx vitest run --project react Portal
```

Esperado: 2 arquivos falham com `Failed to resolve import "./Portal"`.

- [ ] **Step 3: Implementar.** `useSyncExternalStore` com um `subscribe` que nunca notifica: o instantâneo do cliente é o `container` (ou `document.body`) e o do servidor é `null`.

````tsx
// src/react/Portal.tsx
import { createPortal } from "react-dom";
import { useId, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode } from "react";

/** Props of {@link Portal}. */
export interface PortalProps {
  children?: ReactNode;
  /** The `id` of the wrapper element. Defaults to one that is unique per portal. */
  id?: string;
  /** Renders nothing while `false`. Defaults to `true`. */
  open?: boolean;
  /** Renders the children where the `Portal` is, as if it were not there. Defaults to `false`. */
  disabled?: boolean;
  /** Renders the children straight into the container, without the wrapper element. */
  transient?: boolean;
  /**
   * Where to render. Defaults to `document.body`. `null` means "not ready yet" and renders nothing:
   * keep the element in state with a callback ref (`<div ref={setHost}>`) and pass it.
   */
  container?: Element | DocumentFragment | null;
}

const subscribe = () => () => {};

/**
 * Renders its children outside of the parent's DOM, in `document.body` or in a `container`: for
 * popups, menus and dialogs that a parent with `overflow: hidden` or a stacking context would clip.
 * The children stay in the React tree, so context and events work as if they were rendered in place.
 *
 * Safe for server rendering: with no `document` it renders nothing, and it moves to the container
 * after hydration instead of causing a mismatch.
 *
 * @example
 * ```tsx
 * <Portal open={isOpen}>
 *   <div role="dialog">Hello</div>
 * </Portal>
 * ```
 *
 * @param props - See {@link PortalProps}.
 * @returns The portal, or nothing.
 */
export function Portal({
  children,
  id,
  open = true,
  disabled = false,
  transient = false,
  container,
}: PortalProps): ReactElement | null {
  const generated = useId();
  // `null` on the server and while hydrating, where there is no page to point at yet: a portal
  // cannot be rendered there, and this makes React render it again right after.
  const host = useSyncExternalStore(
    subscribe,
    () => (container === undefined ? document.body : container),
    () => null,
  );

  if (!open) return null;
  if (disabled) return <>{children}</>;
  if (host === null) return null;

  const key = id ?? `PORTAL${generated}`;
  if (transient) return createPortal(children, host, key);
  return createPortal(
    <div style={{ position: "fixed" }} id={key}>
      {children}
    </div>,
    host,
    key,
  );
}
````

- [ ] **Step 4: Rodar (GREEN), o lint e o type-check.**

```bash
timeout 90 npx vitest run --project react Portal
npx eslint src/react && npx tsc -p tsconfig.react.json && npx tsc -p tsconfig.test.json
```

Esperado: 2 arquivos, 13 testes passando; lint e `tsc` sem saída.

- [ ] **Step 5: Commit.**

```bash
git add src/react/Portal.tsx src/react/Portal.test.tsx src/react/Portal.ssr.test.tsx
git commit -m "feat: add Portal, which renders after mount and takes a container" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: `hx`

**Files:** criar `src/react/hx.test.tsx`, `src/react/hx.ssr.test.tsx` e `src/react/hx.tsx`.

- [ ] **Step 1: Escrever os testes primeiro.** Para os elementos: a tag, os 16 atalhos virando `style`, nenhum atalho sobrando como atributo, um atalho vencendo a mesma chave em `style`, `style` intacto sem atalhos (e nenhum criado), um atalho `undefined` ignorado, `width`/`height` como atributos em `canvas`/`img`/`video`/`svg`, `border` como atributo em `table` e como estilo em `div`, os outros atalhos de uma tag com atributos nativos ainda virando estilo, a consulta da tabela só por chave própria (`toString`), `rendered={false}`, `transient`, a ref, o repasse das outras props, uma lista de filhos sem aviso de `key`, um elemento vazio (`input`), o `displayName`, o mesmo componente a cada acesso e as chaves `symbol`. Para os componentes embrulhados: as props, `rendered`/`transient`, o `width` do próprio componente passando direto, o mesmo embrulho e seu nome, o nome de um componente anônimo e a ausência de aviso de ref. Mais um teste de tipos (`@ts-expect-error`).

````tsx
// src/react/hx.test.tsx
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import type { ComponentProps, ComponentType, CSSProperties } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hx } from "./hx";

afterEach(() => vi.restoreAllMocks());

describe("hx", () => {
  describe("intrinsic elements", () => {
    it("renders the tag it is named after", () => {
      render(<hx.section data-testid="s">hi</hx.section>);
      expect(screen.getByTestId("s").tagName).toBe("SECTION");
    });

    it("turns the style shortcuts into style", () => {
      render(
        <hx.div
          data-testid="d"
          backgroundColor="red"
          width="10px"
          height={20}
          margin="1px"
          padding="2px"
          color="blue"
          textAlign="center"
          border="1px solid black"
          borderRadius="3px"
          display="flex"
          position="absolute"
          top="1px"
          left="2px"
          right="3px"
          bottom="4px"
          opacity={0.5}
        />,
      );
      const { style } = screen.getByTestId("d");
      expect(style.backgroundColor).toBe("red");
      expect(style.width).toBe("10px");
      expect(style.height).toBe("20px");
      expect(style.color).toBe("blue");
      expect(style.textAlign).toBe("center");
      expect(style.borderRadius).toBe("3px");
      expect(style.display).toBe("flex");
      expect(style.position).toBe("absolute");
      expect(style.opacity).toBe("0.5");
      expect(style.top).toBe("1px");
    });

    it("does not leave a shortcut behind as an attribute", () => {
      render(<hx.div data-testid="d" width="10px" backgroundColor="red" />);
      const div = screen.getByTestId("d");
      expect(div.hasAttribute("width")).toBe(false);
      expect(div.hasAttribute("backgroundColor")).toBe(false);
      expect(div.hasAttribute("backgroundcolor")).toBe(false);
    });

    it("merges the shortcuts into `style`, and a shortcut wins over the same key in `style`", () => {
      render(<hx.div data-testid="d" style={{ width: "1px", zIndex: 4 }} width="9px" />);
      const { style } = screen.getByTestId("d");
      expect(style.width).toBe("9px");
      expect(style.zIndex).toBe("4");
    });

    it("leaves `style` alone when there is no shortcut", () => {
      render(<hx.div data-testid="d" style={{ zIndex: 4 }} />);
      expect(screen.getByTestId("d").getAttribute("style")).toBe("z-index: 4;");
      render(<hx.div data-testid="e" />);
      expect(screen.getByTestId("e").hasAttribute("style")).toBe(false);
    });

    it("skips a shortcut that is undefined", () => {
      render(<hx.div data-testid="d" style={{ width: "1px" }} width={undefined} />);
      expect(screen.getByTestId("d").style.width).toBe("1px");
    });

    it("keeps `width` and `height` as attributes where they are native (canvas, img, video, svg)", () => {
      render(
        <>
          <hx.canvas data-testid="c" width={300} height={150} />
          <hx.img data-testid="i" alt="" width={20} height={10} />
          <hx.video data-testid="v" width={64} />
          <hx.svg data-testid="s" width={8} height={9} />
        </>,
      );
      for (const id of ["c", "i", "v", "s"]) {
        const element = screen.getByTestId(id);
        expect(element.getAttribute("width")).not.toBeNull();
        expect(element.style.width).toBe("");
      }
      expect(screen.getByTestId("c").getAttribute("height")).toBe("150");
    });

    it("keeps `border` as an attribute on a table, and `color` and `width` on a div as style", () => {
      render(
        <>
          <hx.table data-testid="t" border={2} />
          <hx.div data-testid="d" border="1px solid red" />
        </>,
      );
      expect(screen.getByTestId("t").getAttribute("border")).toBe("2");
      expect(screen.getByTestId("t").style.border).toBe("");
      expect(screen.getByTestId("d").style.border).toBe("1px solid red");
    });

    it("still turns the other shortcuts of a tag with native ones into style", () => {
      render(<hx.canvas data-testid="c" width={300} backgroundColor="red" />);
      expect(screen.getByTestId("c").style.backgroundColor).toBe("red");
    });

    it("looks a tag up in the native-attribute table by its own key, not through the prototype", () => {
      // `toString` is inherited by every object: a plain lookup would find a function there.
      const Odd = Reflect.get(hx, "toString") as ComponentType<{ width?: string }>;
      const { container } = render(<Odd width="5px" />);
      expect((container.firstElementChild as HTMLElement).style.width).toBe("5px");
    });

    it("renders nothing when `rendered` is false", () => {
      const { container } = render(<hx.div rendered={false}>hi</hx.div>);
      expect(container.innerHTML).toBe("");
    });

    it("renders only the children when `transient`, without the element", () => {
      const { container } = render(
        <hx.div transient width="10px">
          <span>inner</span>
        </hx.div>,
      );
      expect(container.innerHTML).toBe("<span>inner</span>");
    });

    it("forwards the ref to the element", () => {
      const ref = createRef<HTMLDivElement>();
      render(<hx.div ref={ref} />);
      expect(ref.current?.tagName).toBe("DIV");
    });

    it("passes every other prop through", () => {
      const onClick = vi.fn();
      render(
        <hx.button data-testid="b" id="go" className="btn" onClick={onClick} aria-label="Go">
          go
        </hx.button>,
      );
      const button = screen.getByTestId("b");
      button.click();
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(button.id).toBe("go");
      expect(button.className).toBe("btn");
      expect(button.getAttribute("aria-label")).toBe("Go");
    });

    it("renders a list of children without a key warning", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      render(
        <hx.ul>
          <li>a</li>
          <li>b</li>
        </hx.ul>,
      );
      expect(error).not.toHaveBeenCalled();
    });

    it("renders a void element, which must not receive children", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      render(<hx.input data-testid="in" />);
      expect(screen.getByTestId("in").tagName).toBe("INPUT");
      expect(error).not.toHaveBeenCalled();
    });

    it("gives each component a displayName for the devtools", () => {
      expect(hx.div.displayName).toBe("hx.div");
      expect(hx.canvas.displayName).toBe("hx.canvas");
    });

    it("returns the same component every time, so a re-render does not remount", () => {
      expect(hx.div).toBe(hx.div);
      expect(hx.div).not.toBe(hx.span);
    });

    it("does not turn a symbol key into a component", () => {
      const anyHx = hx as unknown as Record<symbol, unknown>;
      expect(anyHx[Symbol.iterator]).toBeUndefined();
      expect(anyHx[Symbol.toPrimitive]).toBeUndefined();
      expect(anyHx[Symbol.toStringTag]).toBeUndefined();
      expect(() => String(Object.prototype.toString.call(hx))).not.toThrow();
    });
  });

  describe("custom components", () => {
    function Card({
      title,
      style,
      width,
    }: {
      title: string;
      style?: CSSProperties;
      width?: number;
    }) {
      return (
        <article data-testid="card" style={style} data-width={width}>
          {title}
        </article>
      );
    }
    const HxCard = hx(Card);

    it("renders the component with its props", () => {
      render(<HxCard title="Hello" style={{ color: "red" }} />);
      expect(screen.getByTestId("card").textContent).toBe("Hello");
      expect(screen.getByTestId("card").style.color).toBe("red");
    });

    it("supports `rendered` and `transient`", () => {
      const { container } = render(<HxCard title="x" rendered={false} />);
      expect(container.innerHTML).toBe("");
      const { container: other } = render(
        <HxCard title="x" transient>
          <b>kept</b>
        </HxCard>,
      );
      expect(other.innerHTML).toBe("<b>kept</b>");
    });

    it("passes the component's own `width` prop through instead of taking it as a shortcut", () => {
      render(<HxCard title="x" width={7} />);
      expect(screen.getByTestId("card").getAttribute("data-width")).toBe("7");
    });

    it("returns the same wrapper for the same component, and names it", () => {
      expect(hx(Card)).toBe(HxCard);
      expect(HxCard.displayName).toBe("hx(Card)");
    });

    it("names a wrapper for an anonymous component", () => {
      expect(hx(() => null).displayName).toBe("hx(Component)");
    });

    it("does not warn about a ref when nobody passed one (React 18 warns for a function component)", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      render(<HxCard title="x" />);
      expect(error).not.toHaveBeenCalled();
    });
  });

  it("accepts the props of the element it stands for, and no others (types)", () => {
    type DivProps = ComponentProps<typeof hx.div>;
    const ok: DivProps = { width: "10px", rendered: true, onClick: () => {} };
    void ok;
    // @ts-expect-error a div has no `href`
    const bad: DivProps = { href: "/" };
    void bad;
  });
});
````

````tsx
// src/react/hx.ssr.test.tsx
// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hx } from "./hx";

describe("hx on the server", () => {
  it("renders the shortcuts as style and the native attributes as attributes", () => {
    expect(typeof document).toBe("undefined");
    expect(
      renderToString(
        <hx.div display="flex" padding="8px">
          <hx.canvas width={300} height={150} />
          <hx.span rendered={false}>hidden</hx.span>
          <hx.b transient>bare</hx.b>
        </hx.div>,
      ),
    ).toBe(
      '<div style="padding:8px;display:flex"><canvas width="300" height="150"></canvas>bare</div>',
    );
  });
});
````

- [ ] **Step 2: Rodar e ver falhar (RED).**

```bash
timeout 90 npx vitest run --project react hx
```

Esperado: os 2 arquivos falham com `Failed to resolve import "./hx"`.

- [ ] **Step 3: Implementar.**

````tsx
// src/react/hx.tsx
import { createElement, forwardRef, Fragment } from "react";
import type { ComponentType, CSSProperties, JSX, NamedExoticComponent, ReactNode } from "react";

const shortcutKeys = [
  "backgroundColor",
  "width",
  "height",
  "margin",
  "padding",
  "color",
  "textAlign",
  "border",
  "borderRadius",
  "display",
  "position",
  "top",
  "left",
  "right",
  "bottom",
  "opacity",
] as const;

/** The names that `hx` accepts as props and turns into `style`. */
export type HxShortcutKey = (typeof shortcutKeys)[number];

type Shortcuts = { [K in HxShortcutKey]?: CSSProperties[K] };

/**
 * The tags where a shortcut name is also a real attribute, so `<hx.canvas width={300}>` sets the
 * attribute (a canvas is sized by it, not by CSS) instead of the style. The types and the runtime
 * both read this one table, so they cannot disagree.
 */
const nativeAttributes = {
  canvas: ["width", "height"],
  embed: ["width", "height"],
  iframe: ["width", "height"],
  img: ["width", "height"],
  input: ["width", "height"],
  object: ["width", "height"],
  source: ["width", "height"],
  video: ["width", "height"],
  svg: ["width", "height"],
  rect: ["width", "height"],
  image: ["width", "height"],
  foreignObject: ["width", "height"],
  use: ["width", "height"],
  pattern: ["width", "height"],
  mask: ["width", "height"],
  filter: ["width", "height"],
  symbol: ["width", "height"],
  table: ["border"],
} as const satisfies { [T in keyof JSX.IntrinsicElements]?: readonly HxShortcutKey[] };

type NativeKeys<T extends keyof JSX.IntrinsicElements> = T extends keyof typeof nativeAttributes
  ? (typeof nativeAttributes)[T][number]
  : never;

/** The props `hx` adds to every component. */
export interface HxExtraProps {
  /** Renders nothing while `false`. */
  rendered?: boolean;
  /** Renders only the children, without the element. */
  transient?: boolean;
}

/** The props of `hx.<tag>`: those of the element, the style shortcuts that do not clash, and the extras. */
export type HxProps<T extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[T] &
  Omit<Shortcuts, NativeKeys<T>> &
  HxExtraProps;

/** The type of {@link hx}. */
export type HxType = {
  <P extends object>(
    Component: ComponentType<P>,
  ): NamedExoticComponent<P & HxExtraProps & { children?: ReactNode }>;
} & {
  readonly [T in keyof JSX.IntrinsicElements]: NamedExoticComponent<HxProps<T>>;
};

interface AnyProps extends HxExtraProps {
  children?: ReactNode;
  style?: CSSProperties;
  [prop: string]: unknown;
}

const noNative: readonly string[] = [];

function createIntrinsic(tag: string): NamedExoticComponent<AnyProps> {
  // `hasOwn`: a tag called `toString` must not find the function every object inherits.
  const native: readonly string[] = Object.hasOwn(nativeAttributes, tag)
    ? nativeAttributes[tag as keyof typeof nativeAttributes]
    : noNative;

  const Hx = forwardRef<unknown, AnyProps>(function Hx(props: AnyProps, ref) {
    const { rendered, transient, children, style, ...rest } = props;
    if (rendered === false) return null;
    if (transient) return createElement(Fragment, null, children);

    const shortcuts: Record<string, unknown> = {};
    let used = false;
    for (const key of shortcutKeys) {
      if (native.includes(key) || !(key in rest)) continue;
      if (rest[key] !== undefined) {
        shortcuts[key] = rest[key];
        used = true;
      }
      delete rest[key];
    }
    return createElement(tag, {
      ...rest,
      style: used ? { ...style, ...shortcuts } : style,
      ref,
      children,
    });
  });
  Hx.displayName = `hx.${tag}`;
  return Hx;
}

function createWrapper(Component: ComponentType<AnyProps>): NamedExoticComponent<AnyProps> {
  const Wrapper = forwardRef<unknown, AnyProps>(function HxWrapper(props: AnyProps, ref) {
    const { rendered, transient, children, ...rest } = props;
    if (rendered === false) return null;
    if (transient) return createElement(Fragment, null, children);
    return createElement(Component, { ...rest, children, ref });
  });
  Wrapper.displayName = `hx(${Component.displayName ?? (Component.name || "Component")})`;
  return Wrapper;
}

const intrinsics = new Map<string, NamedExoticComponent<AnyProps>>();
const wrappers = new WeakMap<ComponentType<AnyProps>, NamedExoticComponent<AnyProps>>();

/**
 * Components with shortcuts for common style props, and two switches that save a ternary.
 *
 * `hx.<tag>` is the element, plus `backgroundColor`, `width`, `height`, `margin`, `padding`,
 * `color`, `textAlign`, `border`, `borderRadius`, `display`, `position`, `top`, `left`, `right`,
 * `bottom` and `opacity` as props that become `style` (a shortcut wins over the same key in
 * `style`). Where the element has that attribute for real (`width` and `height` of a `canvas`,
 * `img`, `video` or `svg`, `border` of a `table`) the prop stays the attribute.
 *
 * `rendered={false}` renders nothing, and `transient` renders only the children. `hx(Component)`
 * gives any component those two switches; it adds no shortcuts, so the component keeps every prop
 * it declares, `width` included.
 *
 * @example
 * ```tsx
 * <hx.div display="flex" padding="8px" rendered={isVisible}>
 *   <hx.canvas width={300} height={150} />
 * </hx.div>
 *
 * const MaybeCard = hx(Card);
 * <MaybeCard rendered={false} />
 * ```
 */
export const hx: HxType = /* @__PURE__ */ new Proxy(() => {}, {
  apply(_target, _this, [Component]: [ComponentType<AnyProps>]) {
    let wrapper = wrappers.get(Component);
    if (!wrapper) wrappers.set(Component, (wrapper = createWrapper(Component)));
    return wrapper;
  },
  get(_target, tag) {
    // Symbols are how the language and the tools look at an object (`Symbol.toPrimitive`,
    // `Symbol.toStringTag`, inspection): none of them is a tag.
    if (typeof tag === "symbol") return undefined;
    let component = intrinsics.get(tag);
    if (!component) intrinsics.set(tag, (component = createIntrinsic(tag)));
    return component;
  },
}) as unknown as HxType;
````

- [ ] **Step 4: Rodar (GREEN), o lint e o type-check.**

```bash
timeout 90 npx vitest run --project react hx
npx eslint src/react && npx tsc -p tsconfig.react.json && npx tsc -p tsconfig.test.json
```

Esperado: 2 arquivos, 27 testes passando; lint e `tsc` sem saída.

- [ ] **Step 5: Commit.**

```bash
git add src/react/hx.tsx src/react/hx.test.tsx src/react/hx.ssr.test.tsx
git commit -m "feat: add hx with forwardRef, a native-attribute table and no shortcuts on wrapped components" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Testes no Chromium, onde o `happy-dom` mente

**Files:** criar `src/react/useEventListener.browser.test.tsx` e `src/react/useClickOutside.browser.test.tsx`.

O `happy-dom` remove um listener de captura mesmo quando a remoção esquece a flag, e não faz um clique de verdade. Estes testes provam, num Chromium, o que os hooks prometem: que um listener de captura sai ao desmontar (o bug do `useHTMLEventListener` legado), e o menu que abre, aguenta um toque dentro, fecha com um toque fora, não fecha-e-reabre com o botão que o abre, e conta como "dentro" o conteúdo de um `Portal` listado nas refs.

- [ ] **Step 1: Escrever os testes.** Como os hooks já existem, eles nascem verdes; a prova de que valem é a mutação do Step 3.

````tsx
// src/react/useEventListener.browser.test.tsx
import { render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useEventListener } from "./useEventListener";

function Probe({ options, handler }: { options?: boolean; handler: () => void }) {
  useEventListener(window, "hyrax:ping" as "resize", handler, options);
  return null;
}

describe("useEventListener in a real browser", () => {
  it("removes a capture listener when the component unmounts", () => {
    // happy-dom removes a capture listener even when the removal forgets the capture flag, so
    // this can only be proven here: the legacy hook never removed one.
    const handler = vi.fn();
    const { unmount } = render(<Probe options handler={handler} />);
    window.dispatchEvent(new Event("hyrax:ping"));
    expect(handler).toHaveBeenCalledTimes(1);
    unmount();
    window.dispatchEvent(new Event("hyrax:ping"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("removes the old listener when the capture flag changes", () => {
    const handler = vi.fn();
    function Flip() {
      const [capture, setCapture] = useState(true);
      return (
        <>
          <button onClick={() => setCapture(false)}>flip</button>
          <Probe options={capture} handler={handler} />
        </>
      );
    }
    const { getByText } = render(<Flip />);
    getByText("flip").click();
    // Let React commit the flip.
    return Promise.resolve().then(() => {
      handler.mockClear();
      window.dispatchEvent(new Event("hyrax:ping"));
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
````

````tsx
// src/react/useClickOutside.browser.test.tsx
import { render } from "@testing-library/react";
import { useRef, useState } from "react";
import { userEvent } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { Portal } from "./Portal";
import { useClickOutside } from "./useClickOutside";

/** The popup an app would build: an opener, a panel, and a press anywhere else that closes it. */
function Menu({ withPortal = false }: { withPortal?: boolean }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useClickOutside(panel, () => setOpen(false), { ignore: opener });

  const content = (
    <div ref={panel}>
      <button>item</button>
    </div>
  );
  return (
    <>
      <button ref={opener} onClick={() => setOpen((value) => !value)}>
        toggle
      </button>
      <p>elsewhere</p>
      {open && (withPortal ? <Portal>{content}</Portal> : content)}
    </>
  );
}

describe("useClickOutside in a real browser", () => {
  it("opens with the opener, stays open on a press inside, and closes on a press outside", async () => {
    const { getByText, queryByText } = render(<Menu />);
    await userEvent.click(getByText("toggle"));
    expect(queryByText("item")).not.toBeNull();
    await userEvent.click(getByText("item"));
    expect(queryByText("item")).not.toBeNull();
    await userEvent.click(getByText("elsewhere"));
    expect(queryByText("item")).toBeNull();
  });

  it("does not close and reopen when the opener is pressed, because it is ignored", async () => {
    const { getByText, queryByText } = render(<Menu />);
    await userEvent.click(getByText("toggle"));
    await userEvent.click(getByText("toggle"));
    expect(queryByText("item")).toBeNull();
  });

  it("treats a press inside a Portal as inside when the portal content is a ref", async () => {
    const { getByText, queryByText } = render(<Menu withPortal />);
    await userEvent.click(getByText("toggle"));
    await userEvent.click(getByText("item"));
    expect(queryByText("item")).not.toBeNull();
    await userEvent.click(getByText("elsewhere"));
    expect(queryByText("item")).toBeNull();
  });
});
````

- [ ] **Step 2: Rodar.**

```bash
timeout 120 npx vitest run --project browser
```

Esperado: 7 arquivos, 31 testes passando (5 do `/dom`, 2 do `/react`).

- [ ] **Step 3: Provar que o teste da captura vale (mutação).** Em `src/react/useEventListener.ts`, troque o `useEffect` que chama `listen(...)` por um que registra e remove **à mão, sem a flag na remoção**:

```ts
  useEffect(() => {
    const element = resolveRef(target);
    if (!element) return;
    const fn = (event: Event) => latest.current(event);
    element.addEventListener(type, fn, { capture, once, passive, signal });
    return () => element.removeEventListener(type, fn);
  }, [target, type, capture, once, passive, signal, latest]);
```

```bash
timeout 120 npx vitest run --project react useEventListener   # esperado: PASSA (o happy-dom deixa passar)
timeout 120 npx vitest run --project browser useEventListener # esperado: 2 testes FALHAM
```

Desfaça a mutação (`git diff src/react/useEventListener.ts` tem de ficar vazio) e rode o `browser` de novo: passa.

- [ ] **Step 4: Estabilidade do Chromium com o cache frio.** O `optimizeDeps.include` da Task 1 existe para isto.

```bash
rm -rf node_modules/.vite
for i in 1 2 3 4 5; do timeout 120 npx vitest run --project browser 2>&1 | grep -E "Tests |FAIL"; done
```

Esperado: 5 vezes `Tests  31 passed (31)` e nenhum `FAIL`.

- [ ] **Step 5: Commit.**

```bash
git add src/react/useEventListener.browser.test.tsx src/react/useClickOutside.browser.test.tsx
git commit -m "test: check in Chromium that a capture listener is removed and a menu closes on a real press" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: O barrel e a superfície pública

**Files:** modificar `src/react/index.ts`, `src/react/index.test.ts`; criar `src/react/index.ssr.test.ts`.

- [ ] **Step 1: Escrever os testes primeiro.** O de superfície pina o conjunto exato de exports (adicionar ou remover um é uma decisão de API), e o de SSR confere que o módulo importa sem `document`.

````ts
// src/react/index.test.ts
import { describe, expect, it } from "vitest";
import * as react from "./index";

describe("@gabreusi/hyrax/react", () => {
  it("runs in a DOM environment", () => {
    expect(typeof document).toBe("object");
  });

  it("has named exports only", () => {
    expect("default" in react).toBe(false);
  });

  it("exposes exactly the intended public API", () => {
    // Adding or removing an export is an API decision: update this list on purpose.
    const expected = [
      "hx",
      "Portal",
      "useClickOutside",
      "useEventListener",
      "useForceUpdate",
      "useInterval",
    ];
    expect(Object.keys(react).sort()).toEqual(expected.sort());
  });
});
````

````ts
// src/react/index.ssr.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as react from "./index";

describe("@gabreusi/hyrax/react without a DOM", () => {
  it("can be imported where there is no document, and runs nothing on import", () => {
    expect(typeof document).toBe("undefined");
    expect(typeof react.hx.div).toBe("object");
    expect(typeof react.Portal).toBe("function");
    expect(typeof react.useInterval).toBe("function");
  });
});
````

- [ ] **Step 2: Rodar e ver falhar (RED).**

```bash
timeout 90 npx vitest run --project react src/react/index
```

Esperado: `exposes exactly the intended public API` falha (o `index.ts` ainda é `export {}`, e `Object.keys` dá `[]`) e o de SSR falha (`react.hx` é `undefined`).

- [ ] **Step 3: Implementar o barrel.**

````ts
// src/react/index.ts
export { hx } from "./hx";
export type { HxExtraProps, HxProps, HxShortcutKey, HxType } from "./hx";
export { Portal } from "./Portal";
export type { PortalProps } from "./Portal";
export { useClickOutside } from "./useClickOutside";
export type { ClickOutsideRefs, UseClickOutsideOptions } from "./useClickOutside";
export { useEventListener } from "./useEventListener";
export { useForceUpdate } from "./useForceUpdate";
export { useInterval } from "./useInterval";
export type { UseIntervalOptions, UseIntervalResult } from "./useInterval";
export type { MaybeRef, RefLike } from "./internal/refs";
````

- [ ] **Step 4: Rodar (GREEN), o lint e o type-check.**

```bash
timeout 90 npx vitest run --project react
npx eslint . && npx tsc -p tsconfig.react.json && npx tsc -p tsconfig.test.json
```

Esperado: 14 arquivos, 90 testes passando; lint e `tsc` sem saída.

- [ ] **Step 5: A cobertura de `src/react`.**

```bash
timeout 300 npx vitest run --coverage 2>&1 | grep -E "Test Files|Tests  |src/react|ERROR"
```

Esperado: 52 arquivos e 532 testes (a Task 10 não acrescenta testes), e `src/react` com 100% de instruções, linhas e ramos e ~96,8% de funções (a função que sobra é o alvo `() => {}` do `Proxy`, que nunca é chamado).

- [ ] **Step 6: Commit.**

```bash
git add src/react/index.ts src/react/index.test.ts src/react/index.ssr.test.ts
git commit -m "feat: export the /react API and pin the public surface" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: O build (`"use client"`), os orçamentos de tamanho, o smoke test e o CI

**Files:** modificar `tsdown.config.ts`, `package.json`, `scripts/smoke.mjs`, `.github/workflows/ci.yml` e `CONTRIBUTING.md`.

- [ ] **Step 1: Pôr `"use client"` só no `/react`.** O `banner` do Rolldown recebe o chunk; só o entrypoint `react` ganha a diretiva.

````ts
// tsdown.config.ts
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
  outputOptions: {
    // The hooks and components only work in a Client Component. Saying so once, on the entrypoint
    // (and not on the chunk it shares with /dom), is what Next.js and other React Server
    // Components bundlers read.
    banner: (chunk) => (chunk.name === "react" ? '"use client";' : ""),
  },
});
````

```bash
npm run build
for f in react.js react.cjs dom.js dom.cjs index.js index.cjs; do echo "$f: $(head -1 dist/$f | cut -c1-40) | imports: $(grep -cE '^import |require\(' dist/$f)"; done
ls dist | grep -v "\.d\."
npm run check:package
```

Esperado: `react.js` e `react.cjs` começam com `"use client";` e mais nenhum; `index.js` e `index.cjs` com **0** imports (a raiz não tem chunk); `dom.js` importa o chunk `onClickOutside-*.js` (o `/react` importa o `/dom`, então o chunk é dos dois); `publint` com `All good!` e `attw` sem problemas (`🟢` em todos os perfis `node16` e `bundler`).

- [ ] **Step 2: Os orçamentos de tamanho do `/react`.** Um para o entrypoint inteiro e um por peça: uma peça só custa o que é dela. Os pares `react`, `react-dom` e `react/jsx-runtime` são ignorados na medição (são peers, não fazem parte do que a biblioteca entrega).

```bash
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const entry = (name, imports, limit) => ({
  name: `react entrypoint, ${name}`,
  path: "dist/react.js",
  import: imports,
  ignore: ["react", "react-dom", "react/jsx-runtime"],
  limit,
});
pkg["size-limit"].push(
  entry("everything", "*", "2 kB"),
  entry("useForceUpdate only", "{ useForceUpdate }", "150 B"),
  entry("useEventListener only", "{ useEventListener }", "450 B"),
  entry("useClickOutside only", "{ useClickOutside }", "650 B"),
  entry("useInterval only", "{ useInterval }", "400 B"),
  entry("Portal only", "{ Portal }", "450 B"),
  entry("hx only", "{ hx }", "850 B"),
);
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
'
npx prettier --write package.json
npm run size 2>&1 | grep -E "react entrypoint|Size:" | tail -14
```

Esperado (medido): tudo 1,54 kB (limite 2 kB), `useForceUpdate` 96 B (150 B), `useEventListener` 298 B (450 B), `useClickOutside` 484 B (650 B), `useInterval` 257 B (400 B), `Portal` 295 B (450 B), `hx` 630 B (850 B), e os oito orçamentos anteriores intactos.

- [ ] **Step 3: O smoke test.** Agora ele instala `@types/react` e `@types/react-dom` (sem eles o `.d.ts` do `/react` não resolve `react`), renderiza no servidor com `renderToString` em Node ESM, Node CJS e (se houver) Deno e Bun, confere que só `react.js` e `react.cjs` começam com `"use client";`, type-checa um consumidor `.tsx` com quatro `@ts-expect-error`, e aceita `HYRAX_SMOKE_REACT=18` para tudo isso com o React 18 e seus tipos.

````js
// scripts/smoke.mjs
// Installs the library tarball into a clean directory and imports every
// entrypoint through ESM and CJS, exactly as a consumer would.
//
//   node scripts/smoke.mjs [path/to/tarball.tgz]   (packs the repo when omitted)
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
  // react/react-dom are optional peers that /react needs; their types are needed to type-check a
  // consumer. HYRAX_SMOKE_REACT=18 checks the package against React 18 and its types instead.
  const at = process.env.HYRAX_SMOKE_REACT ? `@${process.env.HYRAX_SMOKE_REACT}` : "";
  run(
    "npm",
    [
      "install",
      "--no-audit",
      "--no-fund",
      tarball,
      ...["react", "react-dom", "@types/react", "@types/react-dom"].map((name) => name + at),
    ],
    dir,
  );

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

```bash
node scripts/smoke.mjs
HYRAX_SMOKE_REACT=18 node scripts/smoke.mjs
HYRAX_SMOKE_RUNTIMES=deno node scripts/smoke.mjs   # só se o Deno estiver instalado; o Bun roda no CI
```

Esperado nas três: `Smoke test passed: 3 entrypoints x (ESM + CJS) + consumer types` (a terceira termina com `+ deno`).

- [ ] **Step 4: Provar que o smoke test falha quando deve.** Cada mutação guarda uma cópia do arquivo e a restaura.

```bash
# (a) sem a diretiva
cp tsdown.config.ts /tmp/tsdown.bak
sed -i 's/chunk.name === "react"/chunk.name === "nothing"/' tsdown.config.ts && npm run build >/dev/null
node scripts/smoke.mjs 2>&1 | grep -E '"use client"|Smoke test'
cp /tmp/tsdown.bak tsdown.config.ts

# (b) com um Portal que lê `document` no servidor
cp src/react/Portal.tsx /tmp/Portal.bak
sed -i 's|    () => null,|    () => document.body,|' src/react/Portal.tsx && npm run build >/dev/null
node scripts/smoke.mjs 2>&1 | grep -E "document is not defined|Smoke test"
cp /tmp/Portal.bak src/react/Portal.tsx

git status --short   # só o que a Task 10 modifica: tsdown.config.ts, package.json, scripts/smoke.mjs, ci.yml, CONTRIBUTING.md
npm run build && node scripts/smoke.mjs
```

Esperado: (a) `Error: "use client" must be on /react and only there: react=false dom=false root=false`; (b) `ReferenceError: document is not defined`; e, com os dois arquivos restaurados, o build e o smoke passam.

- [ ] **Step 5: O CI do React 18.** No job `test-react-18`, depois de `npx vitest run --project react`, acrescente o type-check com os tipos 18, o build e o smoke test com `HYRAX_SMOKE_REACT=18`. O job passa a provar que o código **compila** e que o pacote **construído** funciona com o React 18.

```yaml
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
      # The source must also compile against the React 18 types, and the built package must work with them.
      - run: npx tsc -p tsconfig.react.json && npx tsc -p tsconfig.test.json
      - run: npm run build
      - run: node scripts/smoke.mjs
        env:
          HYRAX_SMOKE_REACT: 18
```

- [ ] **Step 6: O CONTRIBUTING.** Substitua o arquivo inteiro: o navegador passa a cobrir `/react`, `npm run test:browser` entra na tabela, e há uma seção "Testing `/react`" (os três tipos de teste, StrictMode, os dois Reacts, `"use client"`), além da nota de que o `/dom` agora compartilha um chunk com o `/react`.

````md
// CONTRIBUTING.md
# Contributing

## Setup

Use Node 24 (`nvm use`, see `.nvmrc`; Node 22 or newer works) and install with `npm ci`.

## One-time setup for the browser tests

The `/dom` and `/react` tests that need a real browser (layout, Shadow DOM, real clicks) run in Chromium. Install it once with
`npx playwright install chromium` (on Linux CI: `--with-deps`). `npm test` needs none of this.

## Commands

| Command                  | What it does                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| `npm test`               | Runs the tests (`core` in Node, `dom` and `react` in happy-dom), without the browser                |
| `npm run test:browser`   | Runs only the tests that need a real browser (Chromium)                                             |
| `npm run test:coverage`  | Everything, browser included, with coverage. `src/core`, `src/dom` and `src/react` must stay at 95% |
| `npm run lint`           | ESLint. Every exported symbol needs TSDoc with an `@example`                                        |
| `npm run typecheck`      | Type-checks each entrypoint and the tests                                                           |
| `npm run check:boundary` | Fails if `src/core` starts compiling against DOM globals                                            |
| `npm run build`          | Builds `dist/` (ESM, CJS and type declarations)                                                     |
| `npm run check:package`  | `publint` and Are the Types Wrong on the built package                                              |
| `npm run size`           | Enforces the bundle-size budget (whole entrypoint and one function)                                 |
| `npm run bench`          | Prints how fast the `Random` methods are next to `Math.random` and `crypto` (a report, not a gate)  |
| `npm run smoke`          | Installs the packed tarball, imports every entrypoint and type-checks a consumer                    |
| `npm run check`          | Everything above, in CI order                                                                       |

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
````

- [ ] **Step 7: Rodar tudo.**

```bash
rm -rf dist coverage
npm run check
```

Esperado: código 0 (52 arquivos, 532 testes; os 15 orçamentos de tamanho dentro do limite; o smoke passa).

- [ ] **Step 8: Commit.**

```bash
git add tsdown.config.ts package.json scripts/smoke.mjs .github/workflows/ci.yml CONTRIBUTING.md
git commit -m "build: mark /react as a client entrypoint, budget its size, and smoke-test it on React 18 and 19" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Verificação final

**Files:** nenhum (só verificação). Nada aqui é commitado.

- [ ] **Step 1: Instalação limpa e o `check` completo.**

```bash
rm -rf node_modules dist coverage .vitest
npm ci
npx playwright install chromium
npm run check; echo "exit=$?"
```

Esperado: `exit=0`, 52 arquivos, 532 testes, cobertura de `src/react` acima de 95% em tudo.

- [ ] **Step 2: React 18 de ponta a ponta.**

```bash
npm install --no-save react@18 react-dom@18 @types/react@18 @types/react-dom@18
timeout 120 npx vitest run --project react     # 14 arquivos, 90 testes
npx tsc -p tsconfig.react.json && npx tsc -p tsconfig.test.json
npm run build && HYRAX_SMOKE_REACT=18 node scripts/smoke.mjs
npm ci                                           # volta ao React 19
```

Esperado: tudo passa com o React 18 e seus tipos, e o `npm ci` restaura o React 19.

- [ ] **Step 3: Estabilidade.** 20 execuções dos projetos sem navegador e 10 do navegador (`timeout` em cada uma):

```bash
f=0; for i in $(seq 1 20); do timeout 180 npx vitest run --project core --project dom --project react >/dev/null 2>&1 || f=$((f+1)); done; echo "node/happy-dom falhas: $f/20"
f=0; for i in $(seq 1 10); do timeout 180 npx vitest run --project browser >/dev/null 2>&1 || f=$((f+1)); done; echo "chromium falhas: $f/10"
```

Esperado: `0/20` e `0/10`.

- [ ] **Step 4: As 13 mutações.** Salve o script abaixo **fora do repositório** (por exemplo `/tmp/mutate.py`) e rode-o da raiz: `python3 /tmp/mutate.py`. Ele aplica cada mutação, roda os testes indicados, restaura o arquivo e imprime `CAUGHT` ou `MISSED`. Esperado: **13 `CAUGHT`** e nenhum `MISSED` nem `NO-OP MUTATION`. A da captura (a segunda) é a única que o projeto `react` deixa passar e só o `browser` pega (Task 8, Step 3).

````py
// /tmp/mutate.py
import subprocess, shutil, sys
muts = [
 ("useEventListener: stale handler (handler in deps, no ref)", "src/react/useEventListener.ts",
  "(event) => latest.current(event)", "handler as never", "react", "useEventListener.test"),
 ("useEventListener: removal forgets the capture flag (add/remove by hand)", "src/react/useEventListener.ts",
  None, None, "browser", "useEventListener.browser"),
 ("useInterval: delay missing from the timer effect deps", "src/react/useInterval.ts",
  "[isRunning, delay, latestHandler]", "[isRunning, latestHandler]", "react", "useInterval.test"),
 ("useInterval: immediate call in the timer effect", "src/react/useInterval.ts",
  None, None, "react", "useInterval.test"),
 ("useClickOutside: refs read once, at subscribe time", "src/react/useClickOutside.ts",
  "() => elements(latestRefs.current)", "(() => { const fixed = elements(latestRefs.current); return () => fixed; })()", "react", "useClickOutside.test"),
 ("useClickOutside: ignore dropped", "src/react/useClickOutside.ts",
  "ignore: () => elements(latestIgnore.current)", "ignore: undefined", "react", "useClickOutside.test"),
 ("hx: tag looked up without hasOwn", "src/react/hx.tsx",
  "Object.hasOwn(nativeAttributes, tag)", "tag in nativeAttributes", "react", "hx.test"),
 ("hx: native attributes ignored (always style)", "src/react/hx.tsx",
  "native.includes(key) || !(key in rest)", "!(key in rest)", "react", "hx.test"),
 ("hx: symbol keys become components", "src/react/hx.tsx",
  'if (typeof tag === "symbol") return undefined;', "tag = String(tag);", "react", "hx.test"),
 ("hx: a shortcut no longer wins over style", "src/react/hx.tsx",
  "{ ...style, ...shortcuts }", "{ ...shortcuts, ...style }", "react", "hx.test"),
 ("Portal: initial server snapshot reads document", "src/react/Portal.tsx",
  "    () => null,\n", "    () => (container === undefined ? document.body : container),\n", "react", "Portal"),
 ("Portal: null container falls back to body", "src/react/Portal.tsx",
  "() => (container === undefined ? document.body : container),\n    () => null", "() => container ?? document.body,\n    () => null", "react", "Portal.test"),
 ("useForceUpdate: new function every render", "src/react/useForceUpdate.ts",
  "useCallback(() => setTick((tick) => tick + 1), [])", "(() => setTick((tick) => tick + 1))", "react", "useForceUpdate"),
]
for name, path, old, new, project, filt in muts:
    orig = open(path).read()
    if name.startswith("useEventListener: removal"):
        mutated = orig.replace("""  useEffect(
    () =>
      listen(resolveRef(target), type, (event) => latest.current(event), {
        capture,
        once,
        passive,
        signal,
      }),
    [target, type, capture, once, passive, signal, latest],
  );""","""  useEffect(() => {
    const element = resolveRef(target);
    if (!element) return;
    const fn = (event: Event) => latest.current(event);
    element.addEventListener(type, fn, { capture, once, passive, signal });
    return () => element.removeEventListener(type, fn);
  }, [target, type, capture, once, passive, signal, latest]);""")
    elif name.startswith("useInterval: immediate"):
        mutated = orig.replace("""  useEffect(() => {
    if (isRunning && latestImmediate.current) latestHandler.current();
  }, [isRunning, latestHandler, latestImmediate]);

  useEffect(() => {
    if (!isRunning) return;""","""  useEffect(() => {
    if (!isRunning) return;
    if (latestImmediate.current) latestHandler.current();""")
    else:
        mutated = orig.replace(old, new)
    if mutated == orig:
        print("NO-OP MUTATION:", name); continue
    open(path, "w").write(mutated)
    try:
        r = subprocess.run(["timeout","120","npx","vitest","run","--project",project,filt],capture_output=True,text=True)
    finally:
        open(path, "w").write(orig)
    out = r.stdout + r.stderr
    failed = [l.strip() for l in out.splitlines() if l.strip().startswith("×")]
    print(("CAUGHT " if r.returncode != 0 else "MISSED ") + name + f" ({len(failed)} failing)")
    if project == "react" and name.startswith("useEventListener: removal"): pass
````

Depois, `git status --short` tem de estar vazio.

- [ ] **Step 5: A superfície e o pacote construído.**

```bash
node --input-type=module -e 'import * as m from "./dist/react.js"; console.log(Object.keys(m).sort().join(" "))'
node -e 'console.log(Object.keys(require("./dist/react.cjs")).sort().join(" "))'
grep -rnE "from \"(\.\./)+(core|index)" src/react src/dom || echo "nada de src/core em src/react nem em src/dom"
grep -cE '^import ' dist/index.js dist/dom.js dist/react.js
```

Esperado: as duas primeiras imprimem `Portal hx useClickOutside useEventListener useForceUpdate useInterval`; o `grep` diz "nada de src/core..."; os imports contados: `dist/index.js:0`, `dist/dom.js:1`, `dist/react.js:4` (a ordem das linhas pode variar). O `grep` de imports acha uma violação de verdade: um `import ... from "../core/x"` em `src/react` aparece na saída.

- [ ] **Step 6: Conferir a árvore e o histórico.**

```bash
git status --short          # vazio
git log --oneline main..HEAD
```

Esperado: a árvore limpa e 11 commits: o plano e o spec, e um por task (`test:` infraestrutura, `feat:` para `useForceUpdate`, `useEventListener`, `useClickOutside`, `useInterval`, `Portal` e `hx`, `test:` Chromium, `feat:` o barrel e `build:`).

- [ ] **Step 7: Parar aqui e pedir autorização ao usuário.** Só com a autorização explícita: `git push -u origin phase-4-react` e abrir o PR (título: `Phase 4: /react (hooks, hx and Portal)`), com o resumo, o que a implementação encontrou, o plano de teste e, no fim, o que só o GitHub confirma: o job `test-react-18` com o type-check, o build e o smoke test do React 18, e o job `runtimes` (Deno e Bun) com o `renderToString` do `/react`. Depois de aberto: `gh pr checks <n> --watch` e ler os logs desses dois jobs pelo link de `gh pr checks <n> --json name,link` (nunca `gh run list --branch`).
