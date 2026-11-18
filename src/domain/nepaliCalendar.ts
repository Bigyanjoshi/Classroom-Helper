import { sortStudentsNaturally } from './random';
import type {
  ClassRecord,
  ClassSession,
  DailyAttendanceRecord,
  DailyAttendanceStatus,
  DailyAttendanceStudentEntry,
  Student,
} from './types';

export const NEPALI_MONTH_NAMES_EN = [
  'Baisakh',
  'Jestha',
  'Ashadh',
  'Shrawan',
  'Bhadra',
  'Ashwin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
] as const;

export const NEPALI_MONTH_NAMES_NP = [
  'बैशाख',
  'जेठ',
  'असार',
  'श्रावण',
  'भाद्र',
  'आश्विन',
  'कार्तिक',
  'मंसिर',
  'पौष',
  'माघ',
  'फाल्गुन',
  'चैत्र',
] as const;

export const WEEKDAY_NAMES_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const WEEKDAY_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const WEEKDAY_NAMES_NP = [
  'आइतबार',
  'सोमबार',
  'मंगलबार',
  'बुधबार',
  'बिहिबार',
  'शुक्रबार',
  'शनिबार',
] as const;

export type NepaliMonthNameEn = (typeof NEPALI_MONTH_NAMES_EN)[number];

/**
 * Official Bikram Sambat (BS) calendar month-length lookup table (2000 BS – 2099 BS).
 * Anchor: 2000-01-01 BS = 1943-04-14 AD (Wednesday).
 * Each row lists the exact number of days in the 12 Nepali months (Baisakh..Chaitra).
 */
