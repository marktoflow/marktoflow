/**
 * JSON filters — parse_json, to_json.
 */

export function parse_json(value: unknown): unknown {
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

export function to_json(value: unknown, pretty: boolean = false): string {
  return JSON.stringify(value, null, pretty ? 2 : 0);
}
