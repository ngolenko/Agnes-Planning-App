import { getPublicHolidaysInMonth } from "./holidays";
import { CountryCode } from "./types";

export function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getMonthWeeks(year: number, month: number): Date[] {
  const weeks: Date[] = [];
  const firstDay = new Date(year, month, 1);
  let weekStart = getWeekStartDate(firstDay);

  // Include the week that contains the 1st of the month
  while (weekStart.getMonth() <= month && weekStart.getFullYear() === year ||
         (weekStart.getMonth() === 11 && month === 0 && weekStart.getFullYear() === year - 1)) {
    weeks.push(new Date(weekStart));
    weekStart.setDate(weekStart.getDate() + 7);

    // Stop if we've gone past the month
    if (weekStart.getMonth() > month && weekStart.getFullYear() >= year) break;
    if (weekStart.getFullYear() > year) break;
  }

  return weeks;
}

export function getWorkingDaysInMonth(year: number, month: number, country?: CountryCode): number {
  let count = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  if (country) {
    const holidays = getPublicHolidaysInMonth(country, year, month);
    count -= holidays.length;
  }
  return count;
}

export function formatMonthYear(year: number, month: number): string {
  return new Date(year, month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function getWeeksInMonth(year: number, month: number): Date[] {
  const weeks: Date[] = [];
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  let current = getWeekStartDate(firstOfMonth);

  while (current <= lastOfMonth) {
    weeks.push(new Date(current));
    current = new Date(current);
    current.setDate(current.getDate() + 7);
  }

  return weeks;
}

export function getWorkingDaysInWeek(weekStart: Date, year: number, month: number, country?: CountryCode): number {
  let count = 0;
  const holidays = country ? getPublicHolidaysInMonth(country, year, month) : [];
  for (let i = 0; i < 5; i++) { // Mon-Fri
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    if (d.getMonth() === month && d.getFullYear() === year) {
      // Check if this day is a public holiday
      const isHoliday = holidays.some((h) => h.month === d.getMonth() && h.day === d.getDate());
      if (!isHoliday) {
        count++;
      }
    }
  }
  return count;
}
