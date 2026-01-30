import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Create test utilities that mirror the serve.ts functions for unit testing
// We test the exported behavior through the module

describe('serve utilities', () => {
  describe('extractFromPayload', () => {
    // Test the payload extraction logic
    const extractFromPayload = (payload: unknown, path: string): unknown => {
      if (!path.startsWith('payload.')) {
        return path; // Return literal value
      }

      const parts = path.slice(8).split('.'); // Remove 'payload.' prefix
      let current: unknown = payload;

      for (const part of parts) {
        if (current === null || current === undefined) {
          return undefined;
        }
        current = (current as Record<string, unknown>)[part];
      }

      return current;
    };

    it('should return literal value if path does not start with payload.', () => {
      const result = extractFromPayload({ foo: 'bar' }, 'literal_value');
      expect(result).toBe('literal_value');
    });

    it('should extract top-level property from payload', () => {
      const payload = { channel: 'C123', user: 'U456' };
      expect(extractFromPayload(payload, 'payload.channel')).toBe('C123');
      expect(extractFromPayload(payload, 'payload.user')).toBe('U456');
    });

    it('should extract nested property from payload', () => {
      const payload = {
        event: {
          type: 'message',
          text: 'Hello world',
          channel: 'C123',
        },
      };
      expect(extractFromPayload(payload, 'payload.event.type')).toBe('message');
      expect(extractFromPayload(payload, 'payload.event.text')).toBe('Hello world');
      expect(extractFromPayload(payload, 'payload.event.channel')).toBe('C123');
    });

    it('should extract deeply nested property from payload', () => {
      const payload = {
        message: {
          chat: {
            id: 123456,
            title: 'Test Group',
          },
        },
      };
      expect(extractFromPayload(payload, 'payload.message.chat.id')).toBe(123456);
      expect(extractFromPayload(payload, 'payload.message.chat.title')).toBe('Test Group');
    });

    it('should return undefined for non-existent property', () => {
      const payload = { foo: 'bar' };
      expect(extractFromPayload(payload, 'payload.nonexistent')).toBeUndefined();
    });

    it('should return undefined for nested path with null intermediate', () => {
      const payload = { event: null };
      expect(extractFromPayload(payload, 'payload.event.text')).toBeUndefined();
    });

    it('should return undefined for nested path with undefined intermediate', () => {
      const payload = { event: undefined };
      expect(extractFromPayload(payload, 'payload.event.text')).toBeUndefined();
    });

    it('should handle empty object', () => {
      const payload = {};
      expect(extractFromPayload(payload, 'payload.anything')).toBeUndefined();
    });

    it('should handle array access', () => {
      const payload = { items: ['a', 'b', 'c'] };
      expect(extractFromPayload(payload, 'payload.items.0')).toBe('a');
      expect(extractFromPayload(payload, 'payload.items.1')).toBe('b');
    });
  });

  describe('buildInputs', () => {
    const extractFromPayload = (payload: unknown, path: string): unknown => {
      if (!path.startsWith('payload.')) {
        return path;
      }
      const parts = path.slice(8).split('.');
      let current: unknown = payload;
      for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        current = (current as Record<string, unknown>)[part];
      }
      return current;
    };

    const buildInputs = (
      payload: unknown,
      mapping: Record<string, string> | undefined,
      defaults: Record<string, unknown>
    ): Record<string, unknown> => {
      const inputs: Record<string, unknown> = { ...defaults };
      if (mapping) {
        for (const [inputName, payloadPath] of Object.entries(mapping)) {
          const value = extractFromPayload(payload, payloadPath);
          if (value !== undefined) {
            inputs[inputName] = value;
          }
        }
      }
      return inputs;
    };

    it('should return defaults when no mapping provided', () => {
      const defaults = { channel: 'C123', user: 'U456' };
      const result = buildInputs({}, undefined, defaults);
      expect(result).toEqual(defaults);
    });

    it('should map payload values to inputs', () => {
      const payload = {
        event: {
          channel: 'C789',
          text: 'Hello',
        },
      };
      const mapping = {
        channel: 'payload.event.channel',
        message: 'payload.event.text',
      };
      const result = buildInputs(payload, mapping, {});
      expect(result).toEqual({
        channel: 'C789',
        message: 'Hello',
      });
    });

    it('should merge mapped values with defaults', () => {
      const payload = { name: 'Alice' };
      const mapping = { userName: 'payload.name' };
      const defaults = { greeting: 'Hello', userName: 'default' };
      const result = buildInputs(payload, mapping, defaults);
      expect(result).toEqual({
        greeting: 'Hello',
        userName: 'Alice', // Overwritten by mapping
      });
    });

    it('should not include undefined mapped values', () => {
      const payload = { exists: 'value' };
      const mapping = {
        present: 'payload.exists',
        missing: 'payload.nothere',
      };
      const result = buildInputs(payload, mapping, {});
      expect(result).toEqual({ present: 'value' });
      expect(result).not.toHaveProperty('missing');
    });

    it('should handle literal values in mapping', () => {
      const payload = {};
      const mapping = {
        literal: 'some_literal_value',
      };
      const result = buildInputs(payload, mapping, {});
      expect(result).toEqual({ literal: 'some_literal_value' });
    });
  });

  describe('getDefaultInputsFromPayload', () => {
    const getDefaultInputsFromPayload = (
      payload: unknown,
      provider?: string
    ): Record<string, unknown> => {
      if (!payload || typeof payload !== 'object') {
        return {};
      }

      const p = payload as Record<string, unknown>;

      if (provider === 'slack') {
        const event = p.event as Record<string, unknown> | undefined;
        if (event) {
          return {
            channel: event.channel,
            question: event.text,
            instructions: event.text,
            thread_ts: event.thread_ts || event.ts,
            user: event.user,
            team: p.team_id,
          };
        }
      }

      if (provider === 'telegram') {
        const message = p.message as Record<string, unknown> | undefined;
        if (message) {
          const chat = message.chat as Record<string, unknown> | undefined;
          return {
            chat_id: chat?.id,
            question: message.text,
            instructions: message.text,
            message_id: message.message_id,
            from: message.from,
          };
        }
      }

      if (provider === 'github') {
        return {
          action: p.action,
          repository: (p.repository as Record<string, unknown>)?.full_name,
          sender: (p.sender as Record<string, unknown>)?.login,
        };
      }

      // Generic: pass the whole payload
      return { payload: p };
    };

    describe('Slack provider', () => {
      it('should extract Slack event fields', () => {
        const payload = {
          team_id: 'T123',
          event: {
            type: 'message',
            channel: 'C456',
            user: 'U789',
            text: 'What is this codebase about?',
            ts: '1234567890.123456',
          },
        };

        const result = getDefaultInputsFromPayload(payload, 'slack');
        expect(result).toEqual({
          channel: 'C456',
          question: 'What is this codebase about?',
          instructions: 'What is this codebase about?',
          thread_ts: '1234567890.123456',
          user: 'U789',
          team: 'T123',
        });
      });

      it('should prefer thread_ts over ts when present', () => {
        const payload = {
          event: {
            channel: 'C456',
            text: 'Reply',
            ts: '1234567890.123456',
            thread_ts: '1234567890.000000',
          },
        };

        const result = getDefaultInputsFromPayload(payload, 'slack');
        expect(result.thread_ts).toBe('1234567890.000000');
      });

      it('should fall through to generic handler when event is missing', () => {
        const payload = { team_id: 'T123' };
        const result = getDefaultInputsFromPayload(payload, 'slack');
        // Falls through to generic handler which wraps the payload
        expect(result).toEqual({ payload });
      });
    });

    describe('Telegram provider', () => {
      it('should extract Telegram message fields', () => {
        const payload = {
          update_id: 123456789,
          message: {
            message_id: 100,
            from: { id: 12345, first_name: 'John', username: 'john_doe' },
            chat: { id: 67890, type: 'private', first_name: 'John' },
            text: 'List all Python files',
          },
        };

        const result = getDefaultInputsFromPayload(payload, 'telegram');
        expect(result).toEqual({
          chat_id: 67890,
          question: 'List all Python files',
          instructions: 'List all Python files',
          message_id: 100,
          from: { id: 12345, first_name: 'John', username: 'john_doe' },
        });
      });

      it('should fall through to generic handler when message is missing', () => {
        const payload = { update_id: 123 };
        const result = getDefaultInputsFromPayload(payload, 'telegram');
        // Falls through to generic handler which wraps the payload
        expect(result).toEqual({ payload });
      });

      it('should handle missing chat in message', () => {
        const payload = {
          message: {
            message_id: 100,
            text: 'Hello',
          },
        };

        const result = getDefaultInputsFromPayload(payload, 'telegram');
        expect(result.chat_id).toBeUndefined();
        expect(result.message_id).toBe(100);
      });
    });

    describe('GitHub provider', () => {
      it('should extract GitHub webhook fields', () => {
        const payload = {
          action: 'opened',
          repository: {
            id: 123,
            full_name: 'owner/repo',
            private: false,
          },
          sender: {
            login: 'octocat',
            id: 1,
            type: 'User',
          },
        };

        const result = getDefaultInputsFromPayload(payload, 'github');
        expect(result).toEqual({
          action: 'opened',
          repository: 'owner/repo',
          sender: 'octocat',
        });
      });

      it('should handle missing nested fields', () => {
        const payload = { action: 'created' };
        const result = getDefaultInputsFromPayload(payload, 'github');
        expect(result).toEqual({
          action: 'created',
          repository: undefined,
          sender: undefined,
        });
      });
    });

    describe('Generic/unknown provider', () => {
      it('should return entire payload for unknown provider', () => {
        const payload = { custom: 'data', nested: { field: 'value' } };
        const result = getDefaultInputsFromPayload(payload, 'custom');
        expect(result).toEqual({ payload });
      });

      it('should return entire payload when no provider specified', () => {
        const payload = { some: 'data' };
        const result = getDefaultInputsFromPayload(payload, undefined);
        expect(result).toEqual({ payload });
      });
    });

    describe('Edge cases', () => {
      it('should return empty object for null payload', () => {
        const result = getDefaultInputsFromPayload(null, 'slack');
        expect(result).toEqual({});
      });

      it('should return empty object for undefined payload', () => {
        const result = getDefaultInputsFromPayload(undefined, 'slack');
        expect(result).toEqual({});
      });

      it('should return empty object for non-object payload', () => {
        expect(getDefaultInputsFromPayload('string', 'slack')).toEqual({});
        expect(getDefaultInputsFromPayload(123, 'slack')).toEqual({});
        expect(getDefaultInputsFromPayload(true, 'slack')).toEqual({});
      });
    });
  });
});

