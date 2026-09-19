import { beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import { alias } from "./alias";

describe("alias", () => {
  interface Person {
    name: string;
    age: number;
    city?: string;
  }

  const model: Person = { name: "Alice", age: 30 };
  const aliasDictionary = {
    name: ["aliasName"] as const,
    age: ["years", "old"] as const,
  };

  let person: Person;
  let aliased: Person & { aliasName: string; years: number; old: number };

  beforeEach(() => {
    person = { ...model };
    aliased = alias(person, aliasDictionary);
  });

  it("reads through alias keys", () => {
    expect(aliased.aliasName).toBe("Alice");
    expect(aliased.years).toBe(30);
    expect(aliased.old).toBe(30);
  });

  it("still reads the original keys", () => {
    expect(aliased.name).toBe("Alice");
    expect(aliased.age).toBe(30);
  });

  it("writes through alias keys to the original object", () => {
    aliased.aliasName = "Bob";
    aliased.years = 40;
    expect(person.name).toBe("Bob");
    expect(person.age).toBe(40);
    expect(aliased.name).toBe("Bob");
  });

  it("writes through original keys and reads back through aliases", () => {
    aliased.name = "Charlie";
    aliased.age = 35;
    expect(aliased.aliasName).toBe("Charlie");
    expect(aliased.old).toBe(35);
  });

  it("does not affect non-aliased properties", () => {
    aliased.city = "Wonderland";
    expect(aliased.city).toBe("Wonderland");
    expect(person.city).toBe("Wonderland");
  });

  it("ignores dictionary entries for keys the object does not have", () => {
    const extended = alias(person, { ...aliasDictionary, nonExistent: ["ghost"] as const });
    expect((extended as unknown as Record<string, unknown>).ghost).toBeUndefined();
    expect(extended.name).toBe("Alice");
  });

  it("ignores dictionary entries whose alias list is undefined", () => {
    const partial = alias(person, { name: undefined, age: ["years"] as const });
    expect(partial.years).toBe(30);
    expect(partial.name).toBe("Alice");
  });

  it("passes symbol keys through untouched", () => {
    const tag = Symbol("tag");
    const tagged = Object.assign(person, { [tag]: "hello" });
    const wrapped = alias(tagged, aliasDictionary);
    expect(wrapped[tag]).toBe("hello");
    expect(tag in wrapped).toBe(true);
  });

  it("ignores an alias identical to its own key", () => {
    const same = alias(person, { name: ["name"] as const });
    expect(same.name).toBe("Alice");
  });

  it("does not resolve inherited Object.prototype members as aliases", () => {
    // The legacy implementation looked aliases up in a plain object, so
    // `aliased.toString` found Object.prototype.toString and returned undefined.
    expect(Reflect.get(aliased, "toString")).toBe(Reflect.get(Object.prototype, "toString"));
    expect(Reflect.get(aliased, "constructor")).toBe(Object);
  });

  it("makes aliases visible to the `in` operator", () => {
    expect("aliasName" in aliased).toBe(true);
    expect("name" in aliased).toBe(true);
    expect("nope" in aliased).toBe(false);
  });

  it("deletes the original property when an alias is deleted", () => {
    delete (aliased as Partial<typeof aliased>).aliasName;
    expect("name" in person).toBe(false);
  });

  it("does not list aliases as own keys", () => {
    expect(Object.keys(aliased).sort()).toEqual(["age", "name"]);
  });

  it("throws when the same alias is mapped to two keys", () => {
    expect(() => alias(person, { name: ["x"] as const, age: ["x"] as const })).toThrow(
      /Alias "x" is mapped to both "name" and "age"/,
    );
  });

  it("throws when an alias collides with an existing property", () => {
    expect(() => alias(person, { age: ["name"] as const })).toThrow(/collides/);
    expect(() => alias(person, { age: ["toString"] as const })).toThrow(/collides/);
  });

  it("adds the alias keys to the type", () => {
    expectTypeOf(aliased.aliasName).toEqualTypeOf<string>();
    expectTypeOf(aliased.years).toEqualTypeOf<number>();
  });
});
