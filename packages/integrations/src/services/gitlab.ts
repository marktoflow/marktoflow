/**
 * GitLab Integration
 *
 * DevOps & Monitoring - Git repository and CI/CD platform.
 * API Docs: https://docs.gitlab.com/ee/api/
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { BaseApiClient } from './base-client.js';
import { wrapIntegration } from '../reliability/wrapper.js';
import { gitlabSchemas } from '../reliability/schemas/gitlab.js';

const GITLAB_API_URL = 'https://gitlab.com/api/v4';

export interface GitLabProject {
  id: number;
  name: string;
  description: string;
  web_url: string;
  path_with_namespace: string;
  default_branch: string;
  visibility: string;
  created_at: string;
  last_activity_at: string;
}

export interface GitLabIssue {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: 'opened' | 'closed';
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  labels: string[];
  author: { id: number; username: string; name: string };
  assignee: { id: number; username: string; name: string } | null;
  web_url: string;
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: 'opened' | 'closed' | 'merged';
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  source_branch: string;
  target_branch: string;
  author: { id: number; username: string; name: string };
  assignee: { id: number; username: string; name: string } | null;
  web_url: string;
  merge_status: string;
  draft: boolean;
}

export interface GitLabPipeline {
  id: number;
  project_id: number;
  status: 'created' | 'waiting_for_resource' | 'preparing' | 'pending' | 'running' | 'success' | 'failed' | 'canceled' | 'skipped';
  ref: string;
  sha: string;
  web_url: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration: number | null;
}

/**
 * GitLab API client for workflow integration
 */
export class GitLabClient extends BaseApiClient {
  constructor(token: string, baseUrl?: string) {
    super({
      baseUrl: baseUrl || GITLAB_API_URL,
      authType: 'apikey',
      apiKeyAuth: {
        headerName: 'PRIVATE-TOKEN',
        value: token,
      },
      serviceName: 'GitLab',
    });
  }

  /**
   * List projects
   */
  async listProjects(options?: {
    owned?: boolean;
    membership?: boolean;
    simple?: boolean;
  }): Promise<GitLabProject[]> {
    const params: Record<string, string> = {};
    if (options?.owned) params.owned = 'true';
    if (options?.membership) params.membership = 'true';
    if (options?.simple) params.simple = 'true';
    return this.get('/projects', { params });
  }

  /**
   * Get a project by ID
   */
  async getProject(projectId: string | number): Promise<GitLabProject> {
    return this.get(`/projects/${encodeURIComponent(projectId)}`);
  }

  /**
   * Create an issue
   */
  async createIssue(projectId: string | number, title: string, options?: {
    description?: string;
    labels?: string[];
    assigneeId?: number;
  }): Promise<GitLabIssue> {
    return this.post(`/projects/${encodeURIComponent(projectId)}/issues`, {
      title,
      description: options?.description,
      labels: options?.labels?.join(','),
      assignee_id: options?.assigneeId,
    });
  }

  /**
   * List issues for a project
   */
  async listIssues(projectId: string | number, options?: {
    state?: 'opened' | 'closed' | 'all';
    labels?: string[];
  }): Promise<GitLabIssue[]> {
    const params: Record<string, string> = {};
    if (options?.state) params.state = options.state;
    if (options?.labels) params.labels = options.labels.join(',');
    return this.get(`/projects/${encodeURIComponent(projectId)}/issues`, { params });
  }

  /**
   * Get an issue by IID
   */
  async getIssue(projectId: string | number, issueIid: number): Promise<GitLabIssue> {
    return this.get(`/projects/${encodeURIComponent(projectId)}/issues/${issueIid}`);
  }

  /**
   * Update an issue
   */
  async updateIssue(projectId: string | number, issueIid: number, updates: {
    title?: string;
    description?: string;
    state_event?: 'close' | 'reopen';
    labels?: string[];
  }): Promise<GitLabIssue> {
    return this.put(`/projects/${encodeURIComponent(projectId)}/issues/${issueIid}`, {
      ...updates,
      labels: updates.labels?.join(','),
    });
  }

  /**
   * Create a merge request
   */
  async createMergeRequest(projectId: string | number, sourceBranch: string, targetBranch: string, title: string, options?: {
    description?: string;
    assigneeId?: number;
    labels?: string[];
  }): Promise<GitLabMergeRequest> {
    return this.post(`/projects/${encodeURIComponent(projectId)}/merge_requests`, {
      source_branch: sourceBranch,
      target_branch: targetBranch,
      title,
      description: options?.description,
      assignee_id: options?.assigneeId,
      labels: options?.labels?.join(','),
    });
  }

  /**
   * List merge requests for a project
   */
  async listMergeRequests(projectId: string | number, options?: {
    state?: 'opened' | 'closed' | 'merged' | 'all';
  }): Promise<GitLabMergeRequest[]> {
    const params: Record<string, string> = {};
    if (options?.state) params.state = options.state;
    return this.get(`/projects/${encodeURIComponent(projectId)}/merge_requests`, { params });
  }

  /**
   * Get a merge request by IID
   */
  async getMergeRequest(projectId: string | number, mergeRequestIid: number): Promise<GitLabMergeRequest> {
    return this.get(`/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}`);
  }

  /**
   * Merge a merge request
   */
  async mergeMergeRequest(projectId: string | number, mergeRequestIid: number, options?: {
    merge_commit_message?: string;
    should_remove_source_branch?: boolean;
  }): Promise<GitLabMergeRequest> {
    return this.put(`/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/merge`, options);
  }

  /**
   * List pipelines for a project
   */
  async listPipelines(projectId: string | number, options?: {
    status?: string;
    ref?: string;
  }): Promise<GitLabPipeline[]> {
    const params: Record<string, string> = {};
    if (options?.status) params.status = options.status;
    if (options?.ref) params.ref = options.ref;
    return this.get(`/projects/${encodeURIComponent(projectId)}/pipelines`, { params });
  }

  /**
   * Get a pipeline by ID
   */
  async getPipeline(projectId: string | number, pipelineId: number): Promise<GitLabPipeline> {
    return this.get(`/projects/${encodeURIComponent(projectId)}/pipelines/${pipelineId}`);
  }

  /**
   * Create a pipeline
   */
  async createPipeline(projectId: string | number, ref: string, variables?: Record<string, string>): Promise<GitLabPipeline> {
    const body: { ref: string; variables?: Array<{ key: string; value: string }> } = { ref };
    if (variables) {
      body.variables = Object.entries(variables).map(([key, value]) => ({ key, value }));
    }
    return this.post(`/projects/${encodeURIComponent(projectId)}/pipeline`, body);
  }
}

export const GitLabInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const token = config.auth?.['token'] as string | undefined;
    const baseUrl = config.auth?.['base_url'] as string | undefined;

    if (!token) {
      throw new Error('GitLab SDK requires auth.token');
    }

    const client = new GitLabClient(token, baseUrl);
    const wrapped = wrapIntegration('gitlab', client, {
      timeout: 30000,
      retryOn: [429, 500, 502, 503],
      maxRetries: 3,
      inputSchemas: gitlabSchemas,
    });
    return {
      client: wrapped,
      actions: wrapped,
    };
  },
};
