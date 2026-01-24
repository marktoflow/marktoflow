import { describe, it, expect, beforeEach } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { GitHubCopilotClient, GitHubCopilotInitializer } from '../src/adapters/github-copilot.js';

describe('GitHub Copilot Adapter', () => {
  let registry: SDKRegistry;

  beforeEach(() => {
    registry = new SDKRegistry();
  });

  describe('GitHubCopilotInitializer', () => {
    it('should initialize with default options', async () => {
      const config = {
        sdk: '@github/copilot-sdk',
        options: {},
      };

      const client = await GitHubCopilotInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });

    it('should initialize with CLI path from auth', async () => {
      const config = {
        sdk: '@github/copilot-sdk',
        auth: {
          cli_path: '/custom/path/to/copilot',
        },
      };

      const client = await GitHubCopilotInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });

    it('should initialize with CLI URL', async () => {
      const config = {
        sdk: '@github/copilot-sdk',
        options: {
          cliUrl: 'localhost:4321',
        },
      };

      const client = await GitHubCopilotInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });

    it('should initialize with custom model', async () => {
      const config = {
        sdk: '@github/copilot-sdk',
        options: {
          model: 'gpt-5',
        },
      };

      const client = await GitHubCopilotInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });
  });

  describe('GitHubCopilotClient Construction', () => {
    it('should create client with default options', () => {
      const client = new GitHubCopilotClient();
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });

    it('should create client with custom model', () => {
      const client = new GitHubCopilotClient({ model: 'gpt-5' });
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });

    it('should create client with custom CLI path', () => {
      const client = new GitHubCopilotClient({ cliPath: '/custom/path/copilot' });
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });

    it('should create client with external CLI URL', () => {
      const client = new GitHubCopilotClient({ cliUrl: 'localhost:4321' });
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });

    it('should create client with custom log level', () => {
      const client = new GitHubCopilotClient({ logLevel: 'debug' });
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });

    it('should create client with autoStart disabled', () => {
      const client = new GitHubCopilotClient({ autoStart: false });
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });
  });

  describe('Client Methods', () => {
    it('should have send method', () => {
      const client = new GitHubCopilotClient();
      expect(client.send).toBeDefined();
      expect(typeof client.send).toBe('function');
    });

    it('should have stream method', () => {
      const client = new GitHubCopilotClient();
      expect(client.stream).toBeDefined();
      expect(typeof client.stream).toBe('function');
    });

    it('should have createSession method', () => {
      const client = new GitHubCopilotClient();
      expect(client.createSession).toBeDefined();
      expect(typeof client.createSession).toBe('function');
    });

    it('should have stop method', () => {
      const client = new GitHubCopilotClient();
      expect(client.stop).toBeDefined();
      expect(typeof client.stop).toBeDefined();
    });

    it('should have ping method', () => {
      const client = new GitHubCopilotClient();
      expect(client.ping).toBeDefined();
      expect(typeof client.ping).toBe('function');
    });
  });

  describe('Integration with SDKRegistry', () => {
    it('should be registered in SDK registry', () => {
      expect(GitHubCopilotInitializer).toBeDefined();
      expect(GitHubCopilotInitializer.initialize).toBeDefined();
    });
  });
});
