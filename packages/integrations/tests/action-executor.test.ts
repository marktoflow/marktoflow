/**
 * Action Executor Integration Tests
 *
 * Tests the full path from action string (e.g., "slack.chat.postMessage")
 * to actual SDK method invocation through the step executor.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SDKRegistry, createSDKStepExecutor } from '@marktoflow/core';
import { registerIntegrations } from '../src/index.js';

describe('Action Executor Integration', () => {
  let registry: SDKRegistry;
  let executor: ReturnType<typeof createSDKStepExecutor>;

  beforeEach(() => {
    registry = new SDKRegistry();
    registerIntegrations(registry);
    executor = createSDKStepExecutor();
  });

  describe('Single-Level Actions', () => {
    it('should execute db.query action', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({
          rows: [{ id: 1, name: 'Test' }],
          rowCount: 1
        })
      };

      registry.registerTools({
        db: {
          sdk: 'pg',
          auth: {
            host: 'localhost',
            port: '5432',
            database: 'test',
            user: 'postgres',
            password: 'password'
          }
        }
      });

      vi.spyOn(registry, 'load').mockResolvedValue(mockClient);

      const step = {
        action: 'db.query',
        inputs: {
          text: 'SELECT * FROM users WHERE id = $1',
          values: [1]
        }
      };

      const result = await executor(step, {}, registry);

      expect(mockClient.query).toHaveBeenCalledWith({
        text: 'SELECT * FROM users WHERE id = $1',
        values: [1]
      });

      expect(result).toEqual({
        rows: [{ id: 1, name: 'Test' }],
        rowCount: 1
      });
    });
  });

  describe('Two-Level Nested Actions', () => {
    it('should execute slack.chat.postMessage action', async () => {
      const mockClient = {
        chat: {
          postMessage: vi.fn().mockResolvedValue({
            ok: true,
            channel: 'C123',
            ts: '1234567890.123456'
          })
        }
      };

      registry.registerTools({
        slack: {
          sdk: '@slack/web-api',
          auth: { token: 'xoxb-test' }
        }
      });

      vi.spyOn(registry, 'load').mockResolvedValue(mockClient);

      const step = {
        action: 'slack.chat.postMessage',
        inputs: {
          channel: '#general',
          text: 'Hello World'
        }
      };

      const result = await executor(step, {}, registry);

      expect(mockClient.chat.postMessage).toHaveBeenCalledWith({
        channel: '#general',
        text: 'Hello World'
      });

      expect(result.ok).toBe(true);
    });

    it('should execute github.repos.get action', async () => {
      const mockClient = {
        repos: {
          get: vi.fn().mockResolvedValue({
            data: {
              id: 123,
              name: 'marktoflow',
              full_name: 'marktoflow/marktoflow'
            }
          })
        }
      };

      registry.registerTools({
        github: {
          sdk: '@octokit/rest',
          auth: { token: 'ghp_test' }
        }
      });

      vi.spyOn(registry, 'load').mockResolvedValue(mockClient);

      const step = {
        action: 'github.repos.get',
        inputs: {
          owner: 'marktoflow',
          repo: 'marktoflow'
        }
      };

      const result = await executor(step, {}, registry);

      expect(mockClient.repos.get).toHaveBeenCalledWith({
        owner: 'marktoflow',
        repo: 'marktoflow'
      });

      expect(result.data.name).toBe('marktoflow');
    });

    it('should execute slack.users.info action', async () => {
      const mockClient = {
        users: {
          info: vi.fn().mockResolvedValue({
            ok: true,
            user: {
              id: 'U123',
              name: 'testuser',
              real_name: 'Test User'
            }
          })
        }
      };

      registry.registerTools({
        slack: {
          sdk: '@slack/web-api',
          auth: { token: 'xoxb-test' }
        }
      });

      vi.spyOn(registry, 'load').mockResolvedValue(mockClient);

      const step = {
        action: 'slack.users.info',
        inputs: {
          user: 'U123'
        }
      };

      const result = await executor(step, {}, registry);

      expect(mockClient.users.info).toHaveBeenCalledWith({
        user: 'U123'
      });

      expect(result.user.name).toBe('testuser');
    });

    it('should execute github.pulls.list action', async () => {
      const mockClient = {
        pulls: {
          list: vi.fn().mockResolvedValue({
            data: [
              { number: 1, title: 'PR 1', state: 'open' },
              { number: 2, title: 'PR 2', state: 'closed' }
            ]
          })
        }
      };

      registry.registerTools({
        github: {
          sdk: '@octokit/rest',
          auth: { token: 'ghp_test' }
        }
      });

      vi.spyOn(registry, 'load').mockResolvedValue(mockClient);

      const step = {
        action: 'github.pulls.list',
        inputs: {
          owner: 'marktoflow',
          repo: 'marktoflow',
          state: 'open'
        }
      };

      const result = await executor(step, {}, registry);

      expect(mockClient.pulls.list).toHaveBeenCalledWith({
        owner: 'marktoflow',
        repo: 'marktoflow',
        state: 'open'
      });

      expect(result.data).toHaveLength(2);
    });
  });

  describe('Three-Level Nested Actions', () => {
    it('should execute jira.issueSearch.searchForIssuesUsingJql action', async () => {
      const mockClient = {
        issueSearch: {
          searchForIssuesUsingJql: vi.fn().mockResolvedValue({
            issues: [
              { key: 'ENG-1', fields: { summary: 'Test Issue' } }
            ],
            total: 1
          })
        }
      };

      registry.registerTools({
        jira: {
          sdk: 'jira.js',
          auth: {
            host: 'https://test.atlassian.net',
            email: 'test@test.com',
            api_token: 'token'
          }
        }
      });

      vi.spyOn(registry, 'load').mockResolvedValue(mockClient);

      const step = {
        action: 'jira.issueSearch.searchForIssuesUsingJql',
        inputs: {
          jql: 'project = ENG',
          fields: ['summary', 'status'],
          maxResults: 50
        }
      };

      const result = await executor(step, {}, registry);

      expect(mockClient.issueSearch.searchForIssuesUsingJql).toHaveBeenCalledWith({
        jql: 'project = ENG',
        fields: ['summary', 'status'],
        maxResults: 50
      });

      expect(result.total).toBe(1);
      expect(result.issues[0].key).toBe('ENG-1');
    });

    it('should execute sheets.spreadsheets.values.get action', async () => {
      const mockClient = {
        spreadsheets: {
          values: {
            get: vi.fn().mockResolvedValue({
              values: [
                ['Name', 'Email', 'Status'],
                ['John', 'john@test.com', 'Active']
              ]
            })
          }
        }
      };

      registry.registerTools({
        sheets: {
          sdk: 'googleapis',
          auth: {
            client_id: 'client-id',
            client_secret: 'client-secret',
            refresh_token: 'refresh-token'
          }
        }
      });

      vi.spyOn(registry, 'load').mockResolvedValue(mockClient);

      const step = {
        action: 'sheets.spreadsheets.values.get',
        inputs: {
          spreadsheetId: 'abc123',
          range: 'Sheet1!A1:C10'
        }
      };

      const result = await executor(step, {}, registry);

      expect(mockClient.spreadsheets.values.get).toHaveBeenCalledWith({
        spreadsheetId: 'abc123',
        range: 'Sheet1!A1:C10'
      });

      expect(result.values).toHaveLength(2);
      expect(result.values[0][0]).toBe('Name');
    });

    it('should execute sheets.spreadsheets.values.update action', async () => {
      const mockClient = {
        spreadsheets: {
          values: {
            update: vi.fn().mockResolvedValue({
              updatedRows: 1,
              updatedColumns: 3,
              updatedCells: 3
            })
          }
        }
      };

      registry.registerTools({
        sheets: {
          sdk: 'googleapis',
          auth: {
            client_id: 'client-id',
            client_secret: 'client-secret',
            refresh_token: 'refresh-token'
          }
        }
      });

      vi.spyOn(registry, 'load').mockResolvedValue(mockClient);

      const step = {
        action: 'sheets.spreadsheets.values.update',
        inputs: {
          spreadsheetId: 'abc123',
          range: 'Sheet1!A1:C1',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [['Name', 'Email', 'Status']]
          }
        }
      };

      const result = await executor(step, {}, registry);

      expect(mockClient.spreadsheets.values.update).toHaveBeenCalledWith({
        spreadsheetId: 'abc123',
        range: 'Sheet1!A1:C1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['Name', 'Email', 'Status']]
        }
      });

      expect(result.updatedRows).toBe(1);
    });
  });

  describe('Context Binding', () => {
    it('should maintain correct "this" context for nested methods', async () => {
      let capturedThis: unknown = null;

      const mockClient = {
        chat: {
          postMessage: function (this: unknown, params: unknown) {
            capturedThis = this;
            return Promise.resolve({ ok: true });
          }
        }
      };

      registry.registerTools({
        slack: {
          sdk: '@slack/web-api',
          auth: { token: 'xoxb-test' }
        }
      });

      vi.spyOn(registry, 'load').mockResolvedValue(mockClient);

      const step = {
        action: 'slack.chat.postMessage',
        inputs: { channel: '#test', text: 'test' }
      };

      await executor(step, {}, registry);

      // The "this" context should be the "chat" object, not the root client
      expect(capturedThis).toBe(mockClient.chat);
    });
  });

  describe('Error Handling', () => {
    it('should throw on invalid action format', async () => {
      const step = {
        action: 'invalid',
        inputs: {}
      };

      await expect(executor(step, {}, registry)).rejects.toThrow(
        'Invalid action format'
      );
    });

    it('should throw on unregistered SDK', async () => {
      const step = {
        action: 'unknown.method',
        inputs: {}
      };

      await expect(executor(step, {}, registry)).rejects.toThrow(
        "SDK 'unknown' is not registered"
      );
    });

    it('should throw on non-existent method', async () => {
      const mockClient = {
        existing: vi.fn()
      };

      registry.registerTools({
        test: { sdk: 'test-sdk' }
      });

      vi.spyOn(registry, 'load').mockResolvedValue(mockClient);

      const step = {
        action: 'test.nonexistent.method',
        inputs: {}
      };

      await expect(executor(step, {}, registry)).rejects.toThrow();
    });

    it('should throw when method is not a function', async () => {
      const mockClient = {
        property: 'not a function'
      };

      registry.registerTools({
        test: { sdk: 'test-sdk' }
      });

      vi.spyOn(registry, 'load').mockResolvedValue(mockClient);

      const step = {
        action: 'test.property',
        inputs: {}
      };

      await expect(executor(step, {}, registry)).rejects.toThrow(
        'is not a function'
      );
    });
  });

  describe('Input Handling', () => {
    it('should pass empty inputs object if not provided', async () => {
      const mockClient = {
        method: vi.fn().mockResolvedValue({ success: true })
      };

      registry.registerTools({
        test: { sdk: 'test-sdk' }
      });

      vi.spyOn(registry, 'load').mockResolvedValue(mockClient);

      const step = {
        action: 'test.method',
        inputs: {}
      };

      await executor(step, {}, registry);

      expect(mockClient.method).toHaveBeenCalledWith({});
    });

    it('should preserve complex input types', async () => {
      const mockClient = {
        method: vi.fn().mockResolvedValue({ success: true })
      };

      registry.registerTools({
        test: { sdk: 'test-sdk' }
      });

      vi.spyOn(registry, 'load').mockResolvedValue(mockClient);

      const complexInputs = {
        string: 'text',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: {
          nested: {
            deep: 'value'
          }
        },
        null: null,
        undefined: undefined
      };

      const step = {
        action: 'test.method',
        inputs: complexInputs
      };

      await executor(step, {}, registry);

      expect(mockClient.method).toHaveBeenCalledWith(complexInputs);
    });
  });
});
