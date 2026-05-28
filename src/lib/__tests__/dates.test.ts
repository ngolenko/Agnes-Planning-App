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

describe("getWorkingDaysInMonth with country", () => {
  it("DE January 2026 has 20 working days (22 weekdays minus Jan 1 Thu + Jan 6 Tue)", () => {
    // 22 weekdays minus New Year (Thu Jan 1) and Epiphany (Tue Jan 6, Bavarian)
    expect(getWorkingDaysInMonth(2026, 0, "DE")).toBe(20);
  });

  it("DE June 2026 has 21 working days (22 weekdays minus Corpus Christi Thu Jun 4)", () => {
    // Bavarian holiday — was the user-reported bug before the fix.
    expect(getWorkingDaysInMonth(2026, 5, "DE")).toBe(21);
  });

  it("RO June 2026 has 21 working days (22 weekdays minus Children's Day Mon Jun 1)", () => {
    expect(getWorkingDaysInMonth(2026, 5, "RO")).toBe(21);
  });

  it("RO January 2026 has 20 working days (22 weekdays minus 2 holidays: Jan 1 Thu, Jan 2 Fri)", () => {
    // Jan 24 is Saturday so not counted
    expect(getWorkingDaysInMonth(2026, 0, "RO")).toBe(20);
  });

  it("without country parameter returns plain weekday count (backward compatible)", () => {
    expect(getWorkingDaysInMonth(2026, 0)).toBe(22);
  });

  it("DE April 2026 has 20 working days (22 weekdays minus Good Friday Apr 3 and Easter Monday Apr 6)", () => {
    expect(getWorkingDaysInMonth(2026, 3, "DE")).toBe(20);
  });

  it("RO April 2026 has 20 working days (22 weekdays minus Orthodox Good Friday Apr 10 and Orthodox Easter Monday Apr 13)", () => {
    expect(getWorkingDaysInMonth(2026, 3, "RO")).toBe(20);
  });

  it("DE and RO have same count for months with no holidays", () => {
    // February 2026 has no holidays for either country
    expect(getWorkingDaysInMonth(2026, 1, "DE")).toBe(20);
    expect(getWorkingDaysInMonth(2026, 1, "RO")).toBe(20);
  });

  it("DE October 2026 has 22 working days (Oct 3 is Saturday)", () => {
    expect(getWorkingDaysInMonth(2026, 9, "DE")).toBe(22);
  });

  it("DE October 2025 has 22 working days (Oct 3 is Friday, so 23 weekdays minus 1)", () => {
    expect(getWorkingDaysInMonth(2025, 9, "DE")).toBe(22);
  });
});

describe("getWorkingDaysInWeek with country", () => {
  it("DE week of Apr 6 2026 has 4 working days (Easter Monday Apr 6 is holiday)", () => {
    const weekStart = new Date(2026, 3, 6); // Mon Apr 6
    expect(getWorkingDaysInWeek(weekStart, 2026, 3, "DE")).toBe(4);
  });

  it("RO week of Apr 13 2026 has 4 working days (Orthodox Easter Monday Apr 13 is holiday)", () => {
    const weekStart = new Date(2026, 3, 13); // Mon Apr 13
    expect(getWorkingDaysInWeek(weekStart, 2026, 3, "RO")).toBe(4);
  });

  it("without country returns full 5 for a week with no holidays", () => {
    const weekStart = new Date(2026, 1, 9); // Mon Feb 9
    expect(getWorkingDaysInWeek(weekStart, 2026, 1)).toBe(5);
  });
});
