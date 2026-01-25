import { describe, it, expect, vi } from 'vitest';
import { MySQLInitializer } from '../src/services/mysql.js';

describe('MySQL Integration', () => {
  describe('MySQLInitializer', () => {
    it('should throw if required auth fields are missing', async () => {
      const config = { sdk: 'mysql2', auth: {} };
      await expect(MySQLInitializer.initialize(null, config as any)).rejects.toThrow(
        'MySQL SDK requires auth.host, auth.database, auth.user, auth.password'
      );
    });

    it('should throw if host is missing', async () => {
      const config = {
        sdk: 'mysql2',
        auth: {
          database: 'testdb',
          user: 'testuser',
          password: 'testpass',
        },
      };
      await expect(MySQLInitializer.initialize(null, config as any)).rejects.toThrow();
    });

    it('should initialize with valid config', async () => {
      const config = {
        sdk: 'mysql2',
        auth: {
          host: 'localhost',
          port: '3306',
          database: 'testdb',
          user: 'testuser',
          password: 'testpass',
        },
      };

      // This test validates the config structure is correct
      // Actual connection testing would require a real database
      const result = await MySQLInitializer.initialize(null, config as any);
      expect(result).toHaveProperty('client');
    });
  });
});
