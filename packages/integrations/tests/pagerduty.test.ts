import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PagerDutyClient, PagerDutyInitializer } from '../src/services/pagerduty.js';

describe('PagerDutyClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: PagerDutyClient;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    client = new PagerDutyClient('test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockOk(body: unknown) {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  }

  function calledUrl(): string {
    return fetchMock.mock.calls[0][0] as string;
  }

  // ── listIncidents — array param encoding ──────────────────────────────────

  describe('listIncidents()', () => {
    const emptyResponse = {
      incidents: [],
      limit: 25,
      offset: 0,
      total: 0,
      more: false,
    };

    it('sends no query params when called with no options', async () => {
      mockOk(emptyResponse);
      await client.listIncidents();

      const url = calledUrl();
      expect(url).toBe('https://api.pagerduty.com/incidents');
    });

    it('encodes a single status as repeated statuses[] param', async () => {
      mockOk(emptyResponse);
      await client.listIncidents({ statuses: ['triggered'] });

      const url = new URL(calledUrl());
      const statuses = url.searchParams.getAll('statuses[]');
      expect(statuses).toEqual(['triggered']);
    });

    it('encodes multiple statuses as repeated statuses[] params (not comma-joined)', async () => {
      mockOk(emptyResponse);
      await client.listIncidents({ statuses: ['triggered', 'acknowledged'] });

      const url = new URL(calledUrl());
      const statuses = url.searchParams.getAll('statuses[]');
      // Must be two separate values, not 'triggered,acknowledged'
      expect(statuses).toHaveLength(2);
      expect(statuses).toContain('triggered');
      expect(statuses).toContain('acknowledged');
      // The comma-joined form must NOT appear
      expect(url.search).not.toContain('triggered,acknowledged');
    });

    it('encodes multiple serviceIds as repeated service_ids[] params', async () => {
      mockOk(emptyResponse);
      await client.listIncidents({ serviceIds: ['SVC1', 'SVC2', 'SVC3'] });

      const url = new URL(calledUrl());
      const ids = url.searchParams.getAll('service_ids[]');
      expect(ids).toHaveLength(3);
      expect(ids).toContain('SVC1');
      expect(ids).toContain('SVC2');
      expect(ids).toContain('SVC3');
      expect(url.search).not.toContain('SVC1,SVC2');
    });

    it('combines statuses, serviceIds, limit, and offset', async () => {
      mockOk(emptyResponse);
      await client.listIncidents({
        statuses: ['triggered', 'resolved'],
        serviceIds: ['SVC1'],
        limit: 50,
        offset: 100,
      });

      const url = new URL(calledUrl());
      expect(url.searchParams.getAll('statuses[]')).toHaveLength(2);
      expect(url.searchParams.getAll('service_ids[]')).toEqual(['SVC1']);
      expect(url.searchParams.get('limit')).toBe('50');
      expect(url.searchParams.get('offset')).toBe('100');
    });

    it('handles empty statuses array without adding the param', async () => {
      mockOk(emptyResponse);
      await client.listIncidents({ statuses: [] });

      const url = new URL(calledUrl());
      expect(url.searchParams.getAll('statuses[]')).toHaveLength(0);
    });

    it('returns parsed incident list', async () => {
      const incident = {
        id: 'INC1',
        incident_number: 42,
        title: 'Test Incident',
        description: '',
        status: 'triggered',
        urgency: 'high',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        service: { id: 'SVC1', summary: 'Payments' },
        assignments: [],
        escalation_policy: { id: 'EP1', summary: 'Default' },
      };
      mockOk({ incidents: [incident], limit: 25, offset: 0, total: 1, more: false });

      const result = await client.listIncidents();
      expect(result.incidents).toHaveLength(1);
      expect(result.incidents[0].id).toBe('INC1');
    });
  });

  // ── Other methods — sanity checks ──────────────────────────────────────────

  describe('getIncident()', () => {
    it('calls the correct endpoint', async () => {
      mockOk({
        incident: {
          id: 'INC1',
          incident_number: 1,
          title: 'Test',
          description: '',
          status: 'triggered',
          urgency: 'high',
          created_at: '',
          updated_at: '',
          service: { id: 's', summary: 's' },
          assignments: [],
          escalation_policy: { id: 'e', summary: 'e' },
        },
      });

      await client.getIncident('INC1');
      expect(calledUrl()).toContain('/incidents/INC1');
    });
  });
});

// ── Initializer ───────────────────────────────────────────────────────────────

describe('PagerDutyInitializer', () => {
  it('throws if api_key is missing', async () => {
    await expect(
      PagerDutyInitializer.initialize({}, { sdk: 'pagerduty', auth: {} }),
    ).rejects.toThrow('api_key');
  });

  it('initializes with api_key', async () => {
    const result = await PagerDutyInitializer.initialize({}, {
      sdk: 'pagerduty',
      auth: { api_key: 'test-key' },
    });
    expect(result).toHaveProperty('client');
    expect(result).toHaveProperty('actions');
  });
});