export const BS_CALENDAR_MONTH_DAYS: Readonly<Record<number, readonly [
  number, number, number, number, number, number,
  number, number, number, number, number, number
]>> = {
  2000: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2001: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2002: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2003: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2004: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2005: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2006: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2007: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2008: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  2009: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2010: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2011: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2012: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2013: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2014: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2015: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2016: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2017: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2018: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2019: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2020: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2021: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2022: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2023: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2024: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2025: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2026: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2027: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2028: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2029: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2030: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2031: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2032: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2033: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2034: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2035: [30, 32, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  2036: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2037: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2038: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2039: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2040: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2041: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2042: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2043: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2044: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2045: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2046: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2047: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2048: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2049: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2050: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2051: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2052: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2053: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2054: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2055: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2056: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2057: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2058: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2059: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2060: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2061: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2062: [31, 31, 31, 32, 31, 31, 29, 30, 29, 30, 29, 31],
  2063: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2064: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2065: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2066: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  2067: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2068: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2069: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2070: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2071: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2072: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2073: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2074: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2075: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2077: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2078: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2079: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2082: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2083: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2084: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2085: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2086: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2087: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2088: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2089: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2090: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2091: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2092: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2093: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  2094: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2095: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2096: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2097: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2098: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2099: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
};

export const MIN_BS_YEAR = 2000;
export const MAX_BS_YEAR = 2099;

// Reference Epoch: 2000-01-01 BS === 1943-04-14 AD (Wednesday, weekdayIndex = 3)
const EPOCH_AD_UTC_MS = Date.UTC(1943, 3, 14);
const MS_PER_DAY = 86_400_000;
// Nepal Standard Time (Asia/Kathmandu) is permanently UTC+05:45 (+345 minutes)
const NEPAL_UTC_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

export interface NepaliDateInfo {
  bsYear: number;
  bsMonth: number; // 1..12
  bsDay: number; // 1..32
  bsDateString: string; // YYYY-MM-DD
  bsMonthKey: string; // YYYY-MM
  monthNameEn: NepaliMonthNameEn;
  monthNameNp: string;
  weekdayIndex: number; // 0 (Sun) .. 6 (Sat)
  weekdayNameEn: string;
  weekdayShortEn: string;
  weekdayNameNp: string;
  weekOfMonth: number; // 1..6 (calendar week row within the BS month)
  dayWeekNumber: number; // 1..5 (Math.ceil(bsDay / 7))
  weekOfYear: number; // 1..53
  daysInMonth: number;
  adYear: number;
  adMonth: number; // 1..12
  adDay: number; // 1..31
  adDateString: string; // YYYY-MM-DD
}

function pad2(num: number): string {
  return String(num).padStart(2, '0');
}

export function formatBsDateString(bsYear: number, bsMonth: number, bsDay: number): string {
  return `${bsYear}-${pad2(bsMonth)}-${pad2(bsDay)}`;
}

export function formatBsMonthKey(bsYear: number, bsMonth: number): string {
  return `${bsYear}-${pad2(bsMonth)}`;
}

export function getBsMonthDays(bsYear: number, bsMonth: number): number {
  const row = BS_CALENDAR_MONTH_DAYS[bsYear];
  if (!row || bsMonth < 1 || bsMonth > 12) {
    throw new RangeError(`BS year/month out of supported range: ${bsYear}-${bsMonth}`);
  }
  return row[bsMonth - 1];
}

/**
 * Extracts the exact Gregorian calendar date in Nepal local time (Asia/Kathmandu, UTC+05:45)
 * for any UTC epoch timestamp.
 */
export function getNepalGregorianParts(timestampMs = Date.now()): {
  adYear: number;
  adMonth: number;
  adDay: number;
} {
  const nepalShifted = new Date(timestampMs + NEPAL_UTC_OFFSET_MS);
  return {
    adYear: nepalShifted.getUTCFullYear(),
    adMonth: nepalShifted.getUTCMonth() + 1,
    adDay: nepalShifted.getUTCDate(),
  };
}

/**
 * Converts a Gregorian (AD) date `(adYear, adMonth, adDay)` into a full Bikram Sambat (BS)
 * `NepaliDateInfo` record using the exact Nepal Panchanga lookup table.
 */
export function adToBs(adYear: number, adMonth: number, adDay: number): NepaliDateInfo {
  const targetUtcMs = Date.UTC(adYear, adMonth - 1, adDay);
  let remainingDays = Math.round((targetUtcMs - EPOCH_AD_UTC_MS) / MS_PER_DAY);

  if (remainingDays < 0) {
    throw new RangeError(`Gregorian date ${adYear}-${pad2(adMonth)}-${pad2(adDay)} precedes 2000-01-01 BS.`);
  }

  let bsYear = MIN_BS_YEAR;
  let bsMonth = 1;

  while (bsYear <= MAX_BS_YEAR) {
    const months = BS_CALENDAR_MONTH_DAYS[bsYear];
    const yearDays = months.reduce((acc, d) => acc + d, 0);
    if (remainingDays < yearDays) {
      break;
    }
    remainingDays -= yearDays;
    bsYear++;
  }

  if (bsYear > MAX_BS_YEAR) {
    throw new RangeError(`Gregorian date ${adYear}-${pad2(adMonth)}-${pad2(adDay)} exceeds supported BS table.`);
  }

  const months = BS_CALENDAR_MONTH_DAYS[bsYear];
  const dayOfYearZeroBased = remainingDays;

  for (let m = 0; m < 12; m++) {
    if (remainingDays < months[m]) {
      bsMonth = m + 1;
      break;
    }
    remainingDays -= months[m];
  }

  const bsDay = remainingDays + 1;
  return buildNepaliDateInfo(bsYear, bsMonth, bsDay, dayOfYearZeroBased, adYear, adMonth, adDay);
}

/**
 * Converts a Bikram Sambat (BS) date `(bsYear, bsMonth, bsDay)` into its exact
 * Gregorian (AD) date and full `NepaliDateInfo`.
 */
export function bsToAd(bsYear: number, bsMonth: number, bsDay: number): NepaliDateInfo {
  const months = BS_CALENDAR_MONTH_DAYS[bsYear];
  if (!months) {
    throw new RangeError(`Unsupported BS year: ${bsYear}`);
  }
  if (bsMonth < 1 || bsMonth > 12) {
    throw new RangeError(`Invalid BS month: ${bsMonth}`);
  }
  const maxDays = months[bsMonth - 1];
  if (bsDay < 1 || bsDay > maxDays) {
    throw new RangeError(`Invalid BS day ${bsDay} for ${bsYear}-${pad2(bsMonth)} (max ${maxDays})`);
  }

  let totalDaysFromEpoch = 0;
  for (let y = MIN_BS_YEAR; y < bsYear; y++) {
    const ym = BS_CALENDAR_MONTH_DAYS[y];
    for (let m = 0; m < 12; m++) {
      totalDaysFromEpoch += ym[m];
    }
  }

  let dayOfYearZeroBased = 0;
  for (let m = 0; m < bsMonth - 1; m++) {
    totalDaysFromEpoch += months[m];
    dayOfYearZeroBased += months[m];
  }

  totalDaysFromEpoch += bsDay - 1;
  dayOfYearZeroBased += bsDay - 1;

  const adUtc = new Date(EPOCH_AD_UTC_MS + totalDaysFromEpoch * MS_PER_DAY);
  const adYear = adUtc.getUTCFullYear();
  const adMonth = adUtc.getUTCMonth() + 1;
  const adDay = adUtc.getUTCDate();

  return buildNepaliDateInfo(bsYear, bsMonth, bsDay, dayOfYearZeroBased, adYear, adMonth, adDay);
}

function buildNepaliDateInfo(
  bsYear: number,
  bsMonth: number,
  bsDay: number,
  dayOfYearZeroBased: number,
  adYear: number,
  adMonth: number,
  adDay: number
): NepaliDateInfo {
  const adUtcMs = Date.UTC(adYear, adMonth - 1, adDay);
  const weekdayIndex = new Date(adUtcMs).getUTCDay();

  // Weekday of the 1st day of this BS month
  const firstDayUtcMs = adUtcMs - (bsDay - 1) * MS_PER_DAY;
  const firstWeekdayIndex = new Date(firstDayUtcMs).getUTCDay();

  // Calendar week row inside the BS month (1..6)
  const weekOfMonth = Math.floor((firstWeekdayIndex + (bsDay - 1)) / 7) + 1;
  const dayWeekNumber = Math.ceil(bsDay / 7);

  // Weekday of 1 Baisakh of this BS year
  const baisakh1UtcMs = adUtcMs - dayOfYearZeroBased * MS_PER_DAY;
  const baisakh1Weekday = new Date(baisakh1UtcMs).getUTCDay();
  const weekOfYear = Math.floor((baisakh1Weekday + dayOfYearZeroBased) / 7) + 1;

  const daysInMonth = BS_CALENDAR_MONTH_DAYS[bsYear][bsMonth - 1];

  return {
    bsYear,
    bsMonth,
    bsDay,
    bsDateString: formatBsDateString(bsYear, bsMonth, bsDay),
    bsMonthKey: formatBsMonthKey(bsYear, bsMonth),
    monthNameEn: NEPALI_MONTH_NAMES_EN[bsMonth - 1],
    monthNameNp: NEPALI_MONTH_NAMES_NP[bsMonth - 1],
    weekdayIndex,
    weekdayNameEn: WEEKDAY_NAMES_EN[weekdayIndex],
    weekdayShortEn: WEEKDAY_SHORT_EN[weekdayIndex],
    weekdayNameNp: WEEKDAY_NAMES_NP[weekdayIndex],
    weekOfMonth,
    dayWeekNumber,
    weekOfYear,
    daysInMonth,
    adYear,
    adMonth,
    adDay,
    adDateString: `${adYear}-${pad2(adMonth)}-${pad2(adDay)}`,
  };
}

/**
 * Automatically detects today's Nepali Bikram Sambat date using Nepal local time (Asia/Kathmandu).
 */
export function getTodayNepaliDate(nowMs = Date.now()): NepaliDateInfo {
  const { adYear, adMonth, adDay } = getNepalGregorianParts(nowMs);
  return adToBs(adYear, adMonth, adDay);
}

/**
 * Parses a canonical `YYYY-MM-DD` BS date string into a full `NepaliDateInfo`, or returns `null` if invalid.
 */
export function parseBsDateString(bsDateString: string): NepaliDateInfo | null {
  const match = bsDateString.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const bsYear = Number(match[1]);
  const bsMonth = Number(match[2]);
  const bsDay = Number(match[3]);
  try {
    return bsToAd(bsYear, bsMonth, bsDay);
  } catch {
    return null;
  }
}

/**
 * Steps forward or backward by `deltaDays` in the Bikram Sambat calendar.
 */
export function stepNepaliDay(bsDateString: string, deltaDays: number): NepaliDateInfo {
  const current = parseBsDateString(bsDateString);
  if (!current) {
    return getTodayNepaliDate();
  }
  const targetUtc = new Date(
    Date.UTC(current.adYear, current.adMonth - 1, current.adDay) + deltaDays * MS_PER_DAY
  );
  return adToBs(targetUtc.getUTCFullYear(), targetUtc.getUTCMonth() + 1, targetUtc.getUTCDate());
}

/**
 * Steps forward or backward by `deltaMonths` in the Bikram Sambat calendar.
 */
export function stepNepaliMonth(
  bsYear: number,
  bsMonth: number,
  deltaMonths: number
): { bsYear: number; bsMonth: number; bsMonthKey: string; monthNameEn: NepaliMonthNameEn; monthNameNp: string } {
  const zeroBased = (bsYear - MIN_BS_YEAR) * 12 + (bsMonth - 1) + deltaMonths;
  const clamped = Math.max(0, Math.min((MAX_BS_YEAR - MIN_BS_YEAR + 1) * 12 - 1, zeroBased));
  const nextYear = MIN_BS_YEAR + Math.floor(clamped / 12);
  const nextMonth = (clamped % 12) + 1;
  return {
    bsYear: nextYear,
    bsMonth: nextMonth,
    bsMonthKey: formatBsMonthKey(nextYear, nextMonth),
    monthNameEn: NEPALI_MONTH_NAMES_EN[nextMonth - 1],
    monthNameNp: NEPALI_MONTH_NAMES_NP[nextMonth - 1],
  };
}

export interface NepaliMonthCalendarGrid {
  bsYear: number;
  bsMonth: number;
  bsMonthKey: string;
  monthNameEn: NepaliMonthNameEn;
  monthNameNp: string;
  daysInMonth: number;
  firstWeekdayIndex: number;
  totalWeeks: number;
  days: NepaliDateInfo[];
}

export function getNepaliMonthCalendar(bsYear: number, bsMonth: number): NepaliMonthCalendarGrid {
  const daysInMonth = getBsMonthDays(bsYear, bsMonth);
  const days: NepaliDateInfo[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(bsToAd(bsYear, bsMonth, d));
  }
  const firstWeekdayIndex = days[0]?.weekdayIndex ?? 0;
  const totalWeeks = Math.ceil((firstWeekdayIndex + daysInMonth) / 7);
  return {
    bsYear,
    bsMonth,
    bsMonthKey: formatBsMonthKey(bsYear, bsMonth),
    monthNameEn: NEPALI_MONTH_NAMES_EN[bsMonth - 1],
    monthNameNp: NEPALI_MONTH_NAMES_NP[bsMonth - 1],
    daysInMonth,
    firstWeekdayIndex,
    totalWeeks,
    days,
  };
}

export function makeDailyAttendanceId(classId: string, bsDateString: string): string {
  return `${classId}_${bsDateString}`;
}

/**
 * Builds or updates a deterministic `DailyAttendanceRecord` for `(classRecord, bsDateInfo)`.
 * Preserves existing `createdAt` when updating an existing record so opening or saving
 * today's attendance never creates duplicate records.
 */
export function buildDailyAttendanceRecord(params: {
  classRecord: Pick<ClassRecord, 'id' | 'name'>;
  students: readonly Student[];
  absentStudentIds: readonly string[];
  bsDateInfo: NepaliDateInfo;
  notes?: string;
  existingRecord?: DailyAttendanceRecord | null;
  now?: number;
}): DailyAttendanceRecord {
  const {
    classRecord,
    students,
    absentStudentIds,
    bsDateInfo,
    notes,
    existingRecord,
    now = Date.now(),
  } = params;

  const activeClassStudents = sortStudentsNaturally(
    students.filter((s) => s.classId === classRecord.id && s.activeStatus === 'active')
  );
  const absentSet = new Set(absentStudentIds);

  const studentRecords: DailyAttendanceStudentEntry[] = activeClassStudents.map((stu) => ({
    studentId: stu.id,
    name: stu.name,
    rollNumber: stu.rollNumber,
    status: (absentSet.has(stu.id) ? 'absent' : 'present') as DailyAttendanceStatus,
  }));

  // Also preserve any historical student entries from an older saved record if a student was later archived
  if (existingRecord) {
    const activeIds = new Set(activeClassStudents.map((s) => s.id));
    for (const prevEntry of existingRecord.studentRecords) {
      if (!activeIds.has(prevEntry.studentId)) {
        studentRecords.push({
          ...prevEntry,
          status: absentSet.has(prevEntry.studentId) ? 'absent' : prevEntry.status,
        });
      }
    }
  }

  const presentCount = studentRecords.filter((r) => r.status === 'present').length;
  const absentCount = studentRecords.length - presentCount;

  return {
    id: makeDailyAttendanceId(classRecord.id, bsDateInfo.bsDateString),
    classId: classRecord.id,
    className: classRecord.name,
    bsDate: bsDateInfo.bsDateString,
    bsMonthKey: bsDateInfo.bsMonthKey,
    bsYear: bsDateInfo.bsYear,
    bsMonth: bsDateInfo.bsMonth,
    bsMonthName: bsDateInfo.monthNameEn,
    bsDay: bsDateInfo.bsDay,
    weekdayName: bsDateInfo.weekdayNameEn,
    weekOfMonth: bsDateInfo.weekOfMonth,
    adDate: bsDateInfo.adDateString,
    studentRecords,
    presentCount,
    absentCount,
    totalCount: studentRecords.length,
    notes: notes !== undefined ? notes.trim() || undefined : existingRecord?.notes,
    createdAt: existingRecord?.createdAt ?? now,
    updatedAt: now,
  };
}

/**
 * Converts a legacy/existing `ClassSession` into a `DailyAttendanceRecord` for safe migration/backfill.
 */
export function buildDailyAttendanceFromSession(
  session: ClassSession,
  classRecord: Pick<ClassRecord, 'id' | 'name'>,
  students: readonly Student[]
): DailyAttendanceRecord {
  const bsDateInfo = getTodayNepaliDate(session.startedAt);
  return buildDailyAttendanceRecord({
    classRecord,
    students,
    absentStudentIds: session.absentStudentIds,
    bsDateInfo,
    notes: session.attendanceNotes,
    now: session.startedAt,
  });
}

export interface ArchiveClassGroup {
  classId: string;
  className: string;
  dates: DailyAttendanceRecord[];
  totalDaysRecorded: number;
  averageAttendancePct: number;
}

export interface ArchiveMonthGroup {
  bsMonthKey: string; // YYYY-MM
  bsYear: number;
  bsMonth: number;
  bsMonthNameEn: NepaliMonthNameEn;
  bsMonthNameNp: string;
  classes: ArchiveClassGroup[];
  totalRecords: number;
}

/**
 * Organizes `DailyAttendanceRecord` items into the canonical hierarchy:
 * Attendance -> Nepali Month -> Class -> Date -> Student Records
 */
export function groupAttendanceArchive(
  records: readonly DailyAttendanceRecord[],
  classes: readonly ClassRecord[]
): ArchiveMonthGroup[] {
  const classNameMap = new Map(classes.map((c) => [c.id, c.name]));
  const monthMap = new Map<string, DailyAttendanceRecord[]>();

  for (const rec of records) {
    const list = monthMap.get(rec.bsMonthKey) ?? [];
    list.push(rec);
    monthMap.set(rec.bsMonthKey, list);
  }

  const sortedMonthKeys = Array.from(monthMap.keys()).sort((a, b) => b.localeCompare(a));

  return sortedMonthKeys.map((bsMonthKey) => {
    const monthRecords = monthMap.get(bsMonthKey)!;
    const sample = monthRecords[0];
    const bsYear = sample.bsYear;
    const bsMonth = sample.bsMonth;

    const classMap = new Map<string, DailyAttendanceRecord[]>();
    for (const rec of monthRecords) {
      const cList = classMap.get(rec.classId) ?? [];
      cList.push(rec);
      classMap.set(rec.classId, cList);
    }

    const classGroups: ArchiveClassGroup[] = Array.from(classMap.entries())
      .map(([classId, classRecords]) => {
        // Deduplicate by bsDate (keep latest updatedAt if any exist) and sort descending by date
        const byDate = new Map<string, DailyAttendanceRecord>();
        for (const r of classRecords) {
          const existing = byDate.get(r.bsDate);
          if (!existing || r.updatedAt >= existing.updatedAt) {
            byDate.set(r.bsDate, r);
          }
        }
        const dates = Array.from(byDate.values()).sort((a, b) => b.bsDate.localeCompare(a.bsDate));
        const totalPresent = dates.reduce((acc, d) => acc + d.presentCount, 0);
        const totalPossible = dates.reduce((acc, d) => acc + d.totalCount, 0);
        const averageAttendancePct =
          totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 100;

        return {
          classId,
          className: classNameMap.get(classId) ?? dates[0]?.className ?? classId,
          dates,
          totalDaysRecorded: dates.length,
          averageAttendancePct,
        };
      })
      .sort((a, b) => a.className.localeCompare(b.className));

    return {
      bsMonthKey,
      bsYear,
      bsMonth,
      bsMonthNameEn: NEPALI_MONTH_NAMES_EN[bsMonth - 1] ?? 'Baisakh',
      bsMonthNameNp: NEPALI_MONTH_NAMES_NP[bsMonth - 1] ?? 'बैशाख',
      classes: classGroups,
      totalRecords: classGroups.reduce((acc, c) => acc + c.dates.length, 0),
    };
  });
}

/**
 * Repairs any DailyAttendanceRecord whose `adDate` (YYYY-MM-DD) maps to a different
 * `bsDate` under the authoritative Nepali Patro BS table.
 */
export function reconcileDailyAttendanceRecordWithBsTable(
  record: DailyAttendanceRecord
): { record: DailyAttendanceRecord; changed: boolean } {
  const match = record.adDate?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return { record, changed: false };
  }
  const adYear = Number(match[1]);
  const adMonth = Number(match[2]);
  const adDay = Number(match[3]);
  try {
    const expected = adToBs(adYear, adMonth, adDay);
    if (
      record.bsDate === expected.bsDateString &&
      record.bsMonthKey === expected.bsMonthKey &&
      record.bsDay === expected.bsDay &&
      record.weekdayName === expected.weekdayNameEn &&
      record.id === makeDailyAttendanceId(record.classId, expected.bsDateString)
    ) {
      return { record, changed: false };
    }
    return {
      changed: true,
      record: {
        ...record,
        id: makeDailyAttendanceId(record.classId, expected.bsDateString),
        bsDate: expected.bsDateString,
        bsMonthKey: expected.bsMonthKey,
        bsYear: expected.bsYear,
        bsMonth: expected.bsMonth,
        bsMonthName: expected.monthNameEn,
        bsDay: expected.bsDay,
        weekdayName: expected.weekdayNameEn,
        weekOfMonth: expected.weekOfMonth,
      },
    };
  } catch {
    return { record, changed: false };
  }
}