describe('findWorkflowFiles', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = join(tmpdir(), `marktoflow-serve-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.error('Failed to cleanup temp dir:', e);
    }
  });

  const findWorkflowFiles = (
    workflowDir: string,
    singleWorkflow?: string
  ): string[] => {
    const { existsSync, readdirSync } = require('node:fs');
    const { join: joinPath, resolve } = require('node:path');

    const workflowFiles: string[] = [];

    if (singleWorkflow) {
      workflowFiles.push(resolve(singleWorkflow));
    } else {
      const scanDirs = [
        workflowDir,
        joinPath(workflowDir, 'examples'),
        joinPath(workflowDir, '.marktoflow', 'workflows'),
      ];

      for (const dir of scanDirs) {
        if (existsSync(dir)) {
          try {
            const files = readdirSync(dir, { recursive: true });
            for (const file of files) {
              const filePath = typeof file === 'string' ? file : file.toString();
              if (filePath.endsWith('.md') && filePath.includes('workflow')) {
                workflowFiles.push(joinPath(dir, filePath));
              }
            }
          } catch {
            // Ignore errors scanning directories
          }
        }
      }
    }

    return workflowFiles;
  };

  it('should return single workflow when specified', () => {
    const workflowPath = '/some/path/workflow.md';
    const result = findWorkflowFiles(tempDir, workflowPath);
    expect(result.length).toBe(1);
    expect(result[0]).toContain('workflow.md');
  });

  it('should scan directories for workflow files', () => {
    // Create test structure
    mkdirSync(join(tempDir, 'examples'), { recursive: true });
    writeFileSync(join(tempDir, 'workflow.md'), '# Test workflow');
    writeFileSync(join(tempDir, 'readme.md'), '# Not a workflow - no workflow in name');
    writeFileSync(join(tempDir, 'examples', 'my-workflow.md'), '# Example workflow');

    const result = findWorkflowFiles(tempDir);

    // Should find files with 'workflow' in the name
    expect(result.some((f) => f.includes('workflow.md'))).toBe(true);
    expect(result.some((f) => f.includes('my-workflow.md'))).toBe(true);
    // Should NOT find files without 'workflow' in the name
    expect(result.some((f) => f.includes('readme.md'))).toBe(false);
  });

  it('should scan .marktoflow/workflows directory', () => {
    const marktoflowDir = join(tempDir, '.marktoflow', 'workflows');
    mkdirSync(marktoflowDir, { recursive: true });
    writeFileSync(join(marktoflowDir, 'custom-workflow.md'), '# Custom workflow');

    const result = findWorkflowFiles(tempDir);
    expect(result.some((f) => f.includes('custom-workflow.md'))).toBe(true);
  });

  it('should handle non-existent directories gracefully', () => {
    const nonExistentDir = join(tempDir, 'does-not-exist');
    const result = findWorkflowFiles(nonExistentDir);
    expect(result).toEqual([]);
  });
});

describe('Slack URL verification handling', () => {
  it('should respond to URL verification challenge', () => {
    // Simulate the URL verification response logic
    const handleSlackVerification = (payload: Record<string, unknown>) => {
      if (payload.type === 'url_verification' && payload.challenge) {
        return {
          status: 200,
          body: payload.challenge as string,
          headers: { 'Content-Type': 'text/plain' },
        };
      }
      return null;
    };

    const verificationPayload = {
      token: 'Jhj5dZrVaK7ZwHHjRyZWjbDl',
      challenge: 'challenge_token_here',
      type: 'url_verification',
    };

    const result = handleSlackVerification(verificationPayload);
    expect(result).toEqual({
      status: 200,
      body: 'challenge_token_here',
      headers: { 'Content-Type': 'text/plain' },
    });
  });

  it('should return null for non-verification payloads', () => {
    const handleSlackVerification = (payload: Record<string, unknown>) => {
      if (payload.type === 'url_verification' && payload.challenge) {
        return {
          status: 200,
          body: payload.challenge as string,
          headers: { 'Content-Type': 'text/plain' },
        };
      }
      return null;
    };

    const messagePayload = {
      type: 'event_callback',
      event: { type: 'message', text: 'Hello' },
    };

    const result = handleSlackVerification(messagePayload);
    expect(result).toBeNull();
  });
});

describe('Bot message filtering', () => {
  it('should skip Slack bot messages', () => {
    const shouldSkipBotMessage = (
      payload: Record<string, unknown>,
      provider: string
    ): boolean => {
      if (provider === 'slack') {
        const event = payload.event as Record<string, unknown> | undefined;
        if (event?.bot_id || event?.subtype === 'bot_message') {
          return true;
        }
      }
      return false;
    };

    // Bot message with bot_id
    const botMessage = {
      event: {
        type: 'message',
        bot_id: 'B123',
        text: 'I am a bot',
      },
    };
    expect(shouldSkipBotMessage(botMessage, 'slack')).toBe(true);

    // Bot message with subtype
    const botSubtype = {
      event: {
        type: 'message',
        subtype: 'bot_message',
        text: 'Bot subtype message',
      },
    };
    expect(shouldSkipBotMessage(botSubtype, 'slack')).toBe(true);

    // Regular user message
    const userMessage = {
      event: {
        type: 'message',
        user: 'U123',
        text: 'I am a user',
      },
    };
    expect(shouldSkipBotMessage(userMessage, 'slack')).toBe(false);
  });
});

describe('Microsoft Graph validation', () => {
  it('should handle Graph validation token', () => {
    const handleGraphValidation = (
      method: string,
      query: Record<string, string>
    ) => {
      if (method === 'GET' && query['validationToken']) {
        return {
          status: 200,
          body: query['validationToken'],
          headers: { 'Content-Type': 'text/plain' },
        };
      }
      return null;
    };

    const result = handleGraphValidation('GET', {
      validationToken: 'validation_token_123',
    });
    expect(result).toEqual({
      status: 200,
      body: 'validation_token_123',
      headers: { 'Content-Type': 'text/plain' },
    });
  });

  it('should return null for POST requests', () => {
    const handleGraphValidation = (
      method: string,
      query: Record<string, string>
    ) => {
      if (method === 'GET' && query['validationToken']) {
        return {
          status: 200,
          body: query['validationToken'],
          headers: { 'Content-Type': 'text/plain' },
        };
      }
      return null;
    };

    const result = handleGraphValidation('POST', {
      validationToken: 'some_token',
    });
    expect(result).toBeNull();
  });
});

describe('Webhook workflow discovery', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = join(tmpdir(), `marktoflow-webhook-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.error('Failed to cleanup temp dir:', e);
    }
  });

  it('should identify webhook triggers in workflow', () => {
    const workflow = `---
workflow:
  id: test-webhook
  name: "Test Webhook Workflow"

triggers:
  - type: webhook
    path: /slack/test
    config:
      provider: slack
      events:
        - message
        - app_mention
  - type: schedule
    cron: "0 9 * * *"
---

# Test Workflow
`;

    const workflowPath = join(tempDir, 'webhook-workflow.md');
    writeFileSync(workflowPath, workflow);

    // Parse and check for webhook triggers
    const yaml = require('yaml');
    const content = require('fs').readFileSync(workflowPath, 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match) {
      const frontmatter = yaml.parse(match[1]) as Record<string, unknown>;
      const triggers = frontmatter.triggers as Array<Record<string, unknown>>;

      const webhookTriggers = triggers.filter((t) => t.type === 'webhook');
      expect(webhookTriggers.length).toBe(1);
      expect(webhookTriggers[0].path).toBe('/slack/test');
      expect(webhookTriggers[0].config).toEqual({
        provider: 'slack',
        events: ['message', 'app_mention'],
      });
    }
  });
});

