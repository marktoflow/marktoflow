import { describe, it, expect, vi } from 'vitest';
import { PostgresInitializer } from '../src/services/postgres.js';

describe('Postgres Integration', () => {
  describe('PostgresInitializer', () => {
    it('should throw if required auth fields are missing', async () => {
      const config = { sdk: 'pg', auth: {} };
      await expect(PostgresInitializer.initialize(null, config as any)).rejects.toThrow(
        'PostgreSQL SDK requires auth.host, auth.database, auth.user, auth.password'
      );
    });

    it('should throw if host is missing', async () => {
      const config = {
        sdk: 'pg',
        auth: {
          port: '5432',
          database: 'testdb',
          user: 'testuser',
          password: 'testpass',
        },
      };
      await expect(PostgresInitializer.initialize(null, config as any)).rejects.toThrow();
    });

    it('should initialize with valid config', async () => {
      const config = {
        sdk: 'pg',
        auth: {
          host: 'localhost',
          port: '5432',
          database: 'testdb',
          user: 'testuser',
          password: 'testpass',
        },
      };

      // This test validates the config structure is correct
      // Actual connection testing would require a real database
      const result = await PostgresInitializer.initialize(null, config as any);
      expect(result).toHaveProperty('client');
    });
  });
});