const NEPALI_PATRO_API_BASE = 'https://api.nepalipatro.com.np';
const NEPALI_PATRO_AES_KEY_B64 = '9E4mk3Woz7tN8Ic9LRZYG5ipy7971B62egK199a0d+c=';

function base64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/**
 * Decrypts an encrypted payload returned by `https://api.nepalipatro.com.np/calendars/*`
 * using Web Crypto AES-256-CBC (handling Nepali Patro's zero-byte padding).
 */
export async function decryptNepaliPatroPayload<T = unknown>(payloadText: string): Promise<T> {
  const cleanB64 = payloadText.trim().replace(/^"|"$/g, '');
  const envelopeJson = atob(cleanB64);
  const envelope = JSON.parse(envelopeJson) as { iv: string; value: string };
  if (!envelope.iv || !envelope.value) {
    throw new Error('Invalid Nepali Patro encrypted envelope');
  }
  const keyBytes = base64ToUint8Array(NEPALI_PATRO_AES_KEY_B64);
  const iv = base64ToUint8Array(envelope.iv);
  const ciphertext = base64ToUint8Array(envelope.value);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-CBC' },
    false,
    ['encrypt', 'decrypt']
  );

  // Synthesize a valid PKCS#7 padding block chained to the last 16-byte ciphertext block
  const lastBlock = new Uint8Array(new ArrayBuffer(16));
  lastBlock.set(ciphertext.subarray(ciphertext.length - 16));
  const emptyPlain = new Uint8Array(new ArrayBuffer(0));
  const padCipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-CBC', iv: lastBlock }, cryptoKey, emptyPlain)
  );
  const combined = new Uint8Array(new ArrayBuffer(ciphertext.length + 16));
  combined.set(ciphertext, 0);
  combined.set(padCipher.subarray(0, 16), ciphertext.length);

  const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, combined);
  const filtered = new Uint8Array(decryptedBuffer).filter((b) => b !== 0);
  const decodedText = new TextDecoder('utf-8')
    .decode(filtered)
    .replace(/[\u0000-\u0019]+/g, '');
  return JSON.parse(decodedText) as T;
}

