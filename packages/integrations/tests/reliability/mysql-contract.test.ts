/**
 * Contract tests for MySQL integration
 *
 * These tests validate that:
 * 1. The wrapper integration works correctly
 * 2. Input validation schemas work as expected
 * 3. Query construction is correct
 * 4. Results are handled properly
 *
 * Note: MySQL uses native protocol (not HTTP), so we use mocks instead of MSW
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wrapIntegration } from '../../src/reliability/wrapper.js';
import { mysqlSchemas } from '../../src/reliability/schemas/mysql.js';
import { MySQLClient } from '../../src/services/mysql.js';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the mysql2/promise module
vi.mock('mysql2/promise', () => ({
  createPool: vi.fn().mockImplementation(() => ({
    query: vi.fn(),
    getConnection: vi.fn().mockResolvedValue({
      query: vi.fn(),
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    }),
    end: vi.fn(),
  })),
}));

// ============================================================================
// Contract Tests
// ============================================================================

describe('MySQL Contract Tests', () => {
  let mockPool: any;

  beforeEach(async () => {
    const mysql = await import('mysql2/promise');
    mockPool = mysql.createPool({});
    vi.clearAllMocks();
  });

  it('should execute a raw query successfully', async () => {
    mockPool.query.mockResolvedValue([
      [{ id: 1, name: 'Test' }],
      [
        { name: 'id', type: 'LONG' },
        { name: 'name', type: 'VAR_STRING' },
      ],
    ]);

    const client = new MySQLClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    // Mock the pool property
    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('mysql', client, {
      inputSchemas: mysqlSchemas,
    });

    const result = await wrapped.query('SELECT * FROM users WHERE id = ?', [1]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('Test');
    expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [1]);
  });

  it('should reject invalid inputs (missing SQL)', async () => {
    const client = new MySQLClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('mysql', client, {
      inputSchemas: mysqlSchemas,
    });

    await expect(
      wrapped.query({
        sql: '',
        values: [],
      } as any)
    ).rejects.toThrow(/sql/);
  });

  it('should select data from table successfully', async () => {
    mockPool.query.mockResolvedValue([
      [
        { id: 1, name: 'User 1', email: 'user1@example.com' },
        { id: 2, name: 'User 2', email: 'user2@example.com' },
      ],
      [
        { name: 'id', type: 'LONG' },
        { name: 'name', type: 'VAR_STRING' },
        { name: 'email', type: 'VAR_STRING' },
      ],
    ]);

    const client = new MySQLClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('mysql', client, {
      inputSchemas: mysqlSchemas,
    });

    const result = await wrapped.select('users', {
      columns: ['id', 'name', 'email'],
      where: { id: 1 },
      limit: 10,
    });

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('User 1');
    expect(mockPool.query).toHaveBeenCalledWith(
      'SELECT `id`, `name`, `email` FROM `users` WHERE `id` = ? LIMIT 10',
      [1]
    );
  });

  it('should reject invalid inputs (missing table in select)', async () => {
    const client = new MySQLClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('mysql', client, {
      inputSchemas: mysqlSchemas,
    });

    await expect(
      wrapped.select('', {
        columns: ['id', 'name'],
      })
    ).rejects.toThrow();
  });

  it('should insert data into table successfully', async () => {
    mockPool.query.mockResolvedValue([
      {
        affectedRows: 1,
        insertId: 1,
      },
      [],
    ]);

    const client = new MySQLClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('mysql', client, {
      inputSchemas: mysqlSchemas,
    });

    const result = await wrapped.insert('users', {
      name: 'New User',
      email: 'new@example.com',
    });

    expect(result.insertId).toBe(1);
    expect(result.affectedRows).toBe(1);
    expect(mockPool.query).toHaveBeenCalledWith(
      'INSERT INTO `users` (`name`, `email`) VALUES (?, ?)',
      ['New User', 'new@example.com']
    );
  });

  it('should reject invalid inputs (missing table in insert)', async () => {
    const client = new MySQLClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('mysql', client, {
      inputSchemas: mysqlSchemas,
    });

    await expect(
      wrapped.insert('', {
        name: 'Test',
      })
    ).rejects.toThrow();
  });

  it('should update data in table successfully', async () => {
    mockPool.query.mockResolvedValue([
      {
        affectedRows: 1,
      },
      [],
    ]);

    const client = new MySQLClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('mysql', client, {
      inputSchemas: mysqlSchemas,
    });

    const result = await wrapped.update(
      'users',
      { name: 'Updated User' },
      { id: 1 }
    );

    expect(result.affectedRows).toBe(1);
    expect(mockPool.query).toHaveBeenCalledWith('UPDATE `users` SET `name` = ? WHERE `id` = ?', [
      'Updated User',
      1,
    ]);
  });

  it('should reject invalid inputs (missing where in update)', async () => {
    const client = new MySQLClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('mysql', client, {
      inputSchemas: mysqlSchemas,
    });

    await expect(wrapped.update('users', { name: 'Test' }, {} as any)).rejects.toThrow();
  });

  it('should delete data from table successfully', async () => {
    mockPool.query.mockResolvedValue([
      {
        affectedRows: 1,
      },
      [],
    ]);

    const client = new MySQLClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('mysql', client, {
      inputSchemas: mysqlSchemas,
    });

    const result = await wrapped.delete('users', { id: 1 });

    expect(result.affectedRows).toBe(1);
    expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM `users` WHERE `id` = ?', [1]);
  });

  it('should reject invalid inputs (missing table in delete)', async () => {
    const client = new MySQLClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('mysql', client, {
      inputSchemas: mysqlSchemas,
    });

    await expect(wrapped.delete('', { id: 1 })).rejects.toThrow();
  });

  it('should handle query errors gracefully', async () => {
    mockPool.query.mockRejectedValue(new Error('Database connection failed'));

    const client = new MySQLClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('mysql', client, {
      inputSchemas: mysqlSchemas,
      maxRetries: 0,
    });

    await expect(wrapped.query('SELECT * FROM users', [])).rejects.toThrow(
      'Database connection failed'
    );
  });
});
