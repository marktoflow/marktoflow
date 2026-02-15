/**
 * Date filters — now, format_date, add_days, subtract_days, diff_days.
 */

export function now(): number {
  return Date.now();
}

export function format_date(value: unknown, format: string = 'YYYY-MM-DD'): string {
  let date: Date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  } else {
    date = new Date();
  }

  if (isNaN(date.getTime())) return 'Invalid Date';

  let formatted = format;
  formatted = formatted.replace('YYYY', date.getFullYear().toString());
  formatted = formatted.replace('MM', String(date.getMonth() + 1).padStart(2, '0'));
  formatted = formatted.replace('DD', String(date.getDate()).padStart(2, '0'));
  formatted = formatted.replace('HH', String(date.getHours()).padStart(2, '0'));
  formatted = formatted.replace('mm', String(date.getMinutes()).padStart(2, '0'));
  formatted = formatted.replace('ss', String(date.getSeconds()).padStart(2, '0'));

  return formatted;
}

export function add_days(value: unknown, days: number): number {
  const date = new Date(value as string | number);
  if (isNaN(date.getTime())) return 0;
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function subtract_days(value: unknown, days: number): number {
  const date = new Date(value as string | number);
  if (isNaN(date.getTime())) return 0;
  date.setDate(date.getDate() - days);
  return date.getTime();
}

export function diff_days(value: unknown, compareDate: unknown): number {
  const date1 = new Date(value as string | number);
  const date2 = new Date(compareDate as string | number);
  if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return 0;
  const diffMs = date1.getTime() - date2.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
