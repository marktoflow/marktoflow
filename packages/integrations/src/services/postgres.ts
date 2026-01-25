/**
 * PostgreSQL Integration
 *
 * Popular open-source relational database.
 * API: Using node-postgres (pg) driver
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export interface PostgresConfig {
  host: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | { rejectUnauthorized?: boolean };
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  max?: number;
}

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
  command: string;
  fields: { name: string; dataTypeID: number }[];
}

export interface PostgresTransaction {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/**
 * PostgreSQL client wrapper for workflow integration
 * Note: This is a lightweight wrapper. The actual pg module will be dynamically imported.
 */
export class PostgresClient {
  private pool: unknown | null = null;
  private config: PostgresConfig;

  constructor(config: PostgresConfig) {
    this.config = config;
  }

  /**
   * Initialize the connection pool
   */
  async connect(): Promise<void> {
    if (this.pool) return;

    try {
      // Dynamic import to avoid bundling pg if not used
      const { Pool } = await import('pg');
      this.pool = new Pool({
        host: this.config.host,
        port: this.config.port ?? 5432,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        ssl: this.config.ssl,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis ?? 30000,
        idleTimeoutMillis: this.config.idleTimeoutMillis ?? 30000,
        max: this.config.max ?? 10,
      });
    } catch (error) {
      throw new Error(
        `Failed to load pg module. Install it with: npm install pg\nError: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute a SQL query
   */
  async query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    await this.connect();

    if (!this.pool) {
      throw new Error('PostgreSQL pool not initialized');
    }

    const pool = this.pool as {
      query: (sql: string, params?: unknown[]) => Promise<QueryResult<T>>;
    };
    const result = await pool.query(sql, params);

    return {
      rows: result.rows,
      rowCount: result.rowCount,
      command: result.command,
      fields: result.fields,
    };
  }

  /**
   * Select data from a table
   */
  async select<T = Record<string, unknown>>(
    table: string,
    options?: {
      columns?: string[];
      where?: Record<string, unknown>;
      orderBy?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<T[]> {
    const columns = options?.columns?.join(', ') ?? '*';
    let sql = `SELECT ${columns} FROM ${table}`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options?.where) {
      const conditions: string[] = [];
      for (const [key, value] of Object.entries(options.where)) {
        conditions.push(`${key} = $${paramIndex++}`);
        params.push(value);
      }
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }
    }

    if (options?.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }

    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`;
    }

    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`;
    }

    const result = await this.query<T>(sql, params);
    return result.rows;
  }

  /**
   * Insert data into a table
   */
  async insert<T = Record<string, unknown>>(
    table: string,
    data: Record<string, unknown> | Record<string, unknown>[],
    returning?: string[]
  ): Promise<T[]> {
    const rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) return [];

    const keys = Object.keys(rows[0]);
    const columns = keys.join(', ');
    const params: unknown[] = [];
    const valuePlaceholders: string[] = [];

    let paramIndex = 1;
    for (const row of rows) {
      const rowPlaceholders: string[] = [];
      for (const key of keys) {
        rowPlaceholders.push(`$${paramIndex++}`);
        params.push(row[key]);
      }
      valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
    }

    let sql = `INSERT INTO ${table} (${columns}) VALUES ${valuePlaceholders.join(', ')}`;

    if (returning && returning.length > 0) {
      sql += ` RETURNING ${returning.join(', ')}`;
    }

    const result = await this.query<T>(sql, params);
    return result.rows;
  }

  /**
   * Update data in a table
   */
  async update<T = Record<string, unknown>>(
    table: string,
    data: Record<string, unknown>,
    where: Record<string, unknown>,
    returning?: string[]
  ): Promise<T[]> {
    const setColumns: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      setColumns.push(`${key} = $${paramIndex++}`);
      params.push(value);
    }

    const conditions: string[] = [];
    for (const [key, value] of Object.entries(where)) {
      conditions.push(`${key} = $${paramIndex++}`);
      params.push(value);
    }

    let sql = `UPDATE ${table} SET ${setColumns.join(', ')} WHERE ${conditions.join(' AND ')}`;

    if (returning && returning.length > 0) {
      sql += ` RETURNING ${returning.join(', ')}`;
    }

    const result = await this.query<T>(sql, params);
    return result.rows;
  }

  /**
   * Delete data from a table
   */
  async delete<T = Record<string, unknown>>(
    table: string,
    where: Record<string, unknown>,
    returning?: string[]
  ): Promise<T[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(where)) {
      conditions.push(`${key} = $${paramIndex++}`);
      params.push(value);
    }

    let sql = `DELETE FROM ${table} WHERE ${conditions.join(' AND ')}`;

    if (returning && returning.length > 0) {
      sql += ` RETURNING ${returning.join(', ')}`;
    }

    const result = await this.query<T>(sql, params);
    return result.rows;
  }

  /**
   * Begin a transaction
   */
  async transaction<T>(callback: (trx: PostgresTransaction) => Promise<T>): Promise<T> {
    await this.connect();

    if (!this.pool) {
      throw new Error('PostgreSQL pool not initialized');
    }

    const pool = this.pool as {
      connect: () => Promise<{
        query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
        release: () => void;
      }>;
    };
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const trx: PostgresTransaction = {
        query: async <R = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<R>> => {
          const result = await client.query(sql, params);
          return result as QueryResult<R>;
        },
        commit: async () => {
          await client.query('COMMIT');
        },
        rollback: async () => {
          await client.query('ROLLBACK');
        },
      };

      const result = await callback(trx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    if (this.pool) {
      const pool = this.pool as { end: () => Promise<void> };
      await pool.end();
      this.pool = null;
    }
  }
}

export const PostgresInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const host = config.auth?.['host'] as string | undefined;
    const port = config.auth?.['port'] as number | undefined;
    const database = config.auth?.['database'] as string | undefined;
    const user = config.auth?.['user'] as string | undefined;
    const password = config.auth?.['password'] as string | undefined;
    const ssl = config.auth?.['ssl'] as boolean | { rejectUnauthorized?: boolean } | undefined;

    if (!host || !database || !user || !password) {
      throw new Error('PostgreSQL SDK requires auth.host, auth.database, auth.user, auth.password');
    }

    const client = new PostgresClient({
      host,
      port,
      database,
      user,
      password,
      ssl,
    });

    await client.connect();

    return {
      client,
      actions: client,
    };
  },
};
