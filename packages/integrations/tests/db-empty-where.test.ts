/**
 * Tests that PostgreSQL and MySQL clients reject empty where/data objects
 * instead of generating invalid SQL (e.g. "DELETE FROM table WHERE ").
 */

import { describe, it, expect, vi } from 'vitest';

describe('PostgreSQL empty where/data validation', () => {
  it('should reject delete with empty where', async () => {
    const { PostgresClient } = await import('../src/services/postgres.js');
    const client = new PostgresClient({
      host: 'localhost', database: 'test', user: 'test', password: 'test',
    });
    (client as unknown as { pool: unknown }).pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'DELETE', fields: [] }),
    };

    await expect(client.delete('users', {})).rejects.toThrow('requires at least one condition');
  });

  it('should reject update with empty data', async () => {
    const { PostgresClient } = await import('../src/services/postgres.js');
    const client = new PostgresClient({
      host: 'localhost', database: 'test', user: 'test', password: 'test',
    });
    (client as unknown as { pool: unknown }).pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'UPDATE', fields: [] }),
    };

    await expect(client.update('users', {}, { id: 1 })).rejects.toThrow('requires at least one column');
  });

  it('should reject update with empty where', async () => {
    const { PostgresClient } = await import('../src/services/postgres.js');
    const client = new PostgresClient({
      host: 'localhost', database: 'test', user: 'test', password: 'test',
    });
    (client as unknown as { pool: unknown }).pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'UPDATE', fields: [] }),
    };

    await expect(client.update('users', { name: 'test' }, {})).rejects.toThrow('requires at least one condition');
  });

  it('should still allow valid delete and update', async () => {
    const { PostgresClient } = await import('../src/services/postgres.js');
    const client = new PostgresClient({
      host: 'localhost', database: 'test', user: 'test', password: 'test',
    });
    (client as unknown as { pool: unknown }).pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1, command: 'DELETE', fields: [] }),
    };

    await expect(client.delete('users', { id: 1 })).resolves.toBeDefined();
    await expect(client.update('users', { name: 'test' }, { id: 1 })).resolves.toBeDefined();
  });
});

describe('MySQL empty where/data validation', () => {
  it('should reject delete with empty where', async () => {
    const { MySQLClient } = await import('../src/services/mysql.js');
    const client = new MySQLClient({
      host: 'localhost', database: 'test', user: 'test', password: 'test',
    });
    (client as unknown as { pool: unknown }).pool = {
      query: vi.fn().mockResolvedValue([{ affectedRows: 0 }, []]),
    };

    await expect(client.delete('users', {})).rejects.toThrow('requires at least one condition');
  });

  it('should reject update with empty data', async () => {
    const { MySQLClient } = await import('../src/services/mysql.js');
    const client = new MySQLClient({
      host: 'localhost', database: 'test', user: 'test', password: 'test',
    });
    (client as unknown as { pool: unknown }).pool = {
      query: vi.fn().mockResolvedValue([{ affectedRows: 0 }, []]),
    };

    await expect(client.update('users', {}, { id: 1 })).rejects.toThrow('requires at least one column');
  });

  it('should reject update with empty where', async () => {
    const { MySQLClient } = await import('../src/services/mysql.js');
    const client = new MySQLClient({
      host: 'localhost', database: 'test', user: 'test', password: 'test',
    });
    (client as unknown as { pool: unknown }).pool = {
      query: vi.fn().mockResolvedValue([{ affectedRows: 0 }, []]),
    };

    await expect(client.update('users', { name: 'test' }, {})).rejects.toThrow('requires at least one condition');
  });
});
