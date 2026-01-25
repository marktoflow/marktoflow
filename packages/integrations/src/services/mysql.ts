/**
 * MySQL Integration
 *
 * Popular open-source relational database.
 * API: Using mysql2 driver
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export interface MySQLConfig {
  host: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | { rejectUnauthorized?: boolean };
  connectTimeout?: number;
  connectionLimit?: number;
  waitForConnections?: boolean;
  queueLimit?: number;
}

export interface QueryResult<T = unknown> {
  rows: T[];
  fields: { name: string; type: string }[];
  affectedRows?: number;
  insertId?: number;
}

export interface MySQLTransaction {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/**
 * MySQL client wrapper for workflow integration
 * Note: This is a lightweight wrapper. The actual mysql2 module will be dynamically imported.
 */
export class MySQLClient {
  private pool: unknown | null = null;
  private config: MySQLConfig;

  constructor(config: MySQLConfig) {
    this.config = config;
  }

  /**
   * Initialize the connection pool
   */
  async connect(): Promise<void> {
    if (this.pool) return;

    try {
      // Dynamic import to avoid bundling mysql2 if not used
      const mysql = await import('mysql2/promise');
      this.pool = mysql.createPool({
        host: this.config.host,
        port: this.config.port ?? 3306,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        ssl:
          this.config.ssl === true
            ? {}
            : (this.config.ssl as { rejectUnauthorized?: boolean } | undefined),
        connectTimeout: this.config.connectTimeout ?? 10000,
        connectionLimit: this.config.connectionLimit ?? 10,
        waitForConnections: this.config.waitForConnections ?? true,
        queueLimit: this.config.queueLimit ?? 0,
      });
    } catch (error) {
      throw new Error(
        `Failed to load mysql2 module. Install it with: npm install mysql2\nError: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute a SQL query
   */
  async query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    await this.connect();

    if (!this.pool) {
      throw new Error('MySQL pool not initialized');
    }

    const pool = this.pool as {
      query: (sql: string, params?: unknown[]) => Promise<[unknown[], unknown[]]>;
    };
    const [rows, fields] = await pool.query(sql, params);

    // Handle different result types
    const resultRows = Array.isArray(rows) ? rows : [];
    const resultFields = Array.isArray(fields)
      ? fields.map((f) => ({
          name: (f as { name: string }).name,
          type: (f as { type: string }).type,
        }))
      : [];

    // Check if it's an OkPacket (for INSERT/UPDATE/DELETE)
    const okPacket = rows as { affectedRows?: number; insertId?: number };

    return {
      rows: resultRows as T[],
      fields: resultFields,
      affectedRows: okPacket.affectedRows,
      insertId: okPacket.insertId,
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

    if (options?.where) {
      const conditions: string[] = [];
      for (const [key, value] of Object.entries(options.where)) {
        conditions.push(`${key} = ?`);
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
    data: Record<string, unknown> | Record<string, unknown>[]
  ): Promise<{ insertId: number; affectedRows: number }> {
    const rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) return { insertId: 0, affectedRows: 0 };

    const keys = Object.keys(rows[0]);
    const columns = keys.join(', ');
    const params: unknown[] = [];
    const valuePlaceholders: string[] = [];

    for (const row of rows) {
      const rowPlaceholders: string[] = [];
      for (const key of keys) {
        rowPlaceholders.push('?');
        params.push(row[key]);
      }
      valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
    }

    const sql = `INSERT INTO ${table} (${columns}) VALUES ${valuePlaceholders.join(', ')}`;
    const result = await this.query<T>(sql, params);

    return {
      insertId: result.insertId ?? 0,
      affectedRows: result.affectedRows ?? 0,
    };
  }

  /**
   * Update data in a table
   */
  async update<T = Record<string, unknown>>(
    table: string,
    data: Record<string, unknown>,
    where: Record<string, unknown>
  ): Promise<{ affectedRows: number }> {
    const setColumns: string[] = [];
    const params: unknown[] = [];

    for (const [key, value] of Object.entries(data)) {
      setColumns.push(`${key} = ?`);
      params.push(value);
    }

    const conditions: string[] = [];
    for (const [key, value] of Object.entries(where)) {
      conditions.push(`${key} = ?`);
      params.push(value);
    }

    const sql = `UPDATE ${table} SET ${setColumns.join(', ')} WHERE ${conditions.join(' AND ')}`;
    const result = await this.query<T>(sql, params);

    return {
      affectedRows: result.affectedRows ?? 0,
    };
  }

  /**
   * Delete data from a table
   */
  async delete<T = Record<string, unknown>>(
    table: string,
    where: Record<string, unknown>
  ): Promise<{ affectedRows: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    for (const [key, value] of Object.entries(where)) {
      conditions.push(`${key} = ?`);
      params.push(value);
    }

    const sql = `DELETE FROM ${table} WHERE ${conditions.join(' AND ')}`;
    const result = await this.query<T>(sql, params);

    return {
      affectedRows: result.affectedRows ?? 0,
    };
  }

  /**
   * Begin a transaction
   */
  async transaction<T>(callback: (trx: MySQLTransaction) => Promise<T>): Promise<T> {
    await this.connect();

    if (!this.pool) {
      throw new Error('MySQL pool not initialized');
    }

    const pool = this.pool as {
      getConnection: () => Promise<{
        query: (sql: string, params?: unknown[]) => Promise<[unknown[], unknown[]]>;
        beginTransaction: () => Promise<void>;
        commit: () => Promise<void>;
        rollback: () => Promise<void>;
        release: () => void;
      }>;
    };
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const trx: MySQLTransaction = {
        query: async <R = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<R>> => {
          const [rows, fields] = await connection.query(sql, params);
          const resultRows = Array.isArray(rows) ? rows : [];
          const resultFields = Array.isArray(fields)
            ? fields.map((f) => ({
                name: (f as { name: string }).name,
                type: (f as { type: string }).type,
              }))
            : [];

          const okPacket = rows as { affectedRows?: number; insertId?: number };

          return {
            rows: resultRows as R[],
            fields: resultFields,
            affectedRows: okPacket.affectedRows,
            insertId: okPacket.insertId,
          };
        },
        commit: async () => {
          await connection.commit();
        },
        rollback: async () => {
          await connection.rollback();
        },
      };

      const result = await callback(trx);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
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

export const MySQLInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const host = config.auth?.['host'] as string | undefined;
    const port = config.auth?.['port'] as number | undefined;
    const database = config.auth?.['database'] as string | undefined;
    const user = config.auth?.['user'] as string | undefined;
    const password = config.auth?.['password'] as string | undefined;
    const ssl = config.auth?.['ssl'] as boolean | { rejectUnauthorized?: boolean } | undefined;

    if (!host || !database || !user || !password) {
      throw new Error('MySQL SDK requires auth.host, auth.database, auth.user, auth.password');
    }

    const client = new MySQLClient({
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
