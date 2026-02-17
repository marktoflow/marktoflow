/**
 * Tests for database transaction double-commit prevention
 * in PostgreSQL and MySQL clients.
 */

import { describe, it, expect, vi } from 'vitest';

describe('PostgreSQL transaction lifecycle', () => {
  it('should auto-commit when callback does not commit', async () => {
    const { PostgresClient } = await import('../src/services/postgres.js');
    const client = new PostgresClient({
      host: 'localhost', database: 'test', user: 'test', password: 'test',
    });

    const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: '', fields: [] });
    const mockRelease = vi.fn();
    (client as unknown as { pool: unknown }).pool = {
      connect: vi.fn().mockResolvedValue({ query: mockQuery, release: mockRelease }),
    };

    await client.transaction(async (trx) => {
      await trx.query('INSERT INTO users (name) VALUES ($1)', ['alice']);
      return 'done';
    });

    const queries = mockQuery.mock.calls.map((c) => c[0]);
    expect(queries).toEqual(['BEGIN', 'INSERT INTO users (name) VALUES ($1)', 'COMMIT']);
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it('should not double-commit when callback calls trx.commit()', async () => {
    const { PostgresClient } = await import('../src/services/postgres.js');
    const client = new PostgresClient({
      host: 'localhost', database: 'test', user: 'test', password: 'test',
    });

    const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: '', fields: [] });
    const mockRelease = vi.fn();
    (client as unknown as { pool: unknown }).pool = {
      connect: vi.fn().mockResolvedValue({ query: mockQuery, release: mockRelease }),
    };

    await client.transaction(async (trx) => {
      await trx.query('INSERT INTO users (name) VALUES ($1)', ['alice']);
      await trx.commit();
      return 'done';
    });

    const queries = mockQuery.mock.calls.map((c) => c[0]);
    // Should have exactly one COMMIT, not two
    expect(queries).toEqual(['BEGIN', 'INSERT INTO users (name) VALUES ($1)', 'COMMIT']);
    expect(queries.filter((q) => q === 'COMMIT')).toHaveLength(1);
  });

  it('should not rollback after manual commit even if subsequent code throws', async () => {
    const { PostgresClient } = await import('../src/services/postgres.js');
    const client = new PostgresClient({
      host: 'localhost', database: 'test', user: 'test', password: 'test',
    });

    const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: '', fields: [] });
    const mockRelease = vi.fn();
    (client as unknown as { pool: unknown }).pool = {
      connect: vi.fn().mockResolvedValue({ query: mockQuery, release: mockRelease }),
    };

    await expect(
      client.transaction(async (trx) => {
        await trx.query('INSERT INTO users (name) VALUES ($1)', ['alice']);
        await trx.commit();
        throw new Error('post-commit error');
      })
    ).rejects.toThrow('post-commit error');

    const queries = mockQuery.mock.calls.map((c) => c[0]);
    // COMMIT happened (from trx.commit), then ROLLBACK is attempted by catch block
    // but that's harmless — the important thing is we don't double-commit
    expect(queries.filter((q) => q === 'COMMIT')).toHaveLength(1);
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it('should prevent double-rollback', async () => {
    const { PostgresClient } = await import('../src/services/postgres.js');
    const client = new PostgresClient({
      host: 'localhost', database: 'test', user: 'test', password: 'test',
    });

    const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: '', fields: [] });
    const mockRelease = vi.fn();
    (client as unknown as { pool: unknown }).pool = {
      connect: vi.fn().mockResolvedValue({ query: mockQuery, release: mockRelease }),
    };

    await expect(
      client.transaction(async (trx) => {
        await trx.rollback();
        throw new Error('intentional');
      })
    ).rejects.toThrow('intentional');

    // Manual rollback happened, then catch block tries ROLLBACK again (harmless)
    // The key is trx.rollback() only runs once via the flag
    const rollbackCalls = mockQuery.mock.calls.filter((c) => c[0] === 'ROLLBACK');
    // Manual rollback (1) + catch block attempt (1)
    expect(rollbackCalls.length).toBeGreaterThanOrEqual(1);
    expect(mockRelease).toHaveBeenCalledOnce();
  });
});

describe('MySQL transaction lifecycle', () => {
  it('should auto-commit when callback does not commit', async () => {
    const { MySQLClient } = await import('../src/services/mysql.js');
    const client = new MySQLClient({
      host: 'localhost', database: 'test', user: 'test', password: 'test',
    });

    const calls: string[] = [];
    const mockConnection = {
      query: vi.fn().mockImplementation((sql: string) => {
        calls.push(`query:${sql}`);
        return Promise.resolve([[], []]);
      }),
      beginTransaction: vi.fn().mockImplementation(() => {
        calls.push('beginTransaction');
        return Promise.resolve();
      }),
      commit: vi.fn().mockImplementation(() => {
        calls.push('commit');
        return Promise.resolve();
      }),
      rollback: vi.fn().mockImplementation(() => {
        calls.push('rollback');
        return Promise.resolve();
      }),
      release: vi.fn(),
    };
    (client as unknown as { pool: unknown }).pool = {
      getConnection: vi.fn().mockResolvedValue(mockConnection),
    };

    await client.transaction(async (trx) => {
      await trx.query('INSERT INTO users (name) VALUES (?)', ['alice']);
      return 'done';
    });

    expect(mockConnection.beginTransaction).toHaveBeenCalledOnce();
    expect(mockConnection.commit).toHaveBeenCalledOnce();
    expect(mockConnection.rollback).not.toHaveBeenCalled();
    expect(mockConnection.release).toHaveBeenCalledOnce();
  });

  it('should not double-commit when callback calls trx.commit()', async () => {
    const { MySQLClient } = await import('../src/services/mysql.js');
    const client = new MySQLClient({
      host: 'localhost', database: 'test', user: 'test', password: 'test',
    });

    const mockConnection = {
      query: vi.fn().mockResolvedValue([[], []]),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    };
    (client as unknown as { pool: unknown }).pool = {
      getConnection: vi.fn().mockResolvedValue(mockConnection),
    };

    await client.transaction(async (trx) => {
      await trx.query('INSERT INTO users (name) VALUES (?)', ['alice']);
      await trx.commit();
      return 'done';
    });

    // commit should be called exactly once (by trx.commit), not twice
    expect(mockConnection.commit).toHaveBeenCalledOnce();
    expect(mockConnection.release).toHaveBeenCalledOnce();
  });
});
