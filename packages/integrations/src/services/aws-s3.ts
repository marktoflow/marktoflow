/**
 * AWS S3 Integration
 *
 * Amazon Simple Storage Service - scalable object storage.
 * API Docs: https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html
 * SDK: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  ListBucketsCommand,
  GetBucketLocationCommand,
  type PutObjectCommandInput,
  type GetObjectCommandInput,
  type DeleteObjectCommandInput,
  type ListObjectsV2CommandInput,
  type CopyObjectCommandInput,
} from '@aws-sdk/client-s3';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export interface UploadObjectOptions {
  bucket: string;
  key: string;
  body: string | Buffer | Uint8Array;
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read';
}

export interface GetObjectOptions {
  bucket: string;
  key: string;
  range?: string;
}

export interface DeleteObjectOptions {
  bucket: string;
  key: string;
}

export interface ListObjectsOptions {
  bucket: string;
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface CopyObjectOptions {
  sourceBucket: string;
  sourceKey: string;
  destinationBucket: string;
  destinationKey: string;
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read';
}

/**
 * AWS S3 client wrapper for workflow integration
 */
export class AWSS3Client {
  constructor(private client: S3Client) {}

  // ==================== Objects ====================

  /**
   * Upload object to S3
   */
  async uploadObject(options: UploadObjectOptions) {
    const input: PutObjectCommandInput = {
      Bucket: options.bucket,
      Key: options.key,
      Body: options.body,
      ContentType: options.contentType,
      Metadata: options.metadata,
      ACL: options.acl,
    };

    const command = new PutObjectCommand(input);
    return await this.client.send(command);
  }

  /**
   * Get object from S3
   */
  async getObject(options: GetObjectOptions) {
    const input: GetObjectCommandInput = {
      Bucket: options.bucket,
      Key: options.key,
      Range: options.range,
    };

    const command = new GetObjectCommand(input);
    return await this.client.send(command);
  }

  /**
   * Delete object from S3
   */
  async deleteObject(options: DeleteObjectOptions) {
    const input: DeleteObjectCommandInput = {
      Bucket: options.bucket,
      Key: options.key,
    };

    const command = new DeleteObjectCommand(input);
    return await this.client.send(command);
  }

  /**
   * List objects in bucket
   */
  async listObjects(options: ListObjectsOptions) {
    const input: ListObjectsV2CommandInput = {
      Bucket: options.bucket,
      Prefix: options.prefix,
      MaxKeys: options.maxKeys,
      ContinuationToken: options.continuationToken,
    };

    const command = new ListObjectsV2Command(input);
    return await this.client.send(command);
  }

  /**
   * Copy object
   */
  async copyObject(options: CopyObjectOptions) {
    const input: CopyObjectCommandInput = {
      Bucket: options.destinationBucket,
      Key: options.destinationKey,
      CopySource: `${options.sourceBucket}/${options.sourceKey}`,
      Metadata: options.metadata,
      ACL: options.acl,
      MetadataDirective: options.metadata ? 'REPLACE' : undefined,
    };

    const command = new CopyObjectCommand(input);
    return await this.client.send(command);
  }

  /**
   * Get object metadata
   */
  async getObjectMetadata(bucket: string, key: string) {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return await this.client.send(command);
  }

  // ==================== Buckets ====================

  /**
   * Create bucket
   */
  async createBucket(bucket: string, region?: string) {
    const command = new CreateBucketCommand({
      Bucket: bucket,
      CreateBucketConfiguration: region ? { LocationConstraint: region as any } : undefined,
    });

    return await this.client.send(command);
  }

  /**
   * Delete bucket
   */
  async deleteBucket(bucket: string) {
    const command = new DeleteBucketCommand({
      Bucket: bucket,
    });

    return await this.client.send(command);
  }

  /**
   * List buckets
   */
  async listBuckets() {
    const command = new ListBucketsCommand({});
    return await this.client.send(command);
  }

  /**
   * Get bucket location
   */
  async getBucketLocation(bucket: string) {
    const command = new GetBucketLocationCommand({
      Bucket: bucket,
    });

    return await this.client.send(command);
  }
}

export const AWSS3Initializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const region = config.auth?.['region'] as string | undefined;
    const accessKeyId = config.auth?.['access_key_id'] as string | undefined;
    const secretAccessKey = config.auth?.['secret_access_key'] as string | undefined;

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error('AWS S3 SDK requires auth.region, auth.access_key_id, and auth.secret_access_key');
    }

    const client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const wrapper = new AWSS3Client(client);

    return {
      client: wrapper,
      actions: wrapper,
      rawClient: client,
    };
  },
};
