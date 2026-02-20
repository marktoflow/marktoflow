/**
 * Tests that AWSS3Client.copyObject URL-encodes the CopySource header.
 *
 * AWS requires CopySource = "<bucket>/<url-encoded-key>". Passing raw keys
 * containing spaces, +, or other special characters results in an
 * InvalidRequest / NoSuchKey error from S3 with no indication of why.
 */

import { describe, it, expect, vi } from 'vitest';
import { S3Client } from '@aws-sdk/client-s3';
import { AWSS3Client } from '../src/services/aws-s3.js';

function captureInput() {
  let captured: Record<string, unknown> = {};
  const send = vi.fn().mockImplementation((command: any) => {
    captured = command.input;
    return Promise.resolve({});
  });
  const client = { send } as unknown as S3Client;
  return { client: new AWSS3Client(client), getCaptured: () => captured };
}

describe('AWSS3Client.copyObject CopySource encoding', () => {
  it('encodes spaces in key segments', async () => {
    const { client, getCaptured } = captureInput();
    await client.copyObject({
      sourceBucket: 'src-bucket',
      sourceKey: 'my folder/report file.pdf',
      destinationBucket: 'dst-bucket',
      destinationKey: 'archive/report.pdf',
    });
    expect(getCaptured().CopySource).toBe('src-bucket/my%20folder/report%20file.pdf');
  });

  it('encodes plus signs in key', async () => {
    const { client, getCaptured } = captureInput();
    await client.copyObject({
      sourceBucket: 'src-bucket',
      sourceKey: 'uploads/a+b=c.txt',
      destinationBucket: 'dst-bucket',
      destinationKey: 'out.txt',
    });
    expect(getCaptured().CopySource).toBe('src-bucket/uploads/a%2Bb%3Dc.txt');
  });

  it('does not double-encode already safe keys', async () => {
    const { client, getCaptured } = captureInput();
    await client.copyObject({
      sourceBucket: 'my-bucket',
      sourceKey: 'plain-key/file.json',
      destinationBucket: 'dst-bucket',
      destinationKey: 'plain-key/file.json',
    });
    expect(getCaptured().CopySource).toBe('my-bucket/plain-key/file.json');
  });

  it('preserves path separators while encoding each segment', async () => {
    const { client, getCaptured } = captureInput();
    await client.copyObject({
      sourceBucket: 'b',
      sourceKey: 'a/b c/d e/f.txt',
      destinationBucket: 'b',
      destinationKey: 'out.txt',
    });
    expect(getCaptured().CopySource).toBe('b/a/b%20c/d%20e/f.txt');
  });
});
