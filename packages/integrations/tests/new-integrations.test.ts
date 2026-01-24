import { describe, it, expect, vi } from 'vitest';
import {
  LinearInitializer,
  LinearClient,
  NotionInitializer,
  NotionClient,
  DiscordInitializer,
  DiscordClient,
  AirtableInitializer,
  AirtableClient,
  ConfluenceInitializer,
  ConfluenceClient,
  HttpInitializer,
  HttpClient,
  GraphQLClient,
} from '../src/index.js';

describe('Linear Integration', () => {
  it('should throw if api_key missing', async () => {
    const config = { sdk: 'linear', auth: {} };
    await expect(LinearInitializer.initialize({}, config as any)).rejects.toThrow('auth.api_key');
  });

  it('should initialize client with api_key', async () => {
    const config = { sdk: 'linear', auth: { api_key: 'lin_api_test' } };
    const result = await LinearInitializer.initialize({}, config as any);
    expect(result).toBeTruthy();
    expect((result as any).client).toBeInstanceOf(LinearClient);
    expect((result as any).actions).toBeInstanceOf(LinearClient);
  });

  it('should have all required methods', () => {
    const client = new LinearClient('test-key');
    expect(typeof client.getViewer).toBe('function');
    expect(typeof client.listTeams).toBe('function');
    expect(typeof client.getIssue).toBe('function');
    expect(typeof client.createIssue).toBe('function');
    expect(typeof client.updateIssue).toBe('function');
    expect(typeof client.searchIssues).toBe('function');
    expect(typeof client.listProjects).toBe('function');
    expect(typeof client.getWorkflowStates).toBe('function');
    expect(typeof client.addComment).toBe('function');
    expect(typeof client.archiveIssue).toBe('function');
  });
});

describe('Notion Integration', () => {
  it('should throw if token missing', async () => {
    const config = { sdk: 'notion', auth: {} };
    await expect(NotionInitializer.initialize({}, config as any)).rejects.toThrow('auth.token');
  });

  it('should initialize client with token', async () => {
    const config = { sdk: 'notion', auth: { token: 'secret_test' } };
    const result = await NotionInitializer.initialize({}, config as any);
    expect(result).toBeTruthy();
    expect((result as any).client).toBeInstanceOf(NotionClient);
  });

  it('should have all required methods', () => {
    const client = new NotionClient('test-token');
    expect(typeof client.getMe).toBe('function');
    expect(typeof client.search).toBe('function');
    expect(typeof client.getPage).toBe('function');
    expect(typeof client.createPage).toBe('function');
    expect(typeof client.updatePage).toBe('function');
    expect(typeof client.getDatabase).toBe('function');
    expect(typeof client.queryDatabase).toBe('function');
    expect(typeof client.getBlockChildren).toBe('function');
    expect(typeof client.appendBlocks).toBe('function');
    expect(typeof client.deleteBlock).toBe('function');
    expect(typeof client.archivePage).toBe('function');
  });
});

describe('Discord Integration', () => {
  it('should throw if token missing', async () => {
    const config = { sdk: 'discord', auth: {} };
    await expect(DiscordInitializer.initialize({}, config as any)).rejects.toThrow('auth.token');
  });

  it('should initialize client with token', async () => {
    const config = { sdk: 'discord', auth: { token: 'bot-token' } };
    const result = await DiscordInitializer.initialize({}, config as any);
    expect(result).toBeTruthy();
    expect((result as any).client).toBeInstanceOf(DiscordClient);
  });

  it('should have all required methods', () => {
    const client = new DiscordClient('test-token');
    expect(typeof client.getMe).toBe('function');
    expect(typeof client.getGuilds).toBe('function');
    expect(typeof client.getGuild).toBe('function');
    expect(typeof client.getGuildChannels).toBe('function');
    expect(typeof client.getChannel).toBe('function');
    expect(typeof client.sendMessage).toBe('function');
    expect(typeof client.editMessage).toBe('function');
    expect(typeof client.deleteMessage).toBe('function');
    expect(typeof client.getMessages).toBe('function');
    expect(typeof client.addReaction).toBe('function');
    expect(typeof client.createThread).toBe('function');
    expect(typeof client.createWebhook).toBe('function');
    expect(typeof client.executeWebhook).toBe('function');
  });
});

