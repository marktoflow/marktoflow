/**
 * core.format — Value formatting (date, number, string, currency, json).
 */

import { ExecutionContext } from '../models.js';
import { resolveTemplates } from '../engine/variable-resolution.js';

export interface FormatOperationInputs {
  value: unknown;
  type: 'date' | 'number' | 'string' | 'currency' | 'json';
  format?: string;
  locale?: string;
  currency?: string;
  precision?: number;
}

export function executeFormat(
  inputs: FormatOperationInputs,
  context: ExecutionContext
): string {
  const value = resolveTemplates(inputs.value, context);

  switch (inputs.type) {
    case 'date':
      return formatDate(value, inputs.format);
    case 'number':
      return formatNumber(value, inputs.precision, inputs.locale);
    case 'currency':
      return formatCurrency(value, inputs.currency || 'USD', inputs.locale);
    case 'string':
      return formatString(value, inputs.format);
    case 'json':
      return JSON.stringify(value, null, 2);
    default:
      throw new Error(`Unknown format type: ${inputs.type}`);
  }
}

function formatDate(value: unknown, format?: string): string {
  let date: Date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  } else {
    date = new Date();
  }

  if (isNaN(date.getTime())) throw new Error('Invalid date value');

  if (!format) return date.toISOString();

  let formatted = format;
  formatted = formatted.replace('YYYY', date.getFullYear().toString());
  formatted = formatted.replace('MM', String(date.getMonth() + 1).padStart(2, '0'));
  formatted = formatted.replace('DD', String(date.getDate()).padStart(2, '0'));
  formatted = formatted.replace('HH', String(date.getHours()).padStart(2, '0'));
  formatted = formatted.replace('mm', String(date.getMinutes()).padStart(2, '0'));
  formatted = formatted.replace('ss', String(date.getSeconds()).padStart(2, '0'));

  return formatted;
}

function formatNumber(value: unknown, precision?: number, locale?: string): string {
  const num = Number(value);
  if (isNaN(num)) throw new Error('Invalid number value');
  if (precision !== undefined) return num.toFixed(precision);
  if (locale) return num.toLocaleString(locale);
  return num.toString();
}

function formatCurrency(value: unknown, currency: string, locale?: string): string {
  const num = Number(value);
  if (isNaN(num)) throw new Error('Invalid currency value');
  return num.toLocaleString(locale || 'en-US', { style: 'currency', currency });
}

function formatString(value: unknown, format?: string): string {
  const str = String(value);
  if (!format) return str;

  switch (format.toLowerCase()) {
    case 'upper':
    case 'uppercase':
      return str.toUpperCase();
    case 'lower':
    case 'lowercase':
      return str.toLowerCase();
    case 'title':
    case 'titlecase':
      return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
    case 'capitalize':
      return str.charAt(0).toUpperCase() + str.slice(1);
    case 'trim':
      return str.trim();
    default:
      return str;
  }
}
