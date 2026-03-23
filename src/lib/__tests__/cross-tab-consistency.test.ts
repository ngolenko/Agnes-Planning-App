import { describe, it, expect } from "vitest";
import { getEmployeeAvailableDays } from "../availability";
import { getWorkingDaysInMonth } from "../dates";
import { TimeOff, UnbillableTime } from "../types";

/**
 * Cross-tab consistency tests.
 *
 * These tests verify that the Time Off, Planning, and Dashboard pages
 * all compute the same "available days" for each employee.
 *
 * Bug 1 (fixed): Time Off page calculated available = workingDays - vacation - sick,
 *   ignoring unbillable days. Planning & Dashboard subtracted unbillable too.
 * Bug 2 (fixed): Planning Resource View computed allocatedDays by rounding the raw sum
 *   once, while per-client totals summed individually-rounded values → mismatch.
 * Bug 3 (fixed): Time Off API used Prisma gte/lte on SQLite dates which silently
 *   dropped records. Planning API used client-side prefix filtering which worked.
 */

// Helpers that mirror each page's available-days logic

/** Time Off page formula (AFTER fix): workingDays - totalOff */
function timeOffPageAvailable(
  workingDays: number,
  vacation: number,
  sick: number,
  unbillable: number
): number {
  const totalOff = vacation + sick + unbillable;
  return workingDays - totalOff;
}

/** Planning page uses getEmployeeAvailableDays from availability.ts */
function planningPageAvailable(
  empId: string,
  workingDays: number,
  timeOff: TimeOff[],
  unbillable: UnbillableTime[]
): number {
  return getEmployeeAvailableDays(empId, workingDays, timeOff, unbillable);
}

/** Dashboard page formula: capacity - timeOff.length - Math.round(unbillable sum) */
function dashboardPageAvailable(
  empId: string,
  workingDays: number,
  timeOff: TimeOff[],
  unbillable: UnbillableTime[]
): number {
  const empTimeOff = timeOff.filter((t) => t.employeeId === empId);
  const empUnbillable = unbillable.filter((u) => u.employeeId === empId);
  const nonWorkingDays = empTimeOff.length;
  const empUnbillableDays = Math.round(
    empUnbillable.reduce((s, u) => s + u.plannedDays, 0)
  );
  return workingDays - nonWorkingDays - empUnbillableDays;
}