export interface NepaliPatroTodayResponse {
  bsDateString: string;
  bsYear: number;
  bsMonth: number;
  bsDay: number;
  adDateString: string;
  weekdayIndex: number; // 0 (Sun) .. 6 (Sat)
  nsYear?: number;
  isVerified: boolean;
}

/**
 * Fetches today's authoritative BS date directly from Nepali Patro (`https://api.nepalipatro.com.np/calendars/today`).
 */
export async function fetchNepaliPatroToday(): Promise<NepaliPatroTodayResponse> {
  const res = await fetch(`${NEPALI_PATRO_API_BASE}/calendars/today`);
  if (!res.ok) {
    throw new Error(`Nepali Patro API returned ${res.status}`);
  }
  const rawText = await res.text();
  const parsed = await decryptNepaliPatroPayload<{
    status: string;
    data: {
      ad: string;
      bs: string;
      bs_day: number;
      bs_month: number;
      bs_year: number;
      ns_year?: number;
      is_verified?: number;
      day?: number;
    };
  }>(rawText);

  const d = parsed.data;
  const bsYear = Number(d.bs_year);
  const bsMonth = Number(d.bs_month);
  const bsDay = Number(d.bs_day);

  return {
    bsDateString: formatBsDateString(bsYear, bsMonth, bsDay),
    bsYear,
    bsMonth,
    bsDay,
    adDateString: d.ad,
    weekdayIndex: typeof d.day === 'number' ? d.day - 1 : new Date(d.ad).getUTCDay(),
    nsYear: d.ns_year,
    isVerified: Boolean(d.is_verified),
  };
}

