import { CountryCode } from "./types";

interface Holiday {
  month: number; // 0-indexed
  day: number;
  name: string;
}

type HolidayMap = Record<string, Holiday[]>; // key: "DE" or "RO", then by year

// Western Easter dates (Gregorian)
// 2025: Apr 20, 2026: Apr 5, 2027: Mar 28
// Orthodox Easter dates
// 2025: Apr 20, 2026: Apr 12, 2027: May 2

function westernEaster(year: number): { month: number; day: number } {
  // Anonymous Gregorian algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month: month - 1, day }; // convert to 0-indexed month
}

function orthodoxEaster(year: number): { month: number; day: number } {
  // Meeus's Julian algorithm, then convert to Gregorian
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31); // Julian month (3=March, 4=April)
  const day = ((d + e + 114) % 31) + 1;

  // Convert Julian date to Gregorian by adding 13 days (for 1900-2099)
  const julianDate = new Date(year, month - 1, day + 13);
  return { month: julianDate.getMonth(), day: julianDate.getDate() };
}

function addDays(m: number, d: number, offset: number): { month: number; day: number } {
  const date = new Date(2000, m, d + offset);
  return { month: date.getMonth(), day: date.getDate() };
}

// DE holidays = federal holidays + Bavarian state holidays (MultiBase is in Bavaria).
function getDeHolidays(year: number): Holiday[] {
  const easter = westernEaster(year);
  const goodFriday = addDays(easter.month, easter.day, -2);
  const easterMonday = addDays(easter.month, easter.day, 1);
  const ascension = addDays(easter.month, easter.day, 39);
  const whitMonday = addDays(easter.month, easter.day, 50);
  const corpusChristi = addDays(easter.month, easter.day, 60);

  return [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 0, day: 6, name: "Epiphany" },
    { month: goodFriday.month, day: goodFriday.day, name: "Good Friday" },
    { month: easterMonday.month, day: easterMonday.day, name: "Easter Monday" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: ascension.month, day: ascension.day, name: "Ascension Day" },
    { month: whitMonday.month, day: whitMonday.day, name: "Whit Monday" },
    { month: corpusChristi.month, day: corpusChristi.day, name: "Corpus Christi" },
    { month: 7, day: 15, name: "Assumption of Mary" },
    { month: 9, day: 3, name: "German Unity Day" },
    { month: 10, day: 1, name: "All Saints' Day" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 26, name: "2nd Day of Christmas" },
  ];
}

function getRoHolidays(year: number): Holiday[] {
  const easter = orthodoxEaster(year);
  const goodFriday = addDays(easter.month, easter.day, -2);
  const easterSunday = { month: easter.month, day: easter.day };
  const easterMonday = addDays(easter.month, easter.day, 1);
  const whitSunday = addDays(easter.month, easter.day, 49);
  const whitMonday = addDays(easter.month, easter.day, 50);

  return [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 0, day: 2, name: "New Year's Day (2nd)" },
    { month: 0, day: 24, name: "Unification Day" },
    { month: goodFriday.month, day: goodFriday.day, name: "Orthodox Good Friday" },
    { month: easterSunday.month, day: easterSunday.day, name: "Orthodox Easter Sunday" },
    { month: easterMonday.month, day: easterMonday.day, name: "Orthodox Easter Monday" },
    { month: 4, day: 1, name: "Labour Day" },
    { month: 5, day: 1, name: "Children's Day" },
    { month: whitSunday.month, day: whitSunday.day, name: "Orthodox Whit Sunday" },
    { month: whitMonday.month, day: whitMonday.day, name: "Orthodox Whit Monday" },
    { month: 7, day: 15, name: "Assumption of Mary" },
    { month: 10, day: 30, name: "St Andrew's Day" },
    { month: 11, day: 1, name: "National Day" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 26, name: "2nd Day of Christmas" },
  ];
}

// Pre-computed holidays for supported years
const SUPPORTED_YEARS = [2025, 2026, 2027];

export const PUBLIC_HOLIDAYS: Record<CountryCode, Record<number, Holiday[]>> = {
  DE: Object.fromEntries(SUPPORTED_YEARS.map((y) => [y, getDeHolidays(y)])),
  RO: Object.fromEntries(SUPPORTED_YEARS.map((y) => [y, getRoHolidays(y)])),
};

/**
 * Get public holidays in a given month that fall on weekdays (Mon-Fri).
 * Returns the list of holidays (excluding those on weekends).
 */
export function getPublicHolidaysInMonth(
  country: CountryCode,
  year: number,
  month: number
): Holiday[] {
  // Use pre-computed if available, otherwise compute on the fly
  const holidays =
    PUBLIC_HOLIDAYS[country]?.[year] ??
    (country === "DE" ? getDeHolidays(year) : getRoHolidays(year));

  // Dedupe holidays falling on the same calendar day (e.g. RO Orthodox Whit Monday
  // and Children's Day both land on June 1, 2026 — one calendar day, one day off).
  const seen = new Set<number>();
  return holidays.filter((h) => {
    if (h.month !== month) return false;
    const date = new Date(year, h.month, h.day);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) return false;
    if (seen.has(h.day)) return false;
    seen.add(h.day);
    return true;
  });
}