describe('Airtable Integration', () => {
  it('should throw if token missing', async () => {
    const config = { sdk: 'airtable', auth: {} };
    await expect(AirtableInitializer.initialize({}, config as any)).rejects.toThrow('auth.token');
  });

  it('should initialize client with token', async () => {
    const config = { sdk: 'airtable', auth: { token: 'pat_test' }, options: { base_id: 'appTest' } };
    const result = await AirtableInitializer.initialize({}, config as any);
    expect(result).toBeTruthy();
    expect((result as any).client).toBeInstanceOf(AirtableClient);
  });

  it('should have all required methods', () => {
    const client = new AirtableClient('test-token', 'appTest');
    expect(typeof client.listBases).toBe('function');
    expect(typeof client.getBaseSchema).toBe('function');
    expect(typeof client.listRecords).toBe('function');
    expect(typeof client.getAllRecords).toBe('function');
    expect(typeof client.getRecord).toBe('function');
    expect(typeof client.createRecord).toBe('function');
    expect(typeof client.createRecords).toBe('function');
    expect(typeof client.updateRecord).toBe('function');
    expect(typeof client.updateRecords).toBe('function');
    expect(typeof client.deleteRecord).toBe('function');
    expect(typeof client.deleteRecords).toBe('function');
    expect(typeof client.findRecords).toBe('function');
    expect(typeof client.findOne).toBe('function');
  });
});

describe('Confluence Integration', () => {
  it('should throw if required auth missing', async () => {
    const config = { sdk: 'confluence', auth: {} };
    await expect(ConfluenceInitializer.initialize({}, config as any)).rejects.toThrow('auth.host');
  });

  it('should initialize client with credentials', async () => {
    const config = {
      sdk: 'confluence',
      auth: {
        host: 'https://test.atlassian.net',
        email: 'test@example.com',
        api_token: 'token123',
      },
    };
    const result = await ConfluenceInitializer.initialize({}, config as any);
    expect(result).toBeTruthy();
    expect((result as any).client).toBeInstanceOf(ConfluenceClient);
  });

  it('should have all required methods', () => {
    const client = new ConfluenceClient('https://test.atlassian.net', 'test@example.com', 'token');
    expect(typeof client.getCurrentUser).toBe('function');
    expect(typeof client.listSpaces).toBe('function');
    expect(typeof client.getSpace).toBe('function');
    expect(typeof client.getSpaceByKey).toBe('function');
    expect(typeof client.listPages).toBe('function');
    expect(typeof client.getPage).toBe('function');
    expect(typeof client.createPage).toBe('function');
    expect(typeof client.updatePage).toBe('function');
    expect(typeof client.deletePage).toBe('function');
    expect(typeof client.getPageContent).toBe('function');
    expect(typeof client.appendToPage).toBe('function');
    expect(typeof client.getPageComments).toBe('function');
    expect(typeof client.addComment).toBe('function');
    expect(typeof client.search).toBe('function');
    expect(typeof client.getChildPages).toBe('function');
  });
});

describe('HTTP Integration', () => {
  it('should initialize without auth', async () => {
    const config = { sdk: 'http', auth: {} };
    const result = await HttpInitializer.initialize({}, config as any);
    expect(result).toBeTruthy();
    expect((result as any).client).toBeInstanceOf(HttpClient);
  });

  it('should initialize with bearer auth', async () => {
    const config = {
      sdk: 'http',
      auth: { type: 'bearer', token: 'test-token' },
      options: { base_url: 'https://api.example.com' },
    };
    const result = await HttpInitializer.initialize({}, config as any);
    expect(result).toBeTruthy();
    expect((result as any).client).toBeInstanceOf(HttpClient);
  });

  it('should initialize with api-key auth', async () => {
    const config = {
      sdk: 'http',
      auth: { type: 'api-key', api_key: 'key123', api_key_header: 'X-Custom-Key' },
    };
    const result = await HttpInitializer.initialize({}, config as any);
    expect(result).toBeTruthy();
  });

  it('should provide graphql factory', async () => {
    const config = { sdk: 'http' };
    const result = await HttpInitializer.initialize({}, config as any);
    expect(typeof (result as any).graphql).toBe('function');
    const gqlClient = (result as any).graphql('https://api.example.com/graphql');
    expect(gqlClient).toBeInstanceOf(GraphQLClient);
  });

  it('should have all required HTTP methods', () => {
    const client = new HttpClient({ baseUrl: 'https://api.example.com' });
    expect(typeof client.request).toBe('function');
    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.patch).toBe('function');
    expect(typeof client.delete).toBe('function');
    expect(typeof client.head).toBe('function');
    expect(typeof client.setHeader).toBe('function');
    expect(typeof client.removeHeader).toBe('function');
    expect(typeof client.setBearerToken).toBe('function');
    expect(typeof client.setBaseUrl).toBe('function');
  });
});
