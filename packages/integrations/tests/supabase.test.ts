import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SupabaseInitializer, SupabaseClient } from '../src/services/supabase.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Supabase Integration', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SupabaseInitializer', () => {
    it('should throw if required auth fields are missing', async () => {
      const config = { sdk: 'supabase', auth: {} };
      await expect(SupabaseInitializer.initialize(null, config as any)).rejects.toThrow(
        'Supabase SDK requires auth.url and auth.key'
      );
    });

    it('should throw if url is missing', async () => {
      const config = {
        sdk: 'supabase',
        auth: {
          key: 'key123',
        },
      };
      await expect(SupabaseInitializer.initialize(null, config as any)).rejects.toThrow();
    });

    it('should initialize with valid config', async () => {
      const config = {
        sdk: 'supabase',
        auth: {
          url: 'https://project.supabase.co',
          key: 'test-api-key',
        },
      };

      const result = await SupabaseInitializer.initialize(null, config as any);
      expect(result).toHaveProperty('client');
      expect((result as any).client).toBeInstanceOf(SupabaseClient);
    });
  });

  describe('SupabaseClient', () => {
    let client: SupabaseClient;

    beforeEach(() => {
      client = new SupabaseClient('https://project.supabase.co', 'test-key');
    });

    it('should have all required methods', () => {
      expect(client.from).toBeDefined();
      expect(client.rpc).toBeDefined();
      expect(client.signUp).toBeDefined();
      expect(client.signIn).toBeDefined();
      expect(client.signOut).toBeDefined();
    });

    describe('rpc', () => {
      it('should call a stored procedure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            count: 42,
            average: 25.5,
          }),
        });

        const result = await client.rpc('calculate_stats', {
          start_date: '2026-01-01',
          end_date: '2026-01-31',
        });

        expect((result as any).count).toBe(42);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/rest/v1/rpc/calculate_stats'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    describe('signUp', () => {
      it('should sign up a new user', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: { id: 'user123', email: 'newuser@example.com' },
            session: { access_token: 'token123', refresh_token: 'refresh123' },
          }),
        });

        const result = await client.signUp({
          email: 'newuser@example.com',
          password: 'password123',
        });

        expect(result.user?.email).toBe('newuser@example.com');
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/auth/v1/signup'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    describe('signIn', () => {
      it('should sign in a user', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user: { id: 'user123', email: 'user@example.com' },
            session: { access_token: 'token456', refresh_token: 'refresh456' },
          }),
        });

        const result = await client.signIn({
          email: 'user@example.com',
          password: 'password123',
        });

        expect(result.session?.access_token).toBe('token456');
      });
    });

    describe('error handling', () => {
      it('should throw on API error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () => 'Bad Request',
        });

        await expect(client.rpc('invalid_function')).rejects.toThrow('Supabase API error');
      });
    });
  });
});
