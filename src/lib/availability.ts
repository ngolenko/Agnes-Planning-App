import { TimeOff, UnbillableTime } from "./types";

/**
 * Calculate available working days for an employee in a month.
 * Available = workingDays - timeOffDays - unbillableDays
 */
export function getEmployeeAvailableDays(
  employeeId: string,
  workingDays: number,
  timeOff: TimeOff[],
  unbillable: UnbillableTime[]
): number {
  const timeOffDays = timeOff.filter((t) => t.employeeId === employeeId).length;
  const unbillableDays = unbillable
    .filter((u) => u.employeeId === employeeId)
    .reduce((s, u) => s + u.plannedDays, 0);
  return workingDays - timeOffDays - unbillableDays;
}

/**
 * Convert a percentage (0-100) to whole days.
 * Uses standard rounding: 3.6 → 4, 3.4 → 3
 */
export function percentageToDays(percentage: number, availableDays: number): number {
  if (availableDays <= 0 || percentage <= 0) return 0;
  return Math.round((percentage / 100) * availableDays);
}

/**
 * Convert days to a percentage (0-100).
 * Returns rounded percentage.
 */
export function daysToPercentage(days: number, availableDays: number): number {
  if (availableDays <= 0) return 0;
  return Math.round((days / availableDays) * 100);
}
