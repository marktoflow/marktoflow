/**
 * Regex filters — match, notMatch, regexReplace.
 */

export function match(value: unknown, pattern: string, groupIndex?: number): unknown {
  const str = String(value ?? '');
  const { regex } = parseRegexPattern(pattern);

  const result = str.match(regex);
  if (!result) return null;

  if (groupIndex !== undefined) return result[groupIndex] ?? null;
  if (result.groups && Object.keys(result.groups).length > 0) return result.groups;
  if (result.length > 1) return result[1];
  return result[0];
}

export function notMatch(value: unknown, pattern: string): boolean {
  const str = String(value ?? '');
  const { regex } = parseRegexPattern(pattern);
  return !regex.test(str);
}

export function regexReplace(
  value: unknown,
  pattern: string,
  replacement: string,
  flags?: string
): string {
  const str = String(value ?? '');
  const parsed = parseRegexPattern(pattern);
  const finalFlags = flags ?? parsed.flags;
  const regex = new RegExp(parsed.pattern, finalFlags);
  return str.replace(regex, replacement);
}

function parseRegexPattern(pattern: string): { pattern: string; flags: string; regex: RegExp } {
  const regexMatch = pattern.match(/^\/(.+)\/([gimsu]*)$/);
  if (regexMatch) {
    const [, p, f] = regexMatch;
    return { pattern: p, flags: f, regex: new RegExp(p, f) };
  }
  return { pattern, flags: '', regex: new RegExp(pattern) };
}
