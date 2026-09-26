# Suspend

`Suspend` notices that the process, tab or machine was **suspended**: the laptop lid was closed, a browser tab was
frozen, a container was paused. It does that by noticing that a timer fired much later than it should have. Use it to
reconnect sockets, refresh stale data or resync clocks after a wake-up.

```ts
const suspend = new Suspend({ threshold: 5000 });

const off = suspend.on((elapsed) => {
  console.log(`Woke up after ${elapsed} ms`);
  // reconnect your socket, refresh what is stale...
});

off(); // stop listening
suspend.dispose(); // or tear everything down
```

## How it works

- It is an instance, and not a global. Create one where you need it, and `dispose()` it when you are done.
- The check timer starts with the first listener and stops with the last, so an idle `Suspend` costs nothing.
- In Node the timer does not keep the process alive.
- `threshold` (how late counts as a suspension) and `interval` (how often to check) are options.
- A listener that throws does not stop the others, and `{ once: true }` removes a listener after its first call.

```ts
const suspend = new Suspend();
const off = suspend.on((elapsed) => console.log(elapsed), { once: true });
off();
suspend.dispose();
```

In React, [`useSuspend`](./react#usesuspend) ties a detector to the life of a component.

## A limit

It reads the wall clock (`Date.now()`), so changing the system clock by hand can look like a suspension.

## Reference

The full signatures, with every option and error, are in the API reference: [`Suspend`](/api/hyrax/classes/Suspend), [`SuspendOptions`](/api/hyrax/interfaces/SuspendOptions).
