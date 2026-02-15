/**
 * Logic filters — ternary, and, or, not.
 */

export function ternary(condition: unknown, trueVal: unknown, falseVal: unknown): unknown {
  return condition ? trueVal : falseVal;
}

export function and(value: unknown, ...values: unknown[]): boolean {
  if (!value) return false;
  for (const v of values) {
    if (!v) return false;
  }
  return true;
}

export function or(value: unknown, ...alternatives: unknown[]): unknown {
  if (value) return value;
  for (const alt of alternatives) {
    if (alt) return alt;
  }
  return null;
}

export function not(value: unknown): boolean {
  return !value;
}
