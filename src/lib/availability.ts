import { TimeOff, UnbillableTime } from "./types";

// TimeOff stores one row per calendar day. For a part-timer, one calendar day off
// only costs `weeklyCapacityDays / 5` work-days of capacity — without this scaling,
// availability is overcounted for part-timers (e.g. Masha at 2.5d/week).
export function getEmployeeTimeOffWorkDays(
  employeeId: string,
  timeOff: TimeOff[],
  weeklyCapacityDays: number = 5
): number {
  const calendarDays = timeOff.filter((t) => t.employeeId === employeeId).length;
  return calendarDays * (weeklyCapacityDays / 5);
}

export function getEmployeeAvailableDays(
  employeeId: string,
  workingDays: number,
  timeOff: TimeOff[],
  unbillable: UnbillableTime[],
  weeklyCapacityDays: number = 5
): number {
  const timeOffDays = getEmployeeTimeOffWorkDays(employeeId, timeOff, weeklyCapacityDays);
  const unbillableDays = unbillable
    .filter((u) => u.employeeId === employeeId)
    .reduce((s, u) => s + u.plannedDays, 0);
  return workingDays - timeOffDays - unbillableDays;
}

// Returns fractional days. Rounding to integer days was the source of the 70%→72%
// drift bug: for an 11-day part-timer, 70% × 11 = 7.7 → rounded to 8 → re-derived
// as 8/11 = 72.7% → 73%.
export function percentageToDays(percentage: number, availableDays: number): number {
  if (availableDays <= 0 || percentage <= 0) return 0;
  return (percentage / 100) * availableDays;
}

export function daysToPercentage(days: number, availableDays: number): number {
  if (availableDays <= 0) return 0;
  return Math.round((days / availableDays) * 100);
}

// "8" for 8.0, "8.5" for 8.5 — keeps integer days clean and shows one decimal otherwise.
export function formatDays(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