/**
 * Fetches the 12 month lengths for `bsYear` from Nepali Patro (`https://api.nepalipatro.com.np/calendars`).
 */
export async function fetchNepaliPatroYearDays(
  bsYear: number
): Promise<readonly [number, number, number, number, number, number, number, number, number, number, number, number]> {
  const url = `${NEPALI_PATRO_API_BASE}/calendars?start_date=${bsYear}-01-01&end_date=${bsYear + 1}-01-01&calendar_type=BS`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Nepali Patro year calendar returned ${res.status}`);
  }
  const rawText = await res.text();
  const parsed = await decryptNepaliPatroPayload<{
    status: string;
    data: {
      events: Record<string, Record<string, unknown[]>>;
    };
  }>(rawText);

  const yearEvents = parsed.data?.events?.[String(bsYear)];
  if (!yearEvents) {
    throw new Error(`No events found for BS year ${bsYear} in Nepali Patro response`);
  }

  const days: number[] = [];
  for (let m = 1; m <= 12; m++) {
    const mm = pad2(m);
    const list = yearEvents[mm] ?? yearEvents[String(m)];
    const len = Array.isArray(list) ? list.length : 0;
    if (len < 28 || len > 32) {
      throw new Error(`Unexpected month length ${len} for ${bsYear}-${mm}`);
    }
    days.push(len);
  }

  return days as unknown as readonly [
    number, number, number, number, number, number,
    number, number, number, number, number, number
  ];
}