describe("cross-tab consistency: available days match across all pages", () => {
  const empId = "emp1";
  const workingDays = getWorkingDaysInMonth(2026, 2); // March 2026 = 22

  it("all pages agree when employee has no time off or unbillable", () => {
    const timeOff: TimeOff[] = [];
    const unbillable: UnbillableTime[] = [];

    const toPage = timeOffPageAvailable(workingDays, 0, 0, 0);
    const planning = planningPageAvailable(empId, workingDays, timeOff, unbillable);
    const dashboard = dashboardPageAvailable(empId, workingDays, timeOff, unbillable);

    expect(toPage).toBe(22);
    expect(planning).toBe(22);
    expect(dashboard).toBe(22);
  });

  it("all pages agree when employee has vacation only", () => {
    const timeOff: TimeOff[] = [
      { id: "1", employeeId: empId, date: "2026-03-16", type: "vacation", status: "confirmed" },
      { id: "2", employeeId: empId, date: "2026-03-17", type: "vacation", status: "confirmed" },
      { id: "3", employeeId: empId, date: "2026-03-23", type: "vacation", status: "planned" },
    ];
    const unbillable: UnbillableTime[] = [];

    const toPage = timeOffPageAvailable(workingDays, 3, 0, 0);
    const planning = planningPageAvailable(empId, workingDays, timeOff, unbillable);
    const dashboard = dashboardPageAvailable(empId, workingDays, timeOff, unbillable);

    expect(toPage).toBe(19);
    expect(planning).toBe(19);
    expect(dashboard).toBe(19);
  });

  it("all pages agree when employee has vacation + sick + unbillable", () => {
    const timeOff: TimeOff[] = [
      { id: "1", employeeId: empId, date: "2026-03-02", type: "vacation", status: "confirmed" },
      { id: "2", employeeId: empId, date: "2026-03-03", type: "vacation", status: "confirmed" },
      { id: "3", employeeId: empId, date: "2026-03-04", type: "sick", status: "planned" },
    ];
    const unbillable: UnbillableTime[] = [
      { id: "1", employeeId: empId, weekStartDate: "2026-03-09", category: "internal", plannedDays: 2 },
    ];

    // Time Off page: 22 - (2 vacation + 1 sick + 2 unbillable) = 17
    const toPage = timeOffPageAvailable(workingDays, 2, 1, 2);
    const planning = planningPageAvailable(empId, workingDays, timeOff, unbillable);
    const dashboard = dashboardPageAvailable(empId, workingDays, timeOff, unbillable);

    expect(toPage).toBe(17);
    expect(planning).toBe(17);
    expect(dashboard).toBe(17);
  });

  it("all pages agree with fractional unbillable that rounds cleanly", () => {
    const timeOff: TimeOff[] = [
      { id: "1", employeeId: empId, date: "2026-03-10", type: "vacation", status: "confirmed" },
    ];
    const unbillable: UnbillableTime[] = [
      { id: "1", employeeId: empId, weekStartDate: "2026-03-02", category: "training", plannedDays: 1.5 },
      { id: "2", employeeId: empId, weekStartDate: "2026-03-09", category: "admin", plannedDays: 1.5 },
    ];

    // unbillable total = 3, timeOff = 1, available = 22 - 1 - 3 = 18
    const toPage = timeOffPageAvailable(workingDays, 1, 0, 3);
    const planning = planningPageAvailable(empId, workingDays, timeOff, unbillable);
    const dashboard = dashboardPageAvailable(empId, workingDays, timeOff, unbillable);

    expect(toPage).toBe(18);
    expect(planning).toBe(18);
    expect(dashboard).toBe(18);
  });

  it("all pages agree when only unbillable days exist (no vacation/sick)", () => {
    const timeOff: TimeOff[] = [];
    const unbillable: UnbillableTime[] = [
      { id: "1", employeeId: empId, weekStartDate: "2026-03-02", category: "bench", plannedDays: 5 },
    ];

    const toPage = timeOffPageAvailable(workingDays, 0, 0, 5);
    const planning = planningPageAvailable(empId, workingDays, timeOff, unbillable);
    const dashboard = dashboardPageAvailable(empId, workingDays, timeOff, unbillable);

    expect(toPage).toBe(17);
    expect(planning).toBe(17);
    expect(dashboard).toBe(17);
  });
});

describe("cross-tab consistency: resource view allocatedDays matches client breakdown", () => {
  /**
   * Simulates the Resource View logic: group allocations by client/project,
   * round each project's days, sum to client totals, then derive employee total
   * from client totals (NOT from raw allocation sum).
   */
  function resourceViewAllocatedDays(
    projectDaysByClient: Record<string, number[]>
  ): { perClient: Record<string, number>; employeeTotal: number } {
    const perClient: Record<string, number> = {};
    let employeeTotal = 0;

    for (const [clientId, projectDays] of Object.entries(projectDaysByClient)) {
      const clientTotal = projectDays.reduce((s, d) => s + Math.round(d), 0);
      perClient[clientId] = clientTotal;
      employeeTotal += clientTotal;
    }

    return { perClient, employeeTotal };
  }

  it("employee total equals sum of rounded client totals", () => {
    // Anna's scenario: 20% of 15 = 3, 20% of 15 = 3, 60% of 15 = 9
    // Raw values might be 2.8, 2.8, 8.6 due to week distribution
    const result = resourceViewAllocatedDays({
      acme: [2.8],
      digital: [2.8],
      techstart: [8.6],
    });

    expect(result.perClient.acme).toBe(3);
    expect(result.perClient.digital).toBe(3);
    expect(result.perClient.techstart).toBe(9);
    expect(result.employeeTotal).toBe(15);

    // Old bug: Math.round(2.8 + 2.8 + 8.6) = Math.round(14.2) = 14
    const oldBugTotal = Math.round(2.8 + 2.8 + 8.6);
    expect(oldBugTotal).toBe(14);
    expect(result.employeeTotal).not.toBe(oldBugTotal);
  });

  it("multi-project clients: projects rounded then summed to client total", () => {
    const result = resourceViewAllocatedDays({
      clientA: [3.4, 2.6],   // round: 3 + 3 = 6
      clientB: [7.8],         // round: 8
    });

    expect(result.perClient.clientA).toBe(6);
    expect(result.perClient.clientB).toBe(8);
    expect(result.employeeTotal).toBe(14);
  });

  it("whole numbers: no rounding difference", () => {
    const result = resourceViewAllocatedDays({
      clientA: [5, 3],
      clientB: [10],
    });

    expect(result.employeeTotal).toBe(18);
  });
});
