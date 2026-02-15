/**
 * Duration parsing utility for marktoflow.
 *
 * Parses human-readable duration strings like "2h", "30m", "5s", "100ms"
 * into milliseconds.
 */

/**
 * Parse a duration string into milliseconds.
 *
 * Supported formats:
 * - "100ms" → 100
 * - "5s" → 5000
 * - "30m" → 1800000
 * - "2h" → 7200000
 * - "1d" → 86400000
 * - "5000" → 5000 (bare number treated as milliseconds)
 *
 * @param duration - Duration string to parse
 * @returns Duration in milliseconds
 * @throws Error if format is invalid
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/i);
  if (!match) {
    const asNum = Number(duration);
    if (!isNaN(asNum)) return asNum; // Treat bare numbers as milliseconds
    throw new Error(`Invalid duration format: "${duration}". Use format like "2h", "30m", "5s", "100ms"`);
  }
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
  };
  return value * (multipliers[unit] ?? 1);
}
