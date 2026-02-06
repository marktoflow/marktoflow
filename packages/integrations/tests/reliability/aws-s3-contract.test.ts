/**
 * Contract tests for AWS S3 integration
 *
 * These tests validate that:
 * 1. The SDK makes correct HTTP requests
 * 2. Input validation schemas work as expected
 * 3. Response handling is correct
 * 4. The integration behaves correctly without hitting real APIs
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { wrapIntegration } from '../../src/reliability/wrapper.js';
import { awsS3Schemas } from '../../src/reliability/schemas/aws-s3.js';
import { S3Client } from '@aws-sdk/client-s3';
import { AWSS3Client } from '../../src/services/aws-s3.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // List buckets
  http.get('https://s3.us-east-1.amazonaws.com/', () => {
    return new HttpResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
      <ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
        <Buckets>
          <Bucket>
            <Name>test-bucket-1</Name>
            <CreationDate>2024-01-01T00:00:00.000Z</CreationDate>
          </Bucket>
          <Bucket>
            <Name>test-bucket-2</Name>
            <CreationDate>2024-01-02T00:00:00.000Z</CreationDate>
          </Bucket>
        </Buckets>
      </ListAllMyBucketsResult>`,
      {
        headers: {
          'Content-Type': 'application/xml',
        },
      }
    );
  }),

  // Put object
  http.put('https://:bucket.s3.us-east-1.amazonaws.com/:key', ({ params }) => {
    return new HttpResponse(null, {
      status: 200,
      headers: {
        'ETag': '"test-etag-123"',
        'x-amz-request-id': 'test-request-id',
      },
    });
  }),

  // Get object
  http.get('https://:bucket.s3.us-east-1.amazonaws.com/:key', ({ params }) => {
    return new HttpResponse('Test file content', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': '17',
        'ETag': '"test-etag-123"',
      },
    });
  }),

  // Delete object
  http.delete('https://:bucket.s3.us-east-1.amazonaws.com/:key', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // List objects
  http.get('https://:bucket.s3.us-east-1.amazonaws.com/', ({ request }) => {
    const url = new URL(request.url);
    const prefix = url.searchParams.get('prefix') || '';

    return new HttpResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
      <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
        <Name>test-bucket</Name>
        <Prefix>${prefix}</Prefix>
        <MaxKeys>1000</MaxKeys>
        <IsTruncated>false</IsTruncated>
        <Contents>
          <Key>file1.txt</Key>
          <Size>1024</Size>
          <ETag>"etag1"</ETag>
          <LastModified>2024-01-01T00:00:00.000Z</LastModified>
        </Contents>
        <Contents>
          <Key>file2.txt</Key>
          <Size>2048</Size>
          <ETag>"etag2"</ETag>
          <LastModified>2024-01-02T00:00:00.000Z</LastModified>
        </Contents>
      </ListBucketResult>`,
      {
        headers: {
          'Content-Type': 'application/xml',
        },
      }
    );
  }),

  // Copy object
  http.put('https://:destBucket.s3.us-east-1.amazonaws.com/:destKey', ({ request }) => {
    const copySource = request.headers.get('x-amz-copy-source');

    if (!copySource) {
      return new HttpResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Error>
          <Code>InvalidRequest</Code>
          <Message>Missing x-amz-copy-source header</Message>
        </Error>`,
        {
          status: 400,
          headers: {
            'Content-Type': 'application/xml',
          },
        }
      );
    }

    return new HttpResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
      <CopyObjectResult>
        <ETag>"copied-etag-123"</ETag>
        <LastModified>2024-01-01T00:00:00.000Z</LastModified>
      </CopyObjectResult>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
        },
      }
    );
  }),

  // Head object (get metadata)
  http.head('https://:bucket.s3.us-east-1.amazonaws.com/:key', () => {
    return new HttpResponse(null, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': '1024',
        'ETag': '"test-etag-123"',
        'Last-Modified': 'Mon, 01 Jan 2024 00:00:00 GMT',
      },
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('AWS S3 Contract Tests', () => {
  it('should upload an object successfully', async () => {
    const s3Client = new S3Client({
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
      },
    });
    const client = new AWSS3Client(s3Client);
    const wrapped = wrapIntegration('aws-s3', client, {
      inputSchemas: awsS3Schemas,
    });

    const result = await wrapped.uploadObject({
      bucket: 'test-bucket',
      key: 'test-file.txt',
      body: 'Test file content',
      contentType: 'text/plain',
    });

    expect(result).toBeDefined();
    expect(result.ETag).toBe('"test-etag-123"');
  });

  it('should reject empty bucket name', async () => {
    const s3Client = new S3Client({
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
      },
    });
    const client = new AWSS3Client(s3Client);
    const wrapped = wrapIntegration('aws-s3', client, {
      inputSchemas: awsS3Schemas,
    });

    await expect(
      wrapped.uploadObject({
        bucket: '',
        key: 'test-file.txt',
        body: 'Test content',
      })
    ).rejects.toThrow(/bucket/);
  });

  it('should reject empty key', async () => {
    const s3Client = new S3Client({
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
      },
    });
    const client = new AWSS3Client(s3Client);
    const wrapped = wrapIntegration('aws-s3', client, {
      inputSchemas: awsS3Schemas,
    });

    await expect(
      wrapped.uploadObject({
        bucket: 'test-bucket',
        key: '',
        body: 'Test content',
      })
    ).rejects.toThrow(/key/);
  });

  it('should get an object successfully', async () => {
    const s3Client = new S3Client({
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
      },
    });
    const client = new AWSS3Client(s3Client);
    const wrapped = wrapIntegration('aws-s3', client, {
      inputSchemas: awsS3Schemas,
    });

    const result = await wrapped.getObject({
      bucket: 'test-bucket',
      key: 'test-file.txt',
    });

    expect(result).toBeDefined();
    expect(result.ETag).toBe('"test-etag-123"');
  });

  it('should delete an object successfully', async () => {
    const s3Client = new S3Client({
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
      },
    });
    const client = new AWSS3Client(s3Client);
    const wrapped = wrapIntegration('aws-s3', client, {
      inputSchemas: awsS3Schemas,
    });

    const result = await wrapped.deleteObject({
      bucket: 'test-bucket',
      key: 'test-file.txt',
    });

    expect(result).toBeDefined();
  });

  it('should list objects successfully', async () => {
    const s3Client = new S3Client({
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
      },
    });
    const client = new AWSS3Client(s3Client);
    const wrapped = wrapIntegration('aws-s3', client, {
      inputSchemas: awsS3Schemas,
    });

    const result = await wrapped.listObjects({
      bucket: 'test-bucket',
      prefix: 'folder/',
    });

    expect(result).toBeDefined();
    expect(result.Contents).toBeDefined();
  });

  it('should list buckets successfully', async () => {
    const s3Client = new S3Client({
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
      },
    });
    const client = new AWSS3Client(s3Client);
    const wrapped = wrapIntegration('aws-s3', client, {
      inputSchemas: awsS3Schemas,
    });

    const result = await wrapped.listBuckets();

    expect(result).toBeDefined();
    expect(result.Buckets).toBeDefined();
  });

  it('should get object metadata successfully', async () => {
    const s3Client = new S3Client({
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
      },
    });
    const client = new AWSS3Client(s3Client);
    const wrapped = wrapIntegration('aws-s3', client, {
      inputSchemas: awsS3Schemas,
    });

    const result = await wrapped.getObjectMetadata('test-bucket', 'test-file.txt');

    expect(result).toBeDefined();
    expect(result.ETag).toBe('"test-etag-123"');
    expect(result.ContentLength).toBe(1024);
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.put('https://:bucket.s3.us-east-1.amazonaws.com/:key', () => {
        return new HttpResponse(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Error>
            <Code>AccessDenied</Code>
            <Message>Access Denied</Message>
          </Error>`,
          {
            status: 403,
            headers: {
              'Content-Type': 'application/xml',
            },
          }
        );
      })
    );

    const s3Client = new S3Client({
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'invalid-key',
        secretAccessKey: 'invalid-secret',
      },
    });
    const client = new AWSS3Client(s3Client);
    const wrapped = wrapIntegration('aws-s3', client, {
      inputSchemas: awsS3Schemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.uploadObject({
        bucket: 'test-bucket',
        key: 'test-file.txt',
        body: 'Test content',
      })
    ).rejects.toThrow();
  });
});
