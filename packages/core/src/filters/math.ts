/**
 * Math filters — round, floor, ceil, min, max, add, subtract, multiply, divide.
 */

export function round(value: unknown, decimals: number = 0): number {
  const num = Number(value);
  const multiplier = Math.pow(10, decimals);
  return Math.round(num * multiplier) / multiplier;
}

export function floor(value: unknown): number {
  return Math.floor(Number(value));
}

export function ceil(value: unknown): number {
  return Math.ceil(Number(value));
}

export function min(value: unknown, ...values: unknown[]): number {
  if (Array.isArray(value)) return Math.min(...value.map((v) => Number(v)));
  const nums = [Number(value), ...values.map((v) => Number(v))];
  return Math.min(...nums);
}

export function max(value: unknown, ...values: unknown[]): number {
  if (Array.isArray(value)) return Math.max(...value.map((v) => Number(v)));
  const nums = [Number(value), ...values.map((v) => Number(v))];
  return Math.max(...nums);
}

export function add(value: unknown, amount: unknown): number {
  return Number(value) + Number(amount);
}

export function subtract(value: unknown, amount: unknown): number {
  return Number(value) - Number(amount);
}

export function multiply(value: unknown, amount: unknown): number {
  return Number(value) * Number(amount);
}

export function divide(value: unknown, amount: unknown): number {
  return Number(value) / Number(amount);
}
