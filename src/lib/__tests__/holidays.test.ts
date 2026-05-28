import { describe, it, expect } from "vitest";
import { getPublicHolidaysInMonth, PUBLIC_HOLIDAYS } from "../holidays";

describe("PUBLIC_HOLIDAYS", () => {
  it("DE has 13 holidays per year (Bavaria: 9 federal + 4 state)", () => {
    expect(PUBLIC_HOLIDAYS.DE[2025].length).toBe(13);
    expect(PUBLIC_HOLIDAYS.DE[2026].length).toBe(13);
    expect(PUBLIC_HOLIDAYS.DE[2027].length).toBe(13);
  });

  it("DE includes Bavarian-specific holidays", () => {
    const names2026 = PUBLIC_HOLIDAYS.DE[2026].map((h) => h.name);
    expect(names2026).toContain("Epiphany");
    expect(names2026).toContain("Corpus Christi");
    expect(names2026).toContain("Assumption of Mary");
    expect(names2026).toContain("All Saints' Day");
  });

  it("DE Corpus Christi 2026 falls on Thursday June 4 (Easter Apr 5 + 60 days)", () => {
    const corpus = PUBLIC_HOLIDAYS.DE[2026].find((h) => h.name === "Corpus Christi");
    expect(corpus).toBeDefined();
    expect(corpus!.month).toBe(5); // June
    expect(corpus!.day).toBe(4);
  });

  it("RO has 15 holidays per year", () => {
    expect(PUBLIC_HOLIDAYS.RO[2025].length).toBe(15);
    expect(PUBLIC_HOLIDAYS.RO[2026].length).toBe(15);
    expect(PUBLIC_HOLIDAYS.RO[2027].length).toBe(15);
  });

  it("DE Easter 2025 is April 20 (Western)", () => {
    const easterMonday = PUBLIC_HOLIDAYS.DE[2025].find((h) => h.name === "Easter Monday");
    expect(easterMonday).toBeDefined();
    expect(easterMonday!.month).toBe(3); // April (0-indexed)
    expect(easterMonday!.day).toBe(21);
  });

  it("RO Easter 2025 is April 20 (Orthodox, same as Western in 2025)", () => {
    const easterMonday = PUBLIC_HOLIDAYS.RO[2025].find((h) => h.name === "Orthodox Easter Monday");
    expect(easterMonday).toBeDefined();
    expect(easterMonday!.month).toBe(3); // April
    expect(easterMonday!.day).toBe(21);
  });

  it("DE Easter 2026 is April 5 (Western)", () => {
    const easterMonday = PUBLIC_HOLIDAYS.DE[2026].find((h) => h.name === "Easter Monday");
    expect(easterMonday).toBeDefined();
    expect(easterMonday!.month).toBe(3); // April
    expect(easterMonday!.day).toBe(6);
  });

  it("RO Easter 2026 is April 12 (Orthodox)", () => {
    const easterMonday = PUBLIC_HOLIDAYS.RO[2026].find((h) => h.name === "Orthodox Easter Monday");
    expect(easterMonday).toBeDefined();
    expect(easterMonday!.month).toBe(3); // April
    expect(easterMonday!.day).toBe(13);
  });

  it("DE Easter 2027 is March 28 (Western)", () => {
    const easterMonday = PUBLIC_HOLIDAYS.DE[2027].find((h) => h.name === "Easter Monday");
    expect(easterMonday).toBeDefined();
    expect(easterMonday!.month).toBe(2); // March
    expect(easterMonday!.day).toBe(29);
  });

  it("RO Easter 2027 is May 2 (Orthodox)", () => {
    const easterMonday = PUBLIC_HOLIDAYS.RO[2027].find((h) => h.name === "Orthodox Easter Monday");
    expect(easterMonday).toBeDefined();
    expect(easterMonday!.month).toBe(4); // May
    expect(easterMonday!.day).toBe(3);
  });
});

describe("getPublicHolidaysInMonth", () => {
  it("DE January 2026 has 2 weekday holidays (New Year Thu + Epiphany Tue)", () => {
    const holidays = getPublicHolidaysInMonth("DE", 2026, 0);
    expect(holidays.length).toBe(2);
    expect(holidays.map((h) => h.name).sort()).toEqual(["Epiphany", "New Year's Day"]);
  });

  it("DE June 2026 has 1 weekday holiday (Corpus Christi Thu Jun 4)", () => {
    const holidays = getPublicHolidaysInMonth("DE", 2026, 5);
    expect(holidays.length).toBe(1);
    expect(holidays[0].name).toBe("Corpus Christi");
  });

  it("RO January 2026 has 2 weekday holidays (Jan 1 Thu, Jan 2 Fri, Jan 24 Sat)", () => {
    const holidays = getPublicHolidaysInMonth("RO", 2026, 0);
    // Jan 1 = Thursday, Jan 2 = Friday, Jan 24 = Saturday (excluded)
    expect(holidays.length).toBe(2);
  });

  it("DE October 2026 has 0 weekday holidays (Oct 3 is Saturday)", () => {
    const holidays = getPublicHolidaysInMonth("DE", 2026, 9);
    expect(holidays.length).toBe(0);
  });

  it("DE October 2025 has 1 weekday holiday (Oct 3 is Friday)", () => {
    const holidays = getPublicHolidaysInMonth("DE", 2025, 9);
    expect(holidays.length).toBe(1);
  });

  it("DE April 2026 has 2 weekday holidays (Good Friday Apr 3, Easter Monday Apr 6)", () => {
    const holidays = getPublicHolidaysInMonth("DE", 2026, 3);
    expect(holidays.length).toBe(2);
    expect(holidays.map((h) => h.name).sort()).toEqual(["Easter Monday", "Good Friday"]);
  });

  it("DE December 2025 has 2 weekday holidays (Dec 25 Thu, Dec 26 Fri)", () => {
    const holidays = getPublicHolidaysInMonth("DE", 2025, 11);
    expect(holidays.length).toBe(2);
  });

  it("returns empty array for months with no holidays", () => {
    const holidays = getPublicHolidaysInMonth("DE", 2026, 1); // February
    expect(holidays.length).toBe(0);
  });
});
