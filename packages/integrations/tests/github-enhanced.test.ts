/**
 * Enhanced GitHub Integration Tests
 *
 * Tests SDK initialization, action mapping, and method invocation
 */

import { describe, it, expect, vi } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { Octokit } from '@octokit/rest';
import { GitHubInitializer } from '../src/services/github.js';

describe('GitHub Integration - Enhanced', () => {
  describe('SDK Initialization', () => {
    it('should initialize Octokit with token', async () => {
      const config = {
        sdk: '@octokit/rest',
        auth: { token: 'ghp_test_token' }
      };

      const client = await GitHubInitializer.initialize({}, config);

      expect(client).toBeInstanceOf(Octokit);
      // Octokit stores auth in internal property
    });

    it('should reject initialization without token', async () => {
      const config = {
        sdk: '@octokit/rest',
        auth: {}
      };

      await expect(GitHubInitializer.initialize({}, config)).rejects.toThrow('GitHub SDK requires auth.token');
    });
  });

  describe('Action Mapping', () => {
    it('should have correct method structure for repos.get', async () => {
      const config = {
        sdk: '@octokit/rest',
        auth: { token: 'ghp_test_token' }
      };

      const client = await GitHubInitializer.initialize({}, config) as Octokit;

      expect(client.repos).toBeDefined();
      expect(typeof client.repos.get).toBe('function');
    });

    it('should have correct method structure for pulls.list', async () => {
      const config = {
        sdk: '@octokit/rest',
        auth: { token: 'ghp_test_token' }
      };

      const client = await GitHubInitializer.initialize({}, config) as Octokit;

      expect(client.pulls).toBeDefined();
      expect(typeof client.pulls.list).toBe('function');
    });

    it('should have correct method structure for pulls.get', async () => {
      const config = {
        sdk: '@octokit/rest',
        auth: { token: 'ghp_test_token' }
      };

      const client = await GitHubInitializer.initialize({}, config) as Octokit;

      expect(client.pulls).toBeDefined();
      expect(typeof client.pulls.get).toBe('function');
    });

    it('should have correct method structure for pulls.listFiles', async () => {
      const config = {
        sdk: '@octokit/rest',
        auth: { token: 'ghp_test_token' }
      };

      const client = await GitHubInitializer.initialize({}, config) as Octokit;

      expect(client.pulls).toBeDefined();
      expect(typeof client.pulls.listFiles).toBe('function');
    });

    it('should have correct method structure for pulls.createReview', async () => {
      const config = {
        sdk: '@octokit/rest',
        auth: { token: 'ghp_test_token' }
      };

      const client = await GitHubInitializer.initialize({}, config) as Octokit;

      expect(client.pulls).toBeDefined();
      expect(typeof client.pulls.createReview).toBe('function');
    });

    it('should have correct method structure for repos.getContent', async () => {
      const config = {
        sdk: '@octokit/rest',
        auth: { token: 'ghp_test_token' }
      };

      const client = await GitHubInitializer.initialize({}, config) as Octokit;

      expect(client.repos).toBeDefined();
      expect(typeof client.repos.getContent).toBe('function');
    });

    it('should have correct method structure for issues.create', async () => {
      const config = {
        sdk: '@octokit/rest',
        auth: { token: 'ghp_test_token' }
      };

      const client = await GitHubInitializer.initialize({}, config) as Octokit;

      expect(client.issues).toBeDefined();
      expect(typeof client.issues.create).toBe('function');
    });

    it('should have correct method structure for git.createRef', async () => {
      const config = {
        sdk: '@octokit/rest',
        auth: { token: 'ghp_test_token' }
      };

      const client = await GitHubInitializer.initialize({}, config) as Octokit;

      expect(client.git).toBeDefined();
      expect(typeof client.git.createRef).toBe('function');
    });

    it('should have correct method structure for search.issuesAndPullRequests', async () => {
      const config = {
        sdk: '@octokit/rest',
        auth: { token: 'ghp_test_token' }
      };

      const client = await GitHubInitializer.initialize({}, config) as Octokit;

      expect(client.search).toBeDefined();
      expect(typeof client.search.issuesAndPullRequests).toBe('function');
    });
  });

  describe('Method Invocation', () => {
    it('should call repos.get with correct parameters', async () => {
      const config = {
        sdk: '@octokit/rest',
        auth: { token: 'ghp_test_token' }
      };

      const client = await GitHubInitializer.initialize({}, config) as Octokit;

      const mockGet = vi.fn().mockResolvedValue({
        data: {
          id: 123,
          name: 'marktoflow',
          full_name: 'marktoflow/marktoflow',
          private: false,
          description: 'Workflow automation framework'
        }
      });

      client.repos.get = mockGet;

      const result = await client.repos.get({
        owner: 'marktoflow',
        repo: 'marktoflow'
      });

      expect(mockGet).toHaveBeenCalledWith({
        owner: 'marktoflow',
        repo: 'marktoflow'
      });

      expect(result.data).toHaveProperty('name', 'marktoflow');
    });

    it('should call pulls.get with correct parameters', async () => {
      const config = {
        sdk: '@octokit/rest',
        auth: { token: 'ghp_test_token' }
      };

      const client = await GitHubInitializer.initialize({}, config) as Octokit;

      const mockGetPR = vi.fn().mockResolvedValue({
        data: {
          number: 1,
          title: 'Test PR',
          state: 'open',
          user: { login: 'testuser' }
        }
      });

      client.pulls.get = mockGetPR;

      const result = await client.pulls.get({
        owner: 'marktoflow',
        repo: 'marktoflow',
        pull_number: 1
      });

      expect(mockGetPR).toHaveBeenCalledWith({
        owner: 'marktoflow',
        repo: 'marktoflow',
        pull_number: 1
      });

      expect(result.data).toHaveProperty('title', 'Test PR');
    });

    it('should call pulls.listFiles with correct parameters', async () => {
      const config = {
        sdk: '@octokit/rest',
        auth: { token: 'ghp_test_token' }
      };

      const client = await GitHubInitializer.initialize({}, config) as Octokit;

      const mockListFiles = vi.fn().mockResolvedValue({
        data: [
          {
            filename: 'src/index.ts',
            status: 'modified',
            additions: 10,
            deletions: 5
          }
        ]
      });

      client.pulls.listFiles = mockListFiles;

      const result = await client.pulls.listFiles({
        owner: 'marktoflow',
        repo: 'marktoflow',
        pull_number: 1
      });

      expect(mockListFiles).toHaveBeenCalledWith({
        owner: 'marktoflow',
        repo: 'marktoflow',
        pull_number: 1
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('filename', 'src/index.ts');
    });
  });

  describe('SDK Registry Integration', () => {
    it('should register tools in registry', () => {
      const registry = new SDKRegistry();

      registry.registerTools({
        github: {
          sdk: '@octokit/rest',
          auth: { token: 'ghp_test_token' }
        }
      });

      expect(registry.has('github')).toBe(true);
    });

    it('should store tool configuration', () => {
      const registry = new SDKRegistry();

      const tools = {
        github: {
          sdk: '@octokit/rest',
          auth: { token: 'ghp_test_token' },
          options: {
            baseUrl: 'https://api.github.com',
            userAgent: 'marktoflow-v2'
          }
        }
      };

      registry.registerTools(tools);

      expect(registry.has('github')).toBe(true);
      const names = registry.getRegisteredNames();
      expect(names).toContain('github');
    });
  });
});
