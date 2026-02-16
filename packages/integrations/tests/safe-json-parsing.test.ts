import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseApiClient } from '../src/services/base-client';
import { HttpClient } from '../src/services/http';

describe('Safe JSON Parsing', () => {
  // Mock fetch globally
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('BaseApiClient', () => {
    it('should handle malformed JSON gracefully', async () => {
      // Mock fetch to return malformed JSON
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => '{"invalid json',
      });

      const client = new BaseApiClient({
        baseUrl: 'https://api.example.com',
        serviceName: 'TestService',
      });

      await expect(client['get']('/test')).rejects.toThrow(/returned invalid JSON/);
      await expect(client['get']('/test')).rejects.toThrow(/Response preview:/);
    });

    it('should handle empty response body', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => '',
      });

      const client = new BaseApiClient({
        baseUrl: 'https://api.example.com',
        serviceName: 'TestService',
      });

      const result = await client['get']('/test');
      expect(result).toBeUndefined();
    });

    it('should handle whitespace-only response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => '   \n  ',
      });

      const client = new BaseApiClient({
        baseUrl: 'https://api.example.com',
        serviceName: 'TestService',
      });

      const result = await client['get']('/test');
      expect(result).toBeUndefined();
    });

    it('should parse valid JSON successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => '{"message":"success","data":{"id":123}}',
      });

      const client = new BaseApiClient({
        baseUrl: 'https://api.example.com',
        serviceName: 'TestService',
      });

      const result = await client['get']<{ message: string; data: { id: number } }>('/test');
      expect(result).toEqual({ message: 'success', data: { id: 123 } });
    });

    it('should parse JSON error responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => '{"error":"Invalid input","code":"VALIDATION_ERROR"}',
      });

      const client = new BaseApiClient({
        baseUrl: 'https://api.example.com',
        serviceName: 'TestService',
        retry: { maxRetries: 0 }, // Disable retry for this test
      });

      await expect(client['get']('/test')).rejects.toThrow(/Invalid input/);
      await expect(client['get']('/test')).rejects.toThrow(/VALIDATION_ERROR/);
    });

    it('should handle text error responses when JSON parsing fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'Internal server error occurred',
      });

      const client = new BaseApiClient({
        baseUrl: 'https://api.example.com',
        serviceName: 'TestService',
        retry: { maxRetries: 0 },
      });

      await expect(client['get']('/test')).rejects.toThrow(/Internal server error occurred/);
    });
  });

  describe('HttpClient', () => {
    it('should handle malformed JSON gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => '{invalid: json}',
      });

      const client = new HttpClient({ baseUrl: 'https://api.example.com' });

      await expect(client.get('/test')).rejects.toThrow(/failed to parse/);
      await expect(client.get('/test')).rejects.toThrow(/Response preview:/);
    });

    it('should handle empty JSON response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => '',
      });

      const client = new HttpClient({ baseUrl: 'https://api.example.com' });

      const response = await client.get('/test');
      expect(response.data).toBeUndefined();
    });

    it('should parse valid JSON successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        url: 'https://api.example.com/test',
        headers: new Headers({ 'content-type': 'application/json; charset=utf-8' }),
        text: async () => '{"success":true}',
      });

      const client = new HttpClient({ baseUrl: 'https://api.example.com' });

      const response = await client.get<{ success: boolean }>('/test');
      expect(response.data).toEqual({ success: true });
      expect(response.ok).toBe(true);
    });

    it('should include service name in error messages', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => 'not json at all',
      });

      const client = new HttpClient({ baseUrl: 'https://api.example.com' });

      await expect(client.get('/test')).rejects.toThrow(/HTTP response/);
    });

    it('should provide helpful error with response preview', async () => {
      const longInvalidResponse = 'a'.repeat(500) + ' invalid json';
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => longInvalidResponse,
      });

      const client = new HttpClient({ baseUrl: 'https://api.example.com' });

      try {
        await client.get('/test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('Response preview:');
        // Should truncate to 200 chars
        expect(error.message.length).toBeLessThan(longInvalidResponse.length + 100);
      }
    });
  });
});
