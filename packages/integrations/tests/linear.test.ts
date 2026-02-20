import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LinearClient, LinearInitializer } from '../src/services/linear.js';

describe('LinearClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: LinearClient;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    client = new LinearClient('lin_api_test_key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockGraphQL(data: Record<string, unknown>) {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data }),
    });
  }

  function capturedBody(): Record<string, unknown> {
    const call = fetchMock.mock.calls[0];
    return JSON.parse(call[1].body as string) as Record<string, unknown>;
  }

  // ── getIssue routing ────────────────────────────────────────────────────────

  describe('getIssue() — routing heuristic', () => {
    const issuePayload = {
      id: 'abc',
      identifier: 'ENG-42',
      title: 'Test',
      description: null,
      priority: 0,
      priorityLabel: 'No priority',
      state: { id: 's1', name: 'Todo', type: 'unstarted' },
      assignee: null,
      team: { id: 't1', name: 'Eng', key: 'ENG' },
      project: null,
      labels: { nodes: [] },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      url: 'https://linear.app/issue/ENG-42',
    };

    it('routes UUID to issue() query, not issueVcsBranchSearch()', async () => {
      mockGraphQL({ issue: issuePayload });

      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      await client.getIssue(uuid);

      const body = capturedBody();
      // Must use 'issue' field, not 'issueVcsBranchSearch'
      expect(body.query).toMatch(/issue\(/);
      expect(body.query).not.toMatch(/issueVcsBranchSearch/);
      expect(body.variables).toEqual({ id: uuid });
    });

    it('routes Linear identifier (e.g. ENG-123) to issue() query', async () => {
      mockGraphQL({ issue: issuePayload });

      await client.getIssue('ENG-42');

      const body = capturedBody();
      expect(body.query).toMatch(/issue\(/);
      expect(body.query).not.toMatch(/issueVcsBranchSearch/);
      expect(body.variables).toEqual({ id: 'ENG-42' });
    });

    it('routes branch name to issueVcsBranchSearch()', async () => {
      mockGraphQL({ issueVcsBranchSearch: issuePayload });

      await client.getIssue('eng-42-fix-some-bug');

      const body = capturedBody();
      expect(body.query).toMatch(/issueVcsBranchSearch/);
      expect(body.query).not.toMatch(/\bissue\(/);
      expect(body.variables).toEqual({ id: 'eng-42-fix-some-bug' });
    });

    it('routes multi-segment branch name to issueVcsBranchSearch()', async () => {
      mockGraphQL({ issueVcsBranchSearch: issuePayload });

      await client.getIssue('feature/ENG-42-my-feature');

      const body = capturedBody();
      expect(body.query).toMatch(/issueVcsBranchSearch/);
    });

    it('throws when issue is not found', async () => {
      mockGraphQL({ issue: null });

      await expect(client.getIssue('ENG-999')).rejects.toThrow('Issue not found');
    });
  });

  // ── searchIssues — no string interpolation ──────────────────────────────────

  describe('searchIssues() — uses GraphQL variables', () => {
    const emptyResult = {
      issues: {
        nodes: [],
        pageInfo: { hasNextPage: false, endCursor: undefined },
      },
    };

    it('passes query text as a variable, not inline', async () => {
      mockGraphQL(emptyResult);

      await client.searchIssues({ query: 'bug with "quotes"' });

      const body = capturedBody();
      // query text must NOT appear in the GraphQL query string
      expect(body.query).not.toContain('"quotes"');
      // but must appear as a variable
      expect((body.variables as Record<string, unknown>).query).toBe('bug with "quotes"');
    });

    it('passes teamId as a filter variable', async () => {
      mockGraphQL(emptyResult);

      await client.searchIssues({ teamId: 'team-uuid-123' });

      const body = capturedBody();
      expect(body.query).not.toContain('team-uuid-123');
      const filter = (body.variables as Record<string, unknown>).filter as Record<string, unknown>;
      expect(filter).toBeDefined();
      expect((filter.team as any).id.eq).toBe('team-uuid-123');
    });

    it('passes after cursor as a variable', async () => {
      mockGraphQL(emptyResult);

      await client.searchIssues({ after: 'cursor=="value"' });

      const body = capturedBody();
      // cursor must not be interpolated into the query string
      expect(body.query).not.toContain('cursor==');
      expect((body.variables as Record<string, unknown>).after).toBe('cursor=="value"');
    });

    it('passes priority as a filter variable', async () => {
      mockGraphQL(emptyResult);

      await client.searchIssues({ priority: 1 });

      const body = capturedBody();
      const filter = (body.variables as Record<string, unknown>).filter as Record<string, unknown>;
      expect((filter.priority as any).eq).toBe(1);
    });

    it('includes no filter variable when no filters set', async () => {
      mockGraphQL(emptyResult);

      await client.searchIssues({ first: 10 });

      const body = capturedBody();
      expect((body.variables as Record<string, unknown>).filter).toBeUndefined();
    });
  });

  // ── listProjects — no string interpolation ──────────────────────────────────

  describe('listProjects() — uses GraphQL variables', () => {
    const emptyProjects = { projects: { nodes: [] } };

    it('passes teamId as a variable, not inline', async () => {
      mockGraphQL(emptyProjects);

      await client.listProjects('team-id-with-"quotes"');

      const body = capturedBody();
      expect(body.query).not.toContain('"quotes"');
      const vars = body.variables as Record<string, unknown>;
      const filter = vars.filter as Record<string, unknown>;
      expect((filter.accessibleTeams as any).id.eq).toBe('team-id-with-"quotes"');
    });

    it('sends no variables when teamId is omitted', async () => {
      mockGraphQL(emptyProjects);

      await client.listProjects();

      const body = capturedBody();
      const vars = body.variables as Record<string, unknown>;
      expect(vars?.filter).toBeUndefined();
    });
  });
});

// ── Initializer ───────────────────────────────────────────────────────────────

describe('LinearInitializer', () => {
  it('throws if api_key is missing', async () => {
    await expect(LinearInitializer.initialize({}, { sdk: 'linear', auth: {} })).rejects.toThrow(
      'api_key',
    );
  });

  it('initializes with api_key', async () => {
    const result = await LinearInitializer.initialize({}, {
      sdk: 'linear',
      auth: { api_key: 'lin_api_test' },
    });
    expect(result).toBeDefined();
    expect(result).toHaveProperty('client');
    expect(result).toHaveProperty('actions');
  });
});
