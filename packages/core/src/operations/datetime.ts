/**
 * core.datetime — Date/time operations.
 */

export function executeDatetime(inputs: Record<string, unknown>): unknown {
  const operation = inputs.operation as string;
  const date = inputs.date ? new Date(inputs.date as string) : new Date();

  switch (operation) {
    case 'now':
      return new Date().toISOString();
    case 'parse':
      return date.toISOString();
    case 'format': {
      const fmt = (inputs.format as string) ?? 'iso';
      if (fmt === 'iso') return date.toISOString();
      if (fmt === 'date') return date.toISOString().split('T')[0];
      if (fmt === 'time') return date.toISOString().split('T')[1]?.replace('Z', '');
      if (fmt === 'unix') return Math.floor(date.getTime() / 1000);
      if (fmt === 'unix_ms') return date.getTime();
      return date.toISOString();
    }
    case 'add': {
      const amount = inputs.amount as number;
      const unit = (inputs.unit as string) ?? 'days';
      const ms = { ms: 1, seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000, weeks: 604800000 };
      const mult = ms[unit as keyof typeof ms] ?? ms.days;
      return new Date(date.getTime() + amount * mult).toISOString();
    }
    case 'subtract': {
      const amount = inputs.amount as number;
      const unit = (inputs.unit as string) ?? 'days';
      const ms = { ms: 1, seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000, weeks: 604800000 };
      const mult = ms[unit as keyof typeof ms] ?? ms.days;
      return new Date(date.getTime() - amount * mult).toISOString();
    }
    case 'diff': {
      const date2 = new Date(inputs.date2 as string);
      const unit = (inputs.unit as string) ?? 'days';
      const diffMs = date.getTime() - date2.getTime();
      const divisors = { ms: 1, seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000 };
      return diffMs / (divisors[unit as keyof typeof divisors] ?? divisors.days);
    }
    case 'start_of': {
      const unit = (inputs.unit as string) ?? 'day';
      const d = new Date(date);
      if (unit === 'day') { d.setHours(0, 0, 0, 0); }
      else if (unit === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0); }
      else if (unit === 'year') { d.setMonth(0, 1); d.setHours(0, 0, 0, 0); }
      else if (unit === 'hour') { d.setMinutes(0, 0, 0); }
      return d.toISOString();
    }
    case 'end_of': {
      const unit = (inputs.unit as string) ?? 'day';
      const d = new Date(date);
      if (unit === 'day') { d.setHours(23, 59, 59, 999); }
      else if (unit === 'month') { d.setMonth(d.getMonth() + 1, 0); d.setHours(23, 59, 59, 999); }
      else if (unit === 'year') { d.setMonth(11, 31); d.setHours(23, 59, 59, 999); }
      return d.toISOString();
    }
    default:
      throw new Error(`core.datetime: unknown operation "${operation}"`);
  }
}