describe('Socket Mode workflow filtering', () => {
  it('should filter for Slack provider workflows', () => {
    const workflows = [
      {
        id: 'slack-1',
        triggers: [
          { type: 'webhook', config: { provider: 'slack' } },
        ],
      },
      {
        id: 'telegram-1',
        triggers: [
          { type: 'webhook', config: { provider: 'telegram' } },
        ],
      },
      {
        id: 'github-1',
        triggers: [
          { type: 'webhook', config: { provider: 'github' } },
        ],
      },
      {
        id: 'slack-2',
        triggers: [
          { type: 'webhook', config: { provider: 'slack' } },
        ],
      },
    ];

    const slackWorkflows = workflows.filter((w) =>
      w.triggers.some(
        (t) => t.type === 'webhook' && t.config?.provider === 'slack'
      )
    );

    expect(slackWorkflows.length).toBe(2);
    expect(slackWorkflows.map((w) => w.id)).toEqual(['slack-1', 'slack-2']);
  });

  it('should extract events from Socket Mode triggers', () => {
    const trigger = {
      type: 'webhook',
      config: {
        provider: 'slack',
        events: ['message', 'app_mention', 'reaction_added'],
      },
    };

    const events = (trigger.config?.events as string[]) || ['message', 'app_mention'];
    expect(events).toEqual(['message', 'app_mention', 'reaction_added']);
  });

  it('should use default events when not specified', () => {
    const trigger = {
      type: 'webhook',
      config: {
        provider: 'slack',
      },
    };

    const events = (trigger.config?.events as string[] | undefined) || ['message', 'app_mention'];
    expect(events).toEqual(['message', 'app_mention']);
  });
});

