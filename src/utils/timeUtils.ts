import { toPersianDigits } from './formatters';

export const TEHRAN_TIMEZONE = 'Asia/Tehran';

export interface TehranTimeParts {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  dayOfWeek: number; // 0 for Sunday, 6 for Saturday
}

/**
 * Parses a date object into Tehran timezone parts (Asia/Tehran UTC+3:30 / UTC+4:30)
 */
export const getTehranParts = (date: Date = new Date()): TehranTimeParts => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TEHRAN_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  parts.forEach(p => {
    if (p.type !== 'literal') {
      map[p.type] = p.value;
    }
  });

  const year = parseInt(map.year || '2026', 10);
  const month = parseInt(map.month || '7', 10);
  const day = parseInt(map.day || '1', 10);
  let hours = parseInt(map.hour || '14', 10);
  if (hours === 24) hours = 0;
  const minutes = parseInt(map.minute || '30', 10);
  const seconds = parseInt(map.second || '0', 10);

  // Map weekday string to index (Sun=0..Sat=6)
  const weekdayStr = (map.weekday || 'Tue').toLowerCase();
  const dayOfWeekMap: Record<string, number> = {
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
  };
  const dayOfWeek = dayOfWeekMap[weekdayStr.slice(0, 3)] ?? 2;

  return { year, month, day, hours, minutes, seconds, dayOfWeek };
};

/**
 * Returns current Date object anchored to Asia/Tehran timezone
 */
export const getTehranDate = (input?: Date | string | number): Date => {
  const baseDate = input ? new Date(input) : new Date();
  const parts = getTehranParts(baseDate);
  return new Date(parts.year, parts.month - 1, parts.day, parts.hours, parts.minutes, parts.seconds);
};

/**
 * Returns current Tehran hour and minute converted to total minutes elapsed since midnight
 */
export const getTehranCurrentTimeMinutes = (): number => {
  const parts = getTehranParts(new Date());
  return parts.hours * 60 + parts.minutes;
};

/**
 * Formats current Tehran time as Persian string badge (e.g. "۱۴:۳۰ امروز")
 */
export const getTehranTimeBadgeString = (): string => {
  const parts = getTehranParts(new Date());
  const formattedHours = toPersianDigits(parts.hours < 10 ? `0${parts.hours}` : parts.hours);
  const formattedMins = toPersianDigits(parts.minutes < 10 ? `0${parts.minutes}` : parts.minutes);
  return `${formattedHours}:${formattedMins} امروز`;
};

/**
 * Formats date into Jalali format explicitly in Asia/Tehran locale
 */
export const formatTehranJalali = (
  date: Date = new Date(),
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  }
): string => {
  try {
    const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      timeZone: TEHRAN_TIMEZONE,
      ...options
    });
    return formatter.format(date);
  } catch {
    return 'تیر - مرداد ۱۴۰۵';
  }
};

/**
 * Calculates top pixel position for the live red line in Outlook time grid (08:00 to 20:00 range)
 * Slot height = 64px per hour. Grid starts at 08:00 (480 mins).
 */
export const calculateLiveLineTopPx = (slotHeightPx: number = 64, startHour: number = 8): number => {
  const currentMins = getTehranCurrentTimeMinutes();
  const startMins = startHour * 60;
  const elapsedMins = Math.max(0, currentMins - startMins);
  return Math.round((elapsedMins / 60) * slotHeightPx);
};
