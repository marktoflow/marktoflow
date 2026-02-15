/**
 * core.compress / core.decompress — Compression operations.
 */

export function executeCompress(inputs: Record<string, unknown>): unknown {
  const { gzipSync, deflateSync } = require('node:zlib');
  const data = inputs.data as string;
  const algorithm = (inputs.algorithm as string) ?? 'gzip';

  if (!data) throw new Error('core.compress: data is required');

  const buf = Buffer.from(data, 'utf8');
  switch (algorithm) {
    case 'gzip':
      return gzipSync(buf).toString('base64');
    case 'deflate':
      return deflateSync(buf).toString('base64');
    default:
      throw new Error(`core.compress: unknown algorithm "${algorithm}"`);
  }
}

export function executeDecompress(inputs: Record<string, unknown>): unknown {
  const { gunzipSync, inflateSync } = require('node:zlib');
  const data = inputs.data as string;
  const algorithm = (inputs.algorithm as string) ?? 'gzip';

  if (!data) throw new Error('core.decompress: data is required');

  const buf = Buffer.from(data, 'base64');
  switch (algorithm) {
    case 'gzip':
      return gunzipSync(buf).toString('utf8');
    case 'deflate':
      return inflateSync(buf).toString('utf8');
    default:
      throw new Error(`core.decompress: unknown algorithm "${algorithm}"`);
  }
}
