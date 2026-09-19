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
