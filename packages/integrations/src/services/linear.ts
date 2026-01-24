/**
 * Linear Integration
 *
 * Modern issue tracking for development teams.
 * API Docs: https://developers.linear.app/docs/graphql/working-with-the-graphql-api
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';

const LINEAR_API_URL = 'https://api.linear.app/graphql';

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  priorityLabel: string;
  state: { id: string; name: string; type: string };
  assignee?: { id: string; name: string; email: string };
  team: { id: string; name: string; key: string };
  project?: { id: string; name: string };
  labels: { id: string; name: string; color: string }[];
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface LinearProject {
  id: string;
  name: string;
  description?: string;
  state: string;
  progress: number;
  targetDate?: string;
  teams: { id: string; name: string }[];
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
  description?: string;
  issueCount: number;
}

export interface CreateIssueOptions {
  teamId: string;
  title: string;
  description?: string;
  priority?: number; // 0-4 (0=none, 1=urgent, 2=high, 3=medium, 4=low)
  assigneeId?: string;
  labelIds?: string[];
  projectId?: string;
  stateId?: string;
  estimate?: number;
  dueDate?: string;
  parentId?: string;
}

export interface UpdateIssueOptions {
  title?: string;
  description?: string;
  priority?: number;
  assigneeId?: string;
  labelIds?: string[];
  projectId?: string;
  stateId?: string;
  estimate?: number;
  dueDate?: string;
}

export interface SearchIssuesOptions {
  query?: string;
  teamId?: string;
  assigneeId?: string;
  stateId?: string;
  labelIds?: string[];
  projectId?: string;
  priority?: number;
  first?: number;
  after?: string;
}

/**
 * Linear GraphQL client for workflow integration
 */
export class LinearClient {
  constructor(private apiKey: string) {}

  private async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Linear API error: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as { data?: T; errors?: { message: string }[] };

    if (result.errors?.length) {
      throw new Error(`Linear GraphQL error: ${result.errors.map((e) => e.message).join(', ')}`);
    }

