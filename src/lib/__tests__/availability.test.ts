import { describe, it, expect } from "vitest";
import {
  getEmployeeAvailableDays,
  percentageToDays,
  daysToPercentage,
} from "../availability";
import { TimeOff, UnbillableTime } from "../types";

describe("getEmployeeAvailableDays", () => {
  const empId = "emp1";

  it("returns full working days when no time off or unbillable", () => {
    expect(getEmployeeAvailableDays(empId, 22, [], [])).toBe(22);
  });

  it("subtracts time off days", () => {
    const timeOff: TimeOff[] = [
      { id: "1", employeeId: empId, date: "2026-03-02", type: "vacation", status: "confirmed" },
      { id: "2", employeeId: empId, date: "2026-03-03", type: "sick", status: "planned" },
    ];
    expect(getEmployeeAvailableDays(empId, 22, timeOff, [])).toBe(20);
  });

  it("subtracts unbillable days", () => {
    const unbillable: UnbillableTime[] = [
      { id: "1", employeeId: empId, weekStartDate: "2026-03-02", category: "internal", plannedDays: 2 },
      { id: "2", employeeId: empId, weekStartDate: "2026-03-09", category: "training", plannedDays: 1 },
    ];
    expect(getEmployeeAvailableDays(empId, 22, [], unbillable)).toBe(19);
  });

  it("subtracts both time off and unbillable", () => {
    const timeOff: TimeOff[] = [
      { id: "1", employeeId: empId, date: "2026-03-02", type: "vacation", status: "confirmed" },
    ];
    const unbillable: UnbillableTime[] = [
      { id: "1", employeeId: empId, weekStartDate: "2026-03-09", category: "admin", plannedDays: 3 },
    ];
    expect(getEmployeeAvailableDays(empId, 22, timeOff, unbillable)).toBe(18);
  });

  it("ignores time off and unbillable for other employees", () => {
    const timeOff: TimeOff[] = [
      { id: "1", employeeId: "other", date: "2026-03-02", type: "vacation", status: "confirmed" },
    ];
    const unbillable: UnbillableTime[] = [
      { id: "1", employeeId: "other", weekStartDate: "2026-03-09", category: "bench", plannedDays: 5 },
    ];
    expect(getEmployeeAvailableDays(empId, 22, timeOff, unbillable)).toBe(22);
  });

  it("can return 0 if all days are off", () => {
    const timeOff: TimeOff[] = Array.from({ length: 22 }, (_, i) => ({
      id: String(i),
      employeeId: empId,
      date: `2026-03-${i + 1}`,
      type: "vacation" as const,
      status: "confirmed" as const,
    }));
    expect(getEmployeeAvailableDays(empId, 22, timeOff, [])).toBe(0);
  });
});

describe("percentageToDays", () => {
  it("converts 80% of 20 days to 16", () => {
    expect(percentageToDays(80, 20)).toBe(16);
  });

  it("converts 100% to full available days", () => {
    expect(percentageToDays(100, 22)).toBe(22);
  });

  it("converts 0% to 0 days", () => {
    expect(percentageToDays(0, 22)).toBe(0);
  });

  it("returns fractional days without rounding (80% of 22 = 17.6)", () => {
    expect(percentageToDays(80, 22)).toBeCloseTo(17.6, 5);
  });

  it("preserves fractional days for a part-timer (70% of 11 = 7.7)", () => {
    // The 70%→72% drift bug: previously this rounded to 8, then 8/11 re-derived as 73%.
    expect(percentageToDays(70, 11)).toBeCloseTo(7.7, 5);
    expect(daysToPercentage(percentageToDays(70, 11), 11)).toBe(70);
  });

  it("returns 0 when available days is 0", () => {
    expect(percentageToDays(80, 0)).toBe(0);
  });

  it("returns 0 when available days is negative", () => {
    expect(percentageToDays(80, -5)).toBe(0);
  });
});

describe("getEmployeeAvailableDays — part-time scaling", () => {
  const empId = "emp1";

  it("scales time off by capacity ratio for a 2.5d/week employee", () => {
    // Masha: 11 work-day capacity, 2 calendar vacation days
    // Old behavior: 11 - 2 = 9 (overcounted — she only loses 1 work-day equivalent)
    // New behavior: 11 - 2*(2.5/5) = 10
    const timeOff: TimeOff[] = [
      { id: "1", employeeId: empId, date: "2026-06-01", type: "vacation", status: "confirmed" },
      { id: "2", employeeId: empId, date: "2026-06-02", type: "vacation", status: "confirmed" },
    ];
    expect(getEmployeeAvailableDays(empId, 11, timeOff, [], 2.5)).toBe(10);
  });

  it("scales time off for a 4d/week employee", () => {
    // Martin: 18-day capacity, 5 calendar days off = 4 work-day equivalent
    const timeOff: TimeOff[] = Array.from({ length: 5 }, (_, i) => ({
      id: String(i), employeeId: empId, date: `2026-06-0${i + 1}`,
      type: "vacation" as const, status: "confirmed" as const,
    }));
    expect(getEmployeeAvailableDays(empId, 18, timeOff, [], 4)).toBe(14);
  });

  it("does not scale unbillable (stored as real work days already)", () => {
    const unbillable: UnbillableTime[] = [
      { id: "1", employeeId: empId, weekStartDate: "2026-06-01", category: "internal", plannedDays: 1 },
    ];
    expect(getEmployeeAvailableDays(empId, 11, [], unbillable, 2.5)).toBe(10);
  });
});

describe("daysToPercentage", () => {
  it("converts 16 days out of 20 to 80%", () => {
    expect(daysToPercentage(16, 20)).toBe(80);
  });

  it("converts 22 out of 22 to 100%", () => {
    expect(daysToPercentage(22, 22)).toBe(100);
  });

  it("converts 0 days to 0%", () => {
    expect(daysToPercentage(0, 20)).toBe(0);
  });

  it("returns 0 when available days is 0", () => {
    expect(daysToPercentage(10, 0)).toBe(0);
  });

  it("rounds percentage to nearest integer", () => {
    // 7/22 = 31.818... → 32%
    expect(daysToPercentage(7, 22)).toBe(32);
  });
});
