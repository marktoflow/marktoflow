/**
 * core.parse — Parse structured data formats (json, csv, xml, yaml, url_params).
 */

export function executeParse(inputs: Record<string, unknown>): unknown {
  const data = inputs.data as string;
  const format = inputs.format as string;

  if (!data || typeof data !== 'string') throw new Error('core.parse: data must be a string');
  if (!format) throw new Error('core.parse: format is required');

  switch (format) {
    case 'json':
      return JSON.parse(data);
    case 'csv': {
      const delimiter = (inputs.delimiter as string) ?? ',';
      const hasHeader = (inputs.header as boolean) ?? true;
      const lines = data.split('\n').filter((l) => l.trim());
      if (lines.length === 0) return [];
      if (hasHeader) {
        const headers = lines[0].split(delimiter).map((h) => h.trim());
        return lines.slice(1).map((line) => {
          const values = line.split(delimiter);
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h] = (values[i] ?? '').trim(); });
          return obj;
        });
      }
      return lines.map((line) => line.split(delimiter).map((v) => v.trim()));
    }
    case 'xml': {
      const result: Record<string, unknown> = {};
      const tagRegex = /<(\w+)(?:\s[^>]*)?>([^<]*)<\/\1>/g;
      let match;
      while ((match = tagRegex.exec(data)) !== null) {
        result[match[1]] = match[2].trim();
      }
      return result;
    }
    case 'yaml': {
      try {
        const yaml = require('yaml');
        return yaml.parse(data);
      } catch {
        throw new Error('core.parse: yaml format requires the "yaml" package');
      }
    }
    case 'url_params': {
      const params = new URLSearchParams(data);
      const result: Record<string, string> = {};
      params.forEach((value, key) => { result[key] = value; });
      return result;
    }
    default:
      throw new Error(`core.parse: unknown format "${format}"`);
  }
}
