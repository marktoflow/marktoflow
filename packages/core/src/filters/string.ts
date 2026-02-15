/**
 * String filters — split, slugify, prefix, suffix, truncate, substring, contains.
 */

export function split(value: unknown, delimiter: string = ','): string[] {
  return String(value ?? '').split(delimiter);
}

export function slugify(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function prefix(value: unknown, prefixStr: string): string {
  return prefixStr + String(value ?? '');
}

export function suffix(value: unknown, suffixStr: string): string {
  return String(value ?? '') + suffixStr;
}

export function truncate(value: unknown, length: number, ellipsis: string = '...'): string {
  const str = String(value ?? '');
  if (str.length <= length) return str;
  return str.slice(0, length) + ellipsis;
}

export function substring(value: unknown, start: number, end?: number): string {
  return String(value ?? '').substring(start, end);
}

export function contains(value: unknown, search: unknown): boolean {
  if (typeof value === 'string') return value.includes(String(search));
  if (Array.isArray(value)) return value.includes(search);
  return false;
}
