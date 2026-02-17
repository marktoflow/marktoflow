/**
 * Contract tests for PostgreSQL integration
 *
 * These tests validate that:
 * 1. The wrapper integration works correctly
 * 2. Input validation schemas work as expected
 * 3. Query construction is correct
 * 4. Results are handled properly
 *
 * Note: PostgreSQL uses native protocol (not HTTP), so we use mocks instead of MSW
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wrapIntegration } from '../../src/reliability/wrapper.js';
import { postgresSchemas } from '../../src/reliability/schemas/postgres.js';
import { PostgresClient } from '../../src/services/postgres.js';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the pg module
vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: vi.fn(),
    connect: vi.fn().mockResolvedValue({
      query: vi.fn(),
      release: vi.fn(),
    }),
    end: vi.fn(),
  })),
}));

// ============================================================================
// Contract Tests
// ============================================================================

describe('PostgreSQL Contract Tests', () => {
  let mockPool: any;

  beforeEach(async () => {
    const { Pool } = await import('pg');
    mockPool = new Pool();
    vi.clearAllMocks();
  });

  it('should execute a raw query successfully', async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ id: 1, name: 'Test' }],
      rowCount: 1,
      command: 'SELECT',
      fields: [
        { name: 'id', dataTypeID: 23 },
        { name: 'name', dataTypeID: 25 },
      ],
    });

    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    // Mock the pool property
    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('postgres', client, {
      inputSchemas: postgresSchemas,
    });

    const result = await wrapped.query('SELECT * FROM users WHERE id = $1', [1]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('Test');
    expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
  });

  it('should reject invalid inputs (missing SQL text)', async () => {
    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('postgres', client, {
      inputSchemas: postgresSchemas,
    });

    await expect(
      wrapped.query({
        text: '',
        values: [],
      } as any)
    ).rejects.toThrow(/text/);
  });

  it('should select data from table successfully', async () => {
    mockPool.query.mockResolvedValue({
      rows: [
        { id: 1, name: 'User 1', email: 'user1@example.com' },
        { id: 2, name: 'User 2', email: 'user2@example.com' },
      ],
      rowCount: 2,
      command: 'SELECT',
      fields: [],
    });

    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('postgres', client, {
      inputSchemas: postgresSchemas,
    });

    const result = await wrapped.select('users', {
      columns: ['id', 'name', 'email'],
      where: { id: 1 },
      limit: 10,
    });

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('User 1');
    expect(mockPool.query).toHaveBeenCalledWith(
      'SELECT "id", "name", "email" FROM "users" WHERE "id" = $1 LIMIT 10',
      [1]
    );
  });

  it('should reject invalid inputs (missing table in select)', async () => {
    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('postgres', client, {
      inputSchemas: postgresSchemas,
    });

    await expect(
      wrapped.select('', {
        columns: ['id', 'name'],
      })
    ).rejects.toThrow();
  });

  it('should insert data into table successfully', async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ id: 1, name: 'New User', email: 'new@example.com' }],
      rowCount: 1,
      command: 'INSERT',
      fields: [],
    });

    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('postgres', client, {
      inputSchemas: postgresSchemas,
    });

    const result = await wrapped.insert('users', {
      name: 'New User',
      email: 'new@example.com',
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('New User');
    expect(mockPool.query).toHaveBeenCalledWith(
      'INSERT INTO "users" ("name", "email") VALUES ($1, $2)',
      ['New User', 'new@example.com']
    );
  });

  it('should reject invalid inputs (missing table in insert)', async () => {
    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('postgres', client, {
      inputSchemas: postgresSchemas,
    });

    await expect(
      wrapped.insert('', {
        name: 'Test',
      })
    ).rejects.toThrow();
  });

  it('should update data in table successfully', async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ id: 1, name: 'Updated User', email: 'updated@example.com' }],
      rowCount: 1,
      command: 'UPDATE',
      fields: [],
    });

    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('postgres', client, {
      inputSchemas: postgresSchemas,
    });

    const result = await wrapped.update(
      'users',
      { name: 'Updated User' },
      { id: 1 }
    );

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Updated User');
    expect(mockPool.query).toHaveBeenCalledWith(
      'UPDATE "users" SET "name" = $1 WHERE "id" = $2',
      ['Updated User', 1]
    );
  });

  it('should reject invalid inputs (missing where in update)', async () => {
    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('postgres', client, {
      inputSchemas: postgresSchemas,
    });

    await expect(
      wrapped.update('users', { name: 'Test' }, {} as any)
    ).rejects.toThrow();
  });

  it('should delete data from table successfully', async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ id: 1, name: 'Deleted User' }],
      rowCount: 1,
      command: 'DELETE',
      fields: [],
    });

    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('postgres', client, {
      inputSchemas: postgresSchemas,
    });

    const result = await wrapped.delete('users', { id: 1 });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM "users" WHERE "id" = $1', [1]);
  });

  it('should reject invalid inputs (missing table in delete)', async () => {
    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('postgres', client, {
      inputSchemas: postgresSchemas,
    });

    await expect(wrapped.delete('', { id: 1 })).rejects.toThrow();
  });

  it('should handle query errors gracefully', async () => {
    mockPool.query.mockRejectedValue(new Error('Database connection failed'));

    const client = new PostgresClient({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    (client as any).pool = mockPool;

    const wrapped = wrapIntegration('postgres', client, {
      inputSchemas: postgresSchemas,
      maxRetries: 0,
    });

    await expect(wrapped.query('SELECT * FROM users', [])).rejects.toThrow(
      'Database connection failed'
    );
  });
});