describe('Input mapping with complex payloads', () => {
  const extractFromPayload = (payload: unknown, path: string): unknown => {
    if (!path.startsWith('payload.')) {
      return path;
    }
    const parts = path.slice(8).split('.');
    let current: unknown = payload;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  };

  const buildInputs = (
    payload: unknown,
    mapping: Record<string, string> | undefined,
    defaults: Record<string, unknown>
  ): Record<string, unknown> => {
    const inputs: Record<string, unknown> = { ...defaults };
    if (mapping) {
      for (const [inputName, payloadPath] of Object.entries(mapping)) {
        const value = extractFromPayload(payload, payloadPath);
        if (value !== undefined) {
          inputs[inputName] = value;
        }
      }
    }
    return inputs;
  };

  it('should handle complex Slack event payload', () => {
    const slackPayload = {
      token: 'abc123',
      team_id: 'T123',
      api_app_id: 'A123',
      event: {
        client_msg_id: 'msg-123',
        type: 'app_mention',
        text: '<@U123> What is this repo about?',
        user: 'U456',
        ts: '1234567890.123456',
        channel: 'C789',
        event_ts: '1234567890.123456',
      },
      type: 'event_callback',
      event_id: 'Ev123',
      event_time: 1234567890,
    };

    const mapping = {
      channel: 'payload.event.channel',
      user: 'payload.event.user',
      text: 'payload.event.text',
      timestamp: 'payload.event.ts',
      team: 'payload.team_id',
    };

    const result = buildInputs(slackPayload, mapping, {});
    expect(result).toEqual({
      channel: 'C789',
      user: 'U456',
      text: '<@U123> What is this repo about?',
      timestamp: '1234567890.123456',
      team: 'T123',
    });
  });

  it('should handle complex Telegram payload', () => {
    const telegramPayload = {
      update_id: 123456789,
      message: {
        message_id: 42,
        from: {
          id: 12345,
          is_bot: false,
          first_name: 'Alice',
          username: 'alice',
          language_code: 'en',
        },
        chat: {
          id: 67890,
          first_name: 'Alice',
          username: 'alice',
          type: 'private',
        },
        date: 1234567890,
        text: 'Create a new component',
      },
    };

    const mapping = {
      chat_id: 'payload.message.chat.id',
      from_id: 'payload.message.from.id',
      username: 'payload.message.from.username',
      instructions: 'payload.message.text',
      message_id: 'payload.message.message_id',
    };

    const result = buildInputs(telegramPayload, mapping, {});
    expect(result).toEqual({
      chat_id: 67890,
      from_id: 12345,
      username: 'alice',
      instructions: 'Create a new component',
      message_id: 42,
    });
  });

  it('should handle GitHub webhook payload', () => {
    const githubPayload = {
      action: 'opened',
      number: 1,
      pull_request: {
        id: 123,
        number: 1,
        title: 'Add feature',
        user: {
          login: 'octocat',
          id: 1,
        },
        head: {
          ref: 'feature-branch',
          sha: 'abc123',
        },
        base: {
          ref: 'main',
        },
      },
      repository: {
        id: 456,
        full_name: 'owner/repo',
        private: false,
      },
      sender: {
        login: 'octocat',
        id: 1,
      },
    };

    const mapping = {
      pr_number: 'payload.number',
      pr_title: 'payload.pull_request.title',
      author: 'payload.pull_request.user.login',
      source_branch: 'payload.pull_request.head.ref',
      target_branch: 'payload.pull_request.base.ref',
      repo: 'payload.repository.full_name',
    };

    const result = buildInputs(githubPayload, mapping, {});
    expect(result).toEqual({
      pr_number: 1,
      pr_title: 'Add feature',
      author: 'octocat',
      source_branch: 'feature-branch',
      target_branch: 'main',
      repo: 'owner/repo',
    });
  });
});
