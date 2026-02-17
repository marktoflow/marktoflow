/**
 * Tests for SQL identifier injection prevention in PostgreSQL and MySQL clients.
 *
 * These tests verify that table names, column names, and ORDER BY clauses
 * are properly sanitized to prevent SQL injection via identifiers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the quoteIdentifier/sanitizeOrderBy logic indirectly through the
// client methods by mocking the database pool.

describe('PostgreSQL SQL identifier sanitization', () => {
  let PostgresClient: typeof import('../src/services/postgres.js').PostgresClient;

  beforeEach(async () => {
    const mod = await import('../src/services/postgres.js');
    PostgresClient = mod.PostgresClient;
  });

  it('should reject table names with SQL injection patterns', async () => {
    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    // Mock pool
    (client as unknown as { pool: unknown }).pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT', fields: [] }),
    };

    // Normal table name should work
    await expect(client.select('users')).resolves.toBeDefined();

    // SQL injection via table name should throw
    await expect(client.select('users; DROP TABLE users--')).rejects.toThrow('Invalid SQL identifier');
    await expect(client.select("users' OR '1'='1")).rejects.toThrow('Invalid SQL identifier');
    await expect(client.select('users); DELETE FROM users;--')).rejects.toThrow('Invalid SQL identifier');
  });

  it('should reject column names with SQL injection patterns', async () => {
    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as unknown as { pool: unknown }).pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT', fields: [] }),
    };

    // Normal columns should work
    await expect(client.select('users', { columns: ['id', 'name', 'email'] })).resolves.toBeDefined();

    // Injection in column names should throw
    await expect(client.select('users', { columns: ['id; DROP TABLE users'] })).rejects.toThrow('Invalid SQL identifier');
  });

  it('should reject ORDER BY injection', async () => {
    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as unknown as { pool: unknown }).pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT', fields: [] }),
    };

    // Normal ORDER BY should work
    await expect(client.select('users', { orderBy: 'name ASC' })).resolves.toBeDefined();
    await expect(client.select('users', { orderBy: 'name DESC, id' })).resolves.toBeDefined();

    // Injection in ORDER BY should throw
    await expect(client.select('users', { orderBy: 'name; DROP TABLE users' })).rejects.toThrow('Invalid ORDER BY');
    await expect(client.select('users', { orderBy: '1=1 UNION SELECT *' })).rejects.toThrow('Invalid ORDER BY');
  });

  it('should properly quote identifiers with reserved words', async () => {
    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT', fields: [] });
    (client as unknown as { pool: unknown }).pool = { query: mockQuery };

    await client.select('order', { columns: ['select', 'from'], where: { group: 'a' } });
    const sql = mockQuery.mock.calls[0][0] as string;

    // Should be quoted with double quotes
    expect(sql).toContain('"order"');
    expect(sql).toContain('"select"');
    expect(sql).toContain('"from"');
    expect(sql).toContain('"group"');
  });

  it('should sanitize identifiers in insert', async () => {
    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as unknown as { pool: unknown }).pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'INSERT', fields: [] }),
    };

    await expect(
      client.insert('users; DROP TABLE users', { name: 'test' })
    ).rejects.toThrow('Invalid SQL identifier');
  });

  it('should sanitize identifiers in update', async () => {
    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as unknown as { pool: unknown }).pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'UPDATE', fields: [] }),
    };

    await expect(
      client.update('users', { 'name; DROP TABLE users': 'evil' }, { id: 1 })
    ).rejects.toThrow('Invalid SQL identifier');
  });

  it('should sanitize identifiers in delete', async () => {
    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as unknown as { pool: unknown }).pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'DELETE', fields: [] }),
    };

    await expect(
      client.delete("users' OR '1'='1", { id: 1 })
    ).rejects.toThrow('Invalid SQL identifier');
  });

  it('should allow schema-qualified table names', async () => {
    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT', fields: [] });
    (client as unknown as { pool: unknown }).pool = { query: mockQuery };

    await client.select('public.users');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should sanitize RETURNING columns', async () => {
    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as unknown as { pool: unknown }).pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'INSERT', fields: [] }),
    };

    await expect(
      client.insert('users', { name: 'test' }, ['id; DROP TABLE users'])
    ).rejects.toThrow('Invalid SQL identifier');
  });
});

describe('MySQL SQL identifier sanitization', () => {
  let MySQLClient: typeof import('../src/services/mysql.js').MySQLClient;

  beforeEach(async () => {
    const mod = await import('../src/services/mysql.js');
    MySQLClient = mod.MySQLClient;
  });

  it('should reject table names with SQL injection patterns', async () => {
    const client = new MySQLClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as unknown as { pool: unknown }).pool = {
      query: vi.fn().mockResolvedValue([[], []]),
    };

    await expect(client.select('users')).resolves.toBeDefined();
    await expect(client.select('users; DROP TABLE users--')).rejects.toThrow('Invalid SQL identifier');
  });

  it('should use backtick quoting for MySQL identifiers', async () => {
    const client = new MySQLClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    const mockQuery = vi.fn().mockResolvedValue([[], []]);
    (client as unknown as { pool: unknown }).pool = { query: mockQuery };

    await client.select('order', { columns: ['select', 'from'] });
    const sql = mockQuery.mock.calls[0][0] as string;

    // MySQL uses backticks
    expect(sql).toContain('`order`');
    expect(sql).toContain('`select`');
    expect(sql).toContain('`from`');
  });

  it('should reject injection in insert/update/delete', async () => {
    const client = new MySQLClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as unknown as { pool: unknown }).pool = {
      query: vi.fn().mockResolvedValue([{ affectedRows: 0, insertId: 0 }, []]),
    };

    await expect(client.insert('users; DROP TABLE users', { name: 'test' })).rejects.toThrow('Invalid SQL identifier');
    await expect(client.update('users', { name: 'test' }, { "id' OR '1'='1": 1 })).rejects.toThrow('Invalid SQL identifier');
    await expect(client.delete('users', { "1=1; --": 'x' })).rejects.toThrow('Invalid SQL identifier');
  });
});
