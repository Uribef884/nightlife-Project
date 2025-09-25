/**
 * Centralized timezone utility for Nightlife
 * 
 * Core Principles:
 * - One canonical timezone for business rules: America/Bogota
 * - Instants (timestamps) remain UTC in DB and APIs
 * - Business days (e.g., "can select today?", open windows by weekday) are computed in America/Bogota
 * - Never hardcode -05:00; always use the IANA zone
 * - Never parse YYYY-MM-DD with new Date(). Always parse as a local Bogota day
 */

import { DateTime } from 'luxon';

// Canonical timezone for all business logic
export const BUSINESS_TIMEZONE = 'America/Bogota';

/**
 * Get current time in Bogota timezone
 */
export function nowInBogota(): DateTime {
  return DateTime.now().setZone(BUSINESS_TIMEZONE);
}

/**
 * Get today's date in Bogota timezone as YYYY-MM-DD string
 */
export function todayInBogota(): string {
  return nowInBogota().toISODate()!;
}

/**
 * Parse a YYYY-MM-DD string as a date in Bogota timezone
 * This is the safe way to parse date strings - never use new Date() on YYYY-MM-DD
 */
export function parseBogotaDate(dateString: string): DateTime {
  return DateTime.fromISO(dateString, { zone: BUSINESS_TIMEZONE });
}

/**
 * Check if a date string represents today in Bogota timezone
 */
export function isTodayInBogota(dateString: string): boolean {
  const date = parseBogotaDate(dateString);
  const today = nowInBogota();
  return date.hasSame(today, 'day');
}

/**
 * Check if a date string represents a past date in Bogota timezone
 */
export function isPastDateInBogota(dateString: string): boolean {
  const date = parseBogotaDate(dateString);
  const today = nowInBogota();
  return date < today.startOf('day');
}

/**
 * Check if a date string represents a future date in Bogota timezone
 */
export function isFutureDateInBogota(dateString: string): boolean {
  const date = parseBogotaDate(dateString);
  const today = nowInBogota();
  return date > today.endOf('day');
}

/**
 * Get the start of day in Bogota timezone for a given date string
 */
export function startOfDayInBogota(dateString: string): DateTime {
  return parseBogotaDate(dateString).startOf('day');
}

/**
 * Get the end of day in Bogota timezone for a given date string
 */
export function endOfDayInBogota(dateString: string): DateTime {
  return parseBogotaDate(dateString).endOf('day');
}

/**
 * Get the start of day in Bogota timezone for tomorrow
 */
export function tomorrowStartInBogota(): DateTime {
  return nowInBogota().plus({ days: 1 }).startOf('day');
}

/**
 * Get the end of day in Bogota timezone for tomorrow
 */
export function tomorrowEndInBogota(): DateTime {
  return nowInBogota().plus({ days: 1 }).endOf('day');
}

/**
 * Get a date string for N days from today in Bogota timezone
 */
export function addDaysInBogota(days: number): string {
  return nowInBogota().plus({ days }).toISODate()!;
}

/**
 * Get the maximum selectable date (21 days from today) in Bogota timezone
 */
export function maxSelectableDateInBogota(): string {
  return addDaysInBogota(21);
}

/**
 * Check if a date string is within the selectable range (today to 21 days from today) in Bogota timezone
 */
export function isDateSelectableInBogota(dateString: string): boolean {
  const date = parseBogotaDate(dateString);
  const today = nowInBogota().startOf('day');
  const maxDate = today.plus({ days: 21 });
  
  return date >= today && date <= maxDate;
}

/**
 * Get the weekday name in English for a date string in Bogota timezone
 * This matches the format expected by club configuration
 */
export function getWeekdayInBogota(dateString: string): string {
  const date = parseBogotaDate(dateString);
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return weekdays[date.weekday - 1];
}

/**
 * Check if a date string falls on a weekend in Bogota timezone
 */
export function isWeekendInBogota(dateString: string): boolean {
  const date = parseBogotaDate(dateString);
  return date.weekday === 6 || date.weekday === 7; // Saturday or Sunday
}

/**
 * Convert a UTC timestamp to Bogota timezone and return as YYYY-MM-DD
 */
export function utcToBogotaDate(utcTimestamp: Date | string): string {
  const dateTime = typeof utcTimestamp === 'string' 
    ? DateTime.fromISO(utcTimestamp, { zone: 'utc' })
    : DateTime.fromJSDate(utcTimestamp, { zone: 'utc' });
  
  return dateTime.setZone(BUSINESS_TIMEZONE).toISODate()!;
}

/**
 * Convert a Bogota date string to UTC timestamp
 */
export function bogotaDateToUtc(dateString: string): Date {
  return parseBogotaDate(dateString).toUTC().toJSDate();
}

/**
 * Get current time in Bogota timezone as ISO string
 */
export function nowInBogotaISO(): string {
  return nowInBogota().toISO()!;
}

/**
 * Format a date string for display in Bogota timezone
 */
export function formatBogotaDate(dateString: string, format: string = 'dd/MM/yyyy'): string {
  return parseBogotaDate(dateString).toFormat(format);
}

/**
 * Get the time difference in hours between a date and now in Bogota timezone
 */
export function getHoursDifferenceInBogota(dateString: string): number {
  const date = parseBogotaDate(dateString);
  const now = nowInBogota();
  return now.diff(date, 'hours').hours;
}

/**
 * Check if current time in Bogota is within a time window for a given date
 * Useful for checking if an event is currently active
 */
export function isWithinTimeWindowInBogota(
  dateString: string, 
  startHour: number = 0, 
  endHour: number = 1
): boolean {
  const date = parseBogotaDate(dateString);
  const now = nowInBogota();
  
  const windowStart = date.set({ hour: startHour, minute: 0, second: 0, millisecond: 0 });
  const windowEnd = date.plus({ days: 1 }).set({ hour: endHour, minute: 0, second: 0, millisecond: 0 });
  
  return now >= windowStart && now <= windowEnd;
}
