import { describe, expect, expectTypeOf, it } from "vitest";
import { traceHierarchy } from "./tree";

interface Employee {
  name: string;
  manager: Employee | null;
}

const alice: Employee = { name: "Alice", manager: null };
const bob: Employee = { name: "Bob", manager: alice };
const carol: Employee = { name: "Carol", manager: bob };

describe("traceHierarchy", () => {
  it("returns the node followed by each superior up to the root", () => {
    expect(traceHierarchy(carol, "manager")).toEqual([carol, bob, alice]);
  });

  it("returns only the node when it has no superior", () => {
    expect(traceHierarchy(alice, "manager")).toEqual([alice]);
  });

  it("stops at undefined as well as null", () => {
    interface Node {
      parent?: Node;
    }
    const orphan: Node = {};
    const child: Node = { parent: orphan };
    expect(traceHierarchy(child, "parent")).toEqual([child, orphan]);
  });

  it("works with any property key", () => {
    interface Up {
      up: Up | null;
    }
    const root: Up = { up: null };
    const leaf: Up = { up: root };
    expect(traceHierarchy(leaf, "up")).toEqual([leaf, root]);
  });

  it("does not overflow the stack on very deep hierarchies", () => {
    interface Link {
      parent: Link | null;
    }
    let node: Link = { parent: null };
    for (let i = 0; i < 100_000; i++) node = { parent: node };
    expect(traceHierarchy(node, "parent")).toHaveLength(100_001);
  });

  it("throws a RangeError when the hierarchy has a cycle", () => {
    interface Link {
      next: Link | null;
    }
    const a: Link = { next: null };
    const b: Link = { next: a };
    a.next = b;
    expect(() => traceHierarchy(a, "next")).toThrow(RangeError);
    expect(() => traceHierarchy(a, "next")).toThrow(/cycle/i);
  });

  it("throws when a node points to itself", () => {
    interface Link {
      next: Link | null;
    }
    const self: Link = { next: null };
    self.next = self;
    expect(() => traceHierarchy(self, "next")).toThrow(RangeError);
  });

  it("returns an array of the node type", () => {
    expectTypeOf(traceHierarchy(carol, "manager")).toEqualTypeOf<Employee[]>();
  });
});