    return result.data as T;
  }

  /**
   * Get the current user
   */
  async getViewer(): Promise<{ id: string; name: string; email: string }> {
    const data = await this.query<{ viewer: { id: string; name: string; email: string } }>(`
      query {
        viewer {
          id
          name
          email
        }
      }
    `);
    return data.viewer;
  }

  /**
   * List teams
   */
  async listTeams(): Promise<LinearTeam[]> {
    const data = await this.query<{ teams: { nodes: LinearTeam[] } }>(`
      query {
        teams {
          nodes {
            id
            name
            key
            description
            issueCount
          }
        }
      }
    `);
    return data.teams.nodes;
  }

  /**
   * Get an issue by ID or identifier
   */
  async getIssue(idOrIdentifier: string): Promise<LinearIssue> {
    const isIdentifier = idOrIdentifier.includes('-');
    const queryField = isIdentifier ? 'issueVcsBranchSearch' : 'issue';
    const queryArg = isIdentifier ? 'branchName' : 'id';

    const data = await this.query<{ issue?: LinearIssue; issueVcsBranchSearch?: LinearIssue }>(
      `
      query GetIssue($id: String!) {
        ${queryField}(${queryArg}: $id) {
          id
          identifier
          title
          description
          priority
          priorityLabel
          state { id name type }
          assignee { id name email }
          team { id name key }
          project { id name }
          labels { nodes { id name color } }
          createdAt
          updatedAt
          url
        }
      }
    `,
      { id: idOrIdentifier }
    );

    const issue = data.issue ?? data.issueVcsBranchSearch;
    if (!issue) {
      throw new Error(`Issue not found: ${idOrIdentifier}`);
    }

    // Flatten labels
    return {
      ...issue,
      labels: (issue.labels as unknown as { nodes: { id: string; name: string; color: string }[] })?.nodes ?? [],
    };
  }

  /**
   * Create an issue
   */
  async createIssue(options: CreateIssueOptions): Promise<LinearIssue> {
    const data = await this.query<{ issueCreate: { success: boolean; issue: LinearIssue } }>(
      `
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            title
            description
            priority
            priorityLabel
            state { id name type }
            assignee { id name email }
            team { id name key }
            project { id name }
            labels { nodes { id name color } }
            createdAt
            updatedAt
            url
          }
        }
      }
    `,
      { input: options }
    );

    if (!data.issueCreate.success) {
      throw new Error('Failed to create issue');
    }

    const issue = data.issueCreate.issue;
    return {
      ...issue,
      labels: (issue.labels as unknown as { nodes: { id: string; name: string; color: string }[] })?.nodes ?? [],
    };
  }

  /**
   * Update an issue
   */
  async updateIssue(issueId: string, options: UpdateIssueOptions): Promise<LinearIssue> {
    const data = await this.query<{ issueUpdate: { success: boolean; issue: LinearIssue } }>(
      `
      mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue {
            id
            identifier
            title
            description
            priority
            priorityLabel
            state { id name type }
            assignee { id name email }
            team { id name key }
            project { id name }
            labels { nodes { id name color } }
            createdAt
            updatedAt
            url
          }
        }
      }
    `,
      { id: issueId, input: options }
    );

    if (!data.issueUpdate.success) {
      throw new Error('Failed to update issue');
    }

    const issue = data.issueUpdate.issue;
    return {
      ...issue,
      labels: (issue.labels as unknown as { nodes: { id: string; name: string; color: string }[] })?.nodes ?? [],
    };
  }

  /**
   * Search issues
   */
  async searchIssues(options: SearchIssuesOptions = {}): Promise<{ issues: LinearIssue[]; hasMore: boolean; endCursor?: string }> {
    const { query, teamId, assigneeId, projectId, priority, first = 25, after } = options;

    // Build filter
    const filters: string[] = [];
    if (teamId) filters.push(`team: { id: { eq: "${teamId}" } }`);
    if (assigneeId) filters.push(`assignee: { id: { eq: "${assigneeId}" } }`);
    if (projectId) filters.push(`project: { id: { eq: "${projectId}" } }`);
    if (priority !== undefined) filters.push(`priority: { eq: ${priority} }`);

    const filterArg = filters.length > 0 ? `filter: { ${filters.join(', ')} }` : '';
    const queryArg = query ? `query: "${query}"` : '';
    const paginationArgs = `first: ${first}${after ? `, after: "${after}"` : ''}`;

    const allArgs = [queryArg, filterArg, paginationArgs].filter(Boolean).join(', ');

    const data = await this.query<{
      issues: {
        nodes: LinearIssue[];
        pageInfo: { hasNextPage: boolean; endCursor?: string };
      };
    }>(`
      query {
        issues(${allArgs}) {
          nodes {
            id
            identifier
            title
            description
            priority
            priorityLabel
            state { id name type }
            assignee { id name email }
            team { id name key }
            project { id name }
            labels { nodes { id name color } }
            createdAt
            updatedAt
            url
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `);

    return {
      issues: data.issues.nodes.map((issue) => ({
        ...issue,
        labels: (issue.labels as unknown as { nodes: { id: string; name: string; color: string }[] })?.nodes ?? [],
      })),
      hasMore: data.issues.pageInfo.hasNextPage,
      endCursor: data.issues.pageInfo.endCursor,
    };
  }

  /**
   * List projects
   */
  async listProjects(teamId?: string): Promise<LinearProject[]> {
    const filter = teamId ? `filter: { accessibleTeams: { id: { eq: "${teamId}" } } }` : '';

    const data = await this.query<{ projects: { nodes: LinearProject[] } }>(`
      query {
        projects(${filter}) {
          nodes {
            id
            name
            description
            state
            progress
            targetDate
            teams { nodes { id name } }
          }
        }
      }
    `);

    return data.projects.nodes.map((project) => ({
      ...project,
      teams: (project.teams as unknown as { nodes: { id: string; name: string }[] })?.nodes ?? [],
    }));
  }

  /**
   * Get workflow states for a team
   */
  async getWorkflowStates(teamId: string): Promise<{ id: string; name: string; type: string; position: number }[]> {
    const data = await this.query<{
      team: { states: { nodes: { id: string; name: string; type: string; position: number }[] } };
    }>(
      `
      query GetStates($teamId: String!) {
        team(id: $teamId) {
          states {
            nodes {
              id
              name
              type
              position
            }
          }
        }
      }
    `,
      { teamId }
    );

    return data.team.states.nodes;
  }

  /**
   * Add a comment to an issue
   */
  async addComment(issueId: string, body: string): Promise<{ id: string; body: string; createdAt: string }> {
    const data = await this.query<{
      commentCreate: { success: boolean; comment: { id: string; body: string; createdAt: string } };
    }>(
      `
      mutation AddComment($issueId: String!, $body: String!) {
        commentCreate(input: { issueId: $issueId, body: $body }) {
          success
          comment {
            id
            body
            createdAt
          }
        }
      }
    `,
      { issueId, body }
    );

    if (!data.commentCreate.success) {
      throw new Error('Failed to add comment');
    }

    return data.commentCreate.comment;
  }

  /**
   * Archive an issue
   */
  async archiveIssue(issueId: string): Promise<void> {
    const data = await this.query<{ issueArchive: { success: boolean } }>(
      `
      mutation ArchiveIssue($id: String!) {
        issueArchive(id: $id) {
          success
        }
      }
    `,
      { id: issueId }
    );

    if (!data.issueArchive.success) {
      throw new Error('Failed to archive issue');
    }
  }
}

export const LinearInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const apiKey = config.auth?.['api_key'] as string | undefined;
    if (!apiKey) {
      throw new Error('Linear SDK requires auth.api_key');
    }

    const client = new LinearClient(apiKey);
    return {
      client,
      actions: client,
    };
  },
};
