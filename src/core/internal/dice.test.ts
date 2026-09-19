import { describe, expect, it } from "vitest";
import { parseDice, parseDiceCached, rollTerms } from "./dice";

/** A die that always shows its highest face. */
const highest = (sides: number) => sides;

describe("parseDice", () => {
  it("reads NdM", () => {
    expect(parseDice("2d6")).toEqual([{ sign: 1, count: 2, sides: 6 }]);
  });

  it("defaults the count to 1", () => {
    expect(parseDice("d20")).toEqual([{ sign: 1, count: 1, sides: 20 }]);
  });

  it("reads keep-highest and keep-lowest", () => {
    expect(parseDice("4d6kh3")).toEqual([
      { sign: 1, count: 4, sides: 6, keep: { highest: true, count: 3 } },
    ]);
    expect(parseDice("2d20kl1")).toEqual([
      { sign: 1, count: 2, sides: 20, keep: { highest: false, count: 1 } },
    ]);
  });

  it("reads constants and signs", () => {
    expect(parseDice("1d8+1d6-1")).toEqual([
      { sign: 1, count: 1, sides: 8 },
      { sign: 1, count: 1, sides: 6 },
      { sign: -1, constant: 1 },
    ]);
    expect(parseDice("-1d4+10")).toEqual([
      { sign: -1, count: 1, sides: 4 },
      { sign: 1, constant: 10 },
    ]);
  });

  it("ignores spaces and letter case", () => {
    expect(parseDice(" 2D6 + 3 ")).toEqual(parseDice("2d6+3"));
    expect(parseDice("4D6KH3")).toEqual(parseDice("4d6kh3"));
  });

  it("rejects notations it cannot read, pointing at the bad part", () => {
    expect(() => parseDice("")).toThrow(RangeError);
    expect(() => parseDice("   ")).toThrow(RangeError);
    expect(() => parseDice("2d")).toThrow('cannot read "2d"');
    expect(() => parseDice("abc")).toThrow('cannot read "abc"');
    expect(() => parseDice("2d6+")).toThrow(RangeError);
    expect(() => parseDice("2d6++1")).toThrow(RangeError);
    expect(() => parseDice("2d6x3")).toThrow('cannot read "2d6x3"');
  });

  it("rejects impossible dice", () => {
    expect(() => parseDice("0d6")).toThrow("at least one die");
    expect(() => parseDice("2d0")).toThrow("at least 1 side");
    expect(() => parseDice("2d6kh3")).toThrow("cannot keep 3 of 2");
    expect(() => parseDice("2d6kh0")).toThrow("keep at least one");
  });

  it("caps the total number of dice", () => {
    expect(() => parseDice("1000d6")).not.toThrow();
    expect(() => parseDice("1001d6")).toThrow("at most 1000 dice");
    expect(() => parseDice("600d6+600d6")).toThrow("at most 1000 dice");
  });

  it("caps the number of sides and the size of constants", () => {
    expect(() => parseDice("1d1000000000")).not.toThrow();
    expect(() => parseDice("1d1000000001")).toThrow("sides");
    expect(() => parseDice("99999999999999999999")).toThrow(RangeError);
  });
});

describe("rollTerms", () => {
  it("sums the dice and the constants", () => {
    expect(rollTerms(parseDice("2d6+3"), highest)).toBe(15);
    expect(rollTerms(parseDice("1d8+1d6+2"), highest)).toBe(16);
  });

  it("subtracts terms with a minus sign", () => {
    expect(rollTerms(parseDice("1d20-1d4-3"), highest)).toBe(13);
  });

  it("keeps the highest or lowest dice", () => {
    let next = 0;
    const faces = [5, 2, 6, 1];
    const sequence = () => faces[next++ % faces.length] as number;
    expect(rollTerms(parseDice("4d6kh3"), sequence)).toBe(13); // 5 + 6 + 2
    next = 0;
    expect(rollTerms(parseDice("4d6kl2"), sequence)).toBe(3); // 1 + 2
  });

  it("rolls each die separately, passing the number of sides", () => {
    const seen: number[] = [];
    rollTerms(parseDice("2d6+1d20"), (sides) => {
      seen.push(sides);
      return 1;
    });
    expect(seen).toEqual([6, 6, 20]);
  });
});

describe("parseDiceCached", () => {
  it("returns the same terms as parseDice, and the very same object for a repeated notation", () => {
    expect(parseDiceCached("2d6+3")).toEqual(parseDice("2d6+3"));
    expect(parseDiceCached("2d6+3")).toBe(parseDiceCached("2d6+3"));
  });

  it("keeps working, and stays correct, past its size limit", () => {
    for (let sides = 2; sides < 400; sides++) {
      expect(parseDiceCached(`1d${sides}`)).toEqual([{ sign: 1, count: 1, sides }]);
    }
    expect(parseDiceCached("1d2")).toEqual([{ sign: 1, count: 1, sides: 2 }]);
  });

  it("does not remember notations it could not read", () => {
    expect(() => parseDiceCached("2d")).toThrow(RangeError);
    expect(() => parseDiceCached("2d")).toThrow(RangeError);
  });
});
