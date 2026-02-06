/**
 * Sentry Integration
 *
 * DevOps & Monitoring - Error tracking platform.
 * API Docs: https://docs.sentry.io/api/
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { BaseApiClient } from './base-client.js';
import { wrapIntegration } from '../reliability/wrapper.js';
import { sentrySchemas } from '../reliability/schemas/sentry.js';

const SENTRY_API_URL = 'https://sentry.io/api/0';

export interface SentryIssue {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  permalink: string;
  logger: string;
  level: string;
  status: 'resolved' | 'unresolved' | 'ignored';
  statusDetails: Record<string, unknown>;
  isPublic: boolean;
  platform: string;
  project: { id: string; name: string; slug: string };
  type: string;
  metadata: Record<string, unknown>;
  numComments: number;
  assignedTo: { id: string; name: string; email: string } | null;
  isBookmarked: boolean;
  isSubscribed: boolean;
  hasSeen: boolean;
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
}

export interface SentryProject {
  id: string;
  slug: string;
  name: string;
  platform: string;
  dateCreated: string;
  isBookmarked: boolean;
  isMember: boolean;
  features: string[];
  firstEvent: string | null;
  hasAccess: boolean;
  status: string;
}

export interface SentryRelease {
  version: string;
  shortVersion: string;
  ref: string | null;
  url: string | null;
  dateCreated: string;
  dateReleased: string | null;
  newGroups: number;
  commitCount: number;
  lastCommit: Record<string, unknown> | null;
  deployCount: number;
  lastDeploy: Record<string, unknown> | null;
  authors: Array<{ name: string; email: string }>;
  projects: Array<{ slug: string; name: string }>;
}

/**
 * Sentry API client for workflow integration
 */
export class SentryClient extends BaseApiClient {
  private organization: string;

  constructor(token: string, organization: string) {
    super({
      baseUrl: SENTRY_API_URL,
      authType: 'bearer',
      authValue: token,
      serviceName: 'Sentry',
    });
    this.organization = organization;
  }

  /**
   * List issues for a project
   */
  async listIssues(project: string, options?: {
    statuses?: string[];
    query?: string;
    limit?: number;
  }): Promise<SentryIssue[]> {
    const params: Record<string, string> = {
      project,
      query: options?.query || '',
    };
    if (options?.statuses) params.statsPeriod = '';
    if (options?.limit) params.limit = String(options.limit);

    return this.get(`/organizations/${this.organization}/issues/`, { params: params as Record<string, string> });
  }

  /**
   * Get an issue by ID
   */
  async getIssue(issueId: string): Promise<SentryIssue> {
    return this.get(`/issues/${issueId}/`);
  }

  /**
   * Update an issue
   */
  async updateIssue(issueId: string, updates: {
    status?: 'resolved' | 'unresolved' | 'ignored';
    assignedTo?: string;
    hasSeen?: boolean;
    isBookmarked?: boolean;
  }): Promise<SentryIssue> {
    return this.put(`/issues/${issueId}/`, updates);
  }

  /**
   * Delete an issue
   */
  async deleteIssue(issueId: string): Promise<void> {
    return this.delete(`/issues/${issueId}/`);
  }

  /**
   * List projects
   */
  async listProjects(): Promise<SentryProject[]> {
    return this.get(`/organizations/${this.organization}/projects/`);
  }

  /**
   * Get a project
   */
  async getProject(projectSlug: string): Promise<SentryProject> {
    return this.get(`/projects/${this.organization}/${projectSlug}/`);
  }

  /**
   * List releases for an organization
   */
  async listReleases(): Promise<SentryRelease[]> {
    return this.get(`/organizations/${this.organization}/releases/`);
  }

  /**
   * Create a release
   */
  async createRelease(version: string, projects: string[], options?: {
    ref?: string;
    url?: string;
    dateReleased?: string;
  }): Promise<SentryRelease> {
    return this.post(`/organizations/${this.organization}/releases/`, {
      version,
      projects,
      ref: options?.ref,
      url: options?.url,
      dateReleased: options?.dateReleased,
    });
  }
}

export const SentryInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const token = config.auth?.['token'] as string | undefined;
    const organization = config.auth?.['organization'] as string | undefined;

    if (!token) {
      throw new Error('Sentry SDK requires auth.token');
    }
    if (!organization) {
      throw new Error('Sentry SDK requires auth.organization (organization slug)');
    }

    const client = new SentryClient(token, organization);
    const wrapped = wrapIntegration('sentry', client, {
      timeout: 30000,
      retryOn: [429, 500, 502, 503],
      maxRetries: 3,
      inputSchemas: sentrySchemas,
    });
    return {
      client: wrapped,
      actions: wrapped,
    };
  },
};
