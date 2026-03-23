import { describe, it, expect } from "vitest";
import {
  getWorkingDaysInMonth,
  getWorkingDaysInWeek,
  getWeekStartDate,
} from "../dates";

describe("getWorkingDaysInMonth", () => {
  it("March 2026 has 22 working days", () => {
    expect(getWorkingDaysInMonth(2026, 2)).toBe(22);
  });

  it("February 2026 has 20 working days", () => {
    expect(getWorkingDaysInMonth(2026, 1)).toBe(20);
  });

  it("January 2026 has 22 working days", () => {
    expect(getWorkingDaysInMonth(2026, 0)).toBe(22);
  });

  it("April 2026 has 22 working days", () => {
    expect(getWorkingDaysInMonth(2026, 3)).toBe(22);
  });

  it("February in a leap year (2028) has 21 working days", () => {
    expect(getWorkingDaysInMonth(2028, 1)).toBe(21);
  });
});

describe("getWeekStartDate", () => {
  it("returns Monday for a Monday input", () => {
    const monday = new Date(2026, 2, 2); // March 2, 2026 is Monday
    const result = getWeekStartDate(monday);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(2);
  });

  it("returns Monday for a Wednesday input", () => {
    const wed = new Date(2026, 2, 4); // March 4, 2026 is Wednesday
    const result = getWeekStartDate(wed);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(2); // Back to Monday March 2
  });

  it("returns Monday for a Sunday input", () => {
    const sun = new Date(2026, 2, 8); // March 8, 2026 is Sunday
    const result = getWeekStartDate(sun);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(2); // Back to Monday March 2
  });

  it("returns Monday for a Friday input", () => {
    const fri = new Date(2026, 2, 6); // March 6, 2026 is Friday
    const result = getWeekStartDate(fri);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(2);
  });
});

describe("getWorkingDaysInWeek", () => {
  it("full week within month returns 5", () => {
    const weekStart = new Date(2026, 2, 9); // Mon March 9
    expect(getWorkingDaysInWeek(weekStart, 2026, 2)).toBe(5);
  });

  it("partial week at start of month", () => {
    // March 2026 starts on Sunday, so week starting Feb 23 has 0 March days
    const weekStart = new Date(2026, 1, 23); // Mon Feb 23
    expect(getWorkingDaysInWeek(weekStart, 2026, 2)).toBe(0);
  });

  it("week starting March 30 has only 2 working days in March", () => {
    const weekStart = new Date(2026, 2, 30); // Mon March 30
    // March 30 (Mon) and March 31 (Tue) are in March; Wed-Fri are April
    expect(getWorkingDaysInWeek(weekStart, 2026, 2)).toBe(2);
  });
});
