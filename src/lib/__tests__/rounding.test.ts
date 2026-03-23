import { describe, it, expect } from "vitest";

/**
 * Tests for the "round per-project, then sum" pattern used by
 * Planning (planning-grid.tsx) and Dashboard (dashboard/page.tsx).
 *
 * The bug: rounding the raw sum once (Math.round(2.8+2.8+8.6) = 14)
 * gives a different result than summing individually-rounded values
 * (3+3+9 = 15). The UI now uses the latter approach everywhere.
 */

function roundThenSum(values: number[]): number {
  return values.reduce((s, v) => s + Math.round(v), 0);
}

function sumThenRound(values: number[]): number {
  return Math.round(values.reduce((s, v) => s + v, 0));
}

describe("rounding consistency: round-then-sum vs sum-then-round", () => {
  it("fractional values that diverge: 2.8 + 2.8 + 8.6", () => {
    const values = [2.8, 2.8, 8.6];
    // round-then-sum: 3 + 3 + 9 = 15 (what the UI shows)
    expect(roundThenSum(values)).toBe(15);
    // sum-then-round: round(14.2) = 14 (the old bug)
    expect(sumThenRound(values)).toBe(14);
    // They differ — our fix picks round-then-sum
    expect(roundThenSum(values)).not.toBe(sumThenRound(values));
  });

  it("whole values: both approaches agree", () => {
    const values = [3, 3, 9];
    expect(roundThenSum(values)).toBe(15);
    expect(sumThenRound(values)).toBe(15);
  });

  it("many small fractions that each round to 0", () => {
    const values = [0.4, 0.4, 0.4, 0.4, 0.4];
    // round-then-sum: 0+0+0+0+0 = 0
    expect(roundThenSum(values)).toBe(0);
    // sum-then-round: round(2.0) = 2
    expect(sumThenRound(values)).toBe(2);
  });

  it("values at .5 boundary round up with Math.round", () => {
    const values = [2.5, 3.5];
    // round-then-sum: 3 + 4 = 7
    expect(roundThenSum(values)).toBe(7);
    // sum-then-round: round(6.0) = 6
    expect(sumThenRound(values)).toBe(6);
  });

  it("single value: both approaches agree", () => {
    expect(roundThenSum([7.3])).toBe(sumThenRound([7.3]));
    expect(roundThenSum([7.3])).toBe(7);
  });

  it("empty array: both return 0", () => {
    expect(roundThenSum([])).toBe(0);
    expect(sumThenRound([])).toBe(0);
  });
});

describe("nested rounding: projects → clients → employee total", () => {
  it("employee total equals sum of client totals, each from rounded projects", () => {
    // Simulate: 2 clients, each with 2 projects
    const client1Projects = [2.8, 4.3]; // round: 3 + 4 = 7
    const client2Projects = [1.6, 3.7]; // round: 2 + 4 = 6

    const client1Total = roundThenSum(client1Projects);
    const client2Total = roundThenSum(client2Projects);
    const employeeTotal = client1Total + client2Total;

    expect(client1Total).toBe(7);
    expect(client2Total).toBe(6);
    expect(employeeTotal).toBe(13);

    // Old approach: round(2.8+4.3+1.6+3.7) = round(12.4) = 12
    const allRaw = [...client1Projects, ...client2Projects];
    expect(sumThenRound(allRaw)).toBe(12);

    // Our fix gives 13, not 12
    expect(employeeTotal).not.toBe(sumThenRound(allRaw));
  });
});
