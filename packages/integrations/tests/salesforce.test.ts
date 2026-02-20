import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SalesforceClient, SalesforceInitializer } from '../src/services/salesforce.js';

describe('SalesforceClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockJson(body: unknown) {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  }

  function mockJsonOnce(body: unknown, status = 200) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  }

  it('encodes objectType in createRecord path', async () => {
    mockJson({ id: '001', success: true, errors: [] });
    const client = new SalesforceClient('https://example.my.salesforce.com', 'token');

    await client.createRecord('Custom/Object', { Name: 'Test' });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/sobjects/Custom%2FObject');
    expect(url).not.toContain('/sobjects/Custom/Object');
  });

  it('encodes objectType and id in getRecord path', async () => {
    mockJsonOnce({ Id: 'abc/123', attributes: { type: 'Case', url: '/x' } });
    const client = new SalesforceClient('https://example.my.salesforce.com', 'token');

    await client.getRecord('Case/Sub', 'abc/123');

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/sobjects/Case%2FSub/abc%2F123');
    expect(url).not.toContain('/sobjects/Case/Sub/abc/123');
  });

  it('encodes objectType and id in updateRecord path', async () => {
    mockJsonOnce({}, 204);
    const client = new SalesforceClient('https://example.my.salesforce.com', 'token');

    await client.updateRecord('Case/Sub', 'abc/123', { Subject: 'Updated' });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/sobjects/Case%2FSub/abc%2F123');
    expect(url).not.toContain('/sobjects/Case/Sub/abc/123');
  });

  it('encodes objectType and id in deleteRecord path', async () => {
    mockJsonOnce({}, 204);
    const client = new SalesforceClient('https://example.my.salesforce.com', 'token');

    await client.deleteRecord('Case/Sub', 'abc/123');

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/sobjects/Case%2FSub/abc%2F123');
    expect(url).not.toContain('/sobjects/Case/Sub/abc/123');
  });

  it('encodes objectType in describeObject path', async () => {
    mockJson({
      name: 'Custom/Object',
      label: 'Custom Object',
      fields: [],
      createable: true,
      updateable: true,
      deleteable: true,
    });
    const client = new SalesforceClient('https://example.my.salesforce.com', 'token');

    await client.describeObject({ objectType: 'Custom/Object' });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/sobjects/Custom%2FObject/describe');
    expect(url).not.toContain('/sobjects/Custom/Object/describe');
  });
});

describe('SalesforceInitializer', () => {
  it('throws if instance_url is missing', async () => {
    await expect(
      SalesforceInitializer.initialize({}, { sdk: 'salesforce', auth: { access_token: 'x' } })
    ).rejects.toThrow('instance_url');
  });

  it('throws if access_token is missing', async () => {
    await expect(
      SalesforceInitializer.initialize({}, { sdk: 'salesforce', auth: { instance_url: 'https://example.com' } })
    ).rejects.toThrow('access_token');
  });
});
