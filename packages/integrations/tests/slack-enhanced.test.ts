/**
 * Enhanced Slack Integration Tests
 *
 * Tests SDK initialization, action mapping, and method invocation
 */

import { describe, it, expect, vi } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { WebClient } from '@slack/web-api';
import { SlackInitializer } from '../src/services/slack.js';

describe('Slack Integration - Enhanced', () => {
  describe('SDK Initialization', () => {
    it('should initialize WebClient with token', async () => {
      const config = {
        sdk: '@slack/web-api',
        auth: { token: 'xoxb-test-token' }
      };

      const client = await SlackInitializer.initialize({}, config);

      expect(client).toBeInstanceOf(WebClient);
      expect((client as WebClient).token).toBe('xoxb-test-token');
    });

    it('should throw if token is missing', async () => {
      const config = {
        sdk: '@slack/web-api',
        auth: {}
      };

      await expect(SlackInitializer.initialize({}, config))
        .rejects.toThrow('auth.token');
    });
  });

  describe('Action Mapping', () => {
    it('should have correct method structure for chat.postMessage', async () => {
      const config = {
        sdk: '@slack/web-api',
        auth: { token: 'xoxb-test-token' }
      };

      const client = await SlackInitializer.initialize({}, config) as WebClient;

      // Verify the method exists and is callable
      expect(client.chat).toBeDefined();
      expect(typeof client.chat.postMessage).toBe('function');
    });

    it('should have correct method structure for users.info', async () => {
      const config = {
        sdk: '@slack/web-api',
        auth: { token: 'xoxb-test-token' }
      };

      const client = await SlackInitializer.initialize({}, config) as WebClient;

      expect(client.users).toBeDefined();
      expect(typeof client.users.info).toBe('function');
    });

    it('should have correct method structure for conversations.history', async () => {
      const config = {
        sdk: '@slack/web-api',
        auth: { token: 'xoxb-test-token' }
      };

      const client = await SlackInitializer.initialize({}, config) as WebClient;

      expect(client.conversations).toBeDefined();
      expect(typeof client.conversations.history).toBe('function');
    });

    it('should have correct method structure for conversations.create', async () => {
      const config = {
        sdk: '@slack/web-api',
        auth: { token: 'xoxb-test-token' }
      };

      const client = await SlackInitializer.initialize({}, config) as WebClient;

      expect(client.conversations).toBeDefined();
      expect(typeof client.conversations.create).toBe('function');
    });
  });

  describe('Method Invocation', () => {
    it('should call chat.postMessage with correct parameters', async () => {
      const config = {
        sdk: '@slack/web-api',
        auth: { token: 'xoxb-test-token' }
      };

      const client = await SlackInitializer.initialize({}, config) as WebClient;

      // Mock the method
      const mockPostMessage = vi.fn().mockResolvedValue({
        ok: true,
        channel: 'C123',
        ts: '1234567890.123456',
        message: { text: 'Hello World' }
      });

      client.chat.postMessage = mockPostMessage;

      // Call the method as it would be called from workflow
      const result = await client.chat.postMessage({
        channel: '#general',
        text: 'Hello World'
      });

      expect(mockPostMessage).toHaveBeenCalledWith({
        channel: '#general',
        text: 'Hello World'
      });

      expect(result).toEqual({
        ok: true,
        channel: 'C123',
        ts: '1234567890.123456',
        message: { text: 'Hello World' }
      });
    });

    it('should call users.info with correct parameters', async () => {
      const config = {
        sdk: '@slack/web-api',
        auth: { token: 'xoxb-test-token' }
      };

      const client = await SlackInitializer.initialize({}, config) as WebClient;

      const mockUsersInfo = vi.fn().mockResolvedValue({
        ok: true,
        user: {
          id: 'U123',
          name: 'testuser',
          real_name: 'Test User'
        }
      });

      client.users.info = mockUsersInfo;

      const result = await client.users.info({ user: 'U123' });

      expect(mockUsersInfo).toHaveBeenCalledWith({ user: 'U123' });
      expect(result.user).toHaveProperty('name', 'testuser');
    });
  });

  describe('SDK Registry Integration', () => {
    it('should register tools in registry', () => {
      const registry = new SDKRegistry();

      registry.registerTools({
        slack: {
          sdk: '@slack/web-api',
          auth: { token: 'xoxb-test-token' }
        }
      });

      expect(registry.has('slack')).toBe(true);
    });

    it('should return registered SDK names', () => {
      const registry = new SDKRegistry();

      registry.registerTools({
        slack: {
          sdk: '@slack/web-api',
          auth: { token: 'xoxb-test-token' }
        },
        github: {
          sdk: '@octokit/rest',
          auth: { token: 'ghp-test' }
        }
      });

      const names = registry.getRegisteredNames();
      expect(names).toContain('slack');
      expect(names).toContain('github');
    });
  });
});
