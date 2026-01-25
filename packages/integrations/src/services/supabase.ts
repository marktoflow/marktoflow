/**
 * Supabase Integration
 *
 * Open source Firebase alternative with PostgreSQL backend.
 * API Docs: https://supabase.com/docs/reference/javascript/introduction
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export interface SupabaseQueryOptions {
  select?: string;
  filter?: { column: string; operator: string; value: unknown }[];
  order?: { column: string; ascending?: boolean }[];
  limit?: number;
  offset?: number;
  single?: boolean;
}

export interface SupabaseInsertOptions<T> {
  data: T | T[];
  returning?: boolean;
}

export interface SupabaseUpdateOptions<T> {
  data: Partial<T>;
  filter?: { column: string; operator: string; value: unknown }[];
}

export interface SupabaseDeleteOptions {
  filter: { column: string; operator: string; value: unknown }[];
}

export interface SupabaseStorageUploadOptions {
  bucket: string;
  path: string;
  file: Buffer | Blob;
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
}

export interface SupabaseStorageDownloadOptions {
  bucket: string;
  path: string;
}

export interface SupabaseAuthSignUpOptions {
  email: string;
  password: string;
  options?: {
    data?: Record<string, unknown>;
    emailRedirectTo?: string;
  };
}

export interface SupabaseAuthSignInOptions {
  email: string;
  password: string;
}

/**
 * Supabase client for workflow integration
 */
export class SupabaseClient {
  private apiUrl: string;
  private headers: Record<string, string>;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.apiUrl = supabaseUrl;
    this.headers = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase API error: ${response.status} ${error}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  /**
   * Query data from a table
   */
  async from<T = Record<string, unknown>>(table: string): Promise<SupabaseTableQuery<T>> {
    return new SupabaseTableQuery<T>(this.apiUrl, this.headers, table);
  }

  /**
   * Execute a SQL query via RPC
   */
  async rpc<T = unknown>(functionName: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('POST', `/rest/v1/rpc/${functionName}`, params);
  }

  /**
   * Sign up a new user
   */
  async signUp(options: SupabaseAuthSignUpOptions): Promise<{
    user: { id: string; email: string } | null;
    session: { access_token: string; refresh_token: string } | null;
  }> {
    return this.request('POST', '/auth/v1/signup', {
      email: options.email,
      password: options.password,
      data: options.options?.data,
      email_redirect_to: options.options?.emailRedirectTo,
    });
  }

  /**
   * Sign in a user
   */
  async signIn(options: SupabaseAuthSignInOptions): Promise<{
    user: { id: string; email: string } | null;
    session: { access_token: string; refresh_token: string } | null;
  }> {
    return this.request('POST', '/auth/v1/token?grant_type=password', {
      email: options.email,
      password: options.password,
    });
  }

  /**
   * Sign out a user
   */
  async signOut(accessToken: string): Promise<void> {
    await fetch(`${this.apiUrl}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        ...this.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  /**
   * Get current user
   */
  async getUser(
    accessToken: string
  ): Promise<{ id: string; email: string; user_metadata: Record<string, unknown> }> {
    const response = await fetch(`${this.apiUrl}/auth/v1/user`, {
      headers: {
        ...this.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase API error: ${response.status} ${error}`);
    }

    return (await response.json()) as {
      id: string;
      email: string;
      user_metadata: Record<string, unknown>;
    };
  }

  /**
   * Upload a file to storage
   */
  async uploadFile(options: SupabaseStorageUploadOptions): Promise<{ path: string; id: string }> {
    const formData = new FormData();
    formData.append('file', options.file);

    const headers: Record<string, string> = {
      apikey: this.headers.apikey,
      Authorization: this.headers.Authorization,
    };

    if (options.contentType) {
      headers['Content-Type'] = options.contentType;
    }
    if (options.cacheControl) {
      headers['Cache-Control'] = options.cacheControl;
    }

    const response = await fetch(
      `${this.apiUrl}/storage/v1/object/${options.bucket}/${options.path}${options.upsert ? '?upsert=true' : ''}`,
      {
        method: 'POST',
        headers,
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase Storage error: ${response.status} ${error}`);
    }

    return (await response.json()) as { path: string; id: string };
  }

  /**
   * Download a file from storage
   */
  async downloadFile(options: SupabaseStorageDownloadOptions): Promise<Buffer> {
    const response = await fetch(
      `${this.apiUrl}/storage/v1/object/${options.bucket}/${options.path}`,
      {
        headers: {
          apikey: this.headers.apikey,
          Authorization: this.headers.Authorization,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase Storage error: ${response.status} ${error}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(bucket: string, paths: string[]): Promise<{ data: { name: string }[] }> {
    return this.request('DELETE', `/storage/v1/object/${bucket}`, { prefixes: paths });
  }

  /**
   * List files in a bucket
   */
  async listFiles(
    bucket: string,
    path?: string,
    options?: { limit?: number; offset?: number; sortBy?: { column: string; order: string } }
  ): Promise<
    {
      name: string;
      id: string;
      created_at: string;
      updated_at: string;
      metadata: Record<string, unknown>;
    }[]
  > {
    const params = new URLSearchParams();
    if (path) params.append('prefix', path);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.sortBy) {
      params.append('sortBy', JSON.stringify(options.sortBy));
    }

    const response = await fetch(`${this.apiUrl}/storage/v1/object/list/${bucket}?${params}`, {
      headers: {
        apikey: this.headers.apikey,
        Authorization: this.headers.Authorization,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase Storage error: ${response.status} ${error}`);
    }

    return (await response.json()) as {
      name: string;
      id: string;
      created_at: string;
      updated_at: string;
      metadata: Record<string, unknown>;
    }[];
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(bucket: string, path: string): string {
    return `${this.apiUrl}/storage/v1/object/public/${bucket}/${path}`;
  }

  /**
   * Create a signed URL for a file
   */
  async createSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number
  ): Promise<{ signedUrl: string }> {
    return this.request('POST', `/storage/v1/object/sign/${bucket}/${path}`, {
      expiresIn,
    });
  }
}

/**
 * Table query builder
 */
export class SupabaseTableQuery<T> {
  constructor(
    private apiUrl: string,
    private headers: Record<string, string>,
    private table: string
  ) {}

  /**
   * Select data
   */
  async select(options: SupabaseQueryOptions = {}): Promise<T[]> {
    let url = `${this.apiUrl}/rest/v1/${this.table}`;
    const params: string[] = [];

    if (options.select) {
      params.push(`select=${options.select}`);
    }

    if (options.filter) {
      for (const f of options.filter) {
        params.push(`${f.column}=${f.operator}.${f.value}`);
      }
    }

    if (options.order) {
      for (const o of options.order) {
        params.push(`order=${o.column}.${o.ascending ? 'asc' : 'desc'}`);
      }
    }

    if (options.limit) {
      params.push(`limit=${options.limit}`);
    }

    if (options.offset) {
      params.push(`offset=${options.offset}`);
    }

    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    const headers = { ...this.headers };
    if (options.single) {
      headers.Accept = 'application/vnd.pgrst.object+json';
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    return options.single ? [data as T] : (data as T[]);
  }

  /**
   * Insert data
   */
  async insert(options: SupabaseInsertOptions<T>): Promise<T[]> {
    const response = await fetch(`${this.apiUrl}/rest/v1/${this.table}`, {
      method: 'POST',
      headers: {
        ...this.headers,
        Prefer: options.returning !== false ? 'return=representation' : 'return=minimal',
      },
      body: JSON.stringify(options.data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase API error: ${response.status} ${error}`);
    }

    if (options.returning === false) {
      return [];
    }

    return (await response.json()) as T[];
  }

  /**
   * Update data
   */
  async update(options: SupabaseUpdateOptions<T>): Promise<T[]> {
    let url = `${this.apiUrl}/rest/v1/${this.table}`;

    if (options.filter) {
      const params: string[] = [];
      for (const f of options.filter) {
        params.push(`${f.column}=${f.operator}.${f.value}`);
      }
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
    }

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        ...this.headers,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(options.data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase API error: ${response.status} ${error}`);
    }

    return (await response.json()) as T[];
  }

  /**
   * Delete data
   */
  async delete(options: SupabaseDeleteOptions): Promise<T[]> {
    let url = `${this.apiUrl}/rest/v1/${this.table}`;
    const params: string[] = [];

    for (const f of options.filter) {
      params.push(`${f.column}=${f.operator}.${f.value}`);
    }

    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...this.headers,
        Prefer: 'return=representation',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase API error: ${response.status} ${error}`);
    }

    return (await response.json()) as T[];
  }
}

export const SupabaseInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const supabaseUrl = config.auth?.['url'] as string | undefined;
    const supabaseKey = config.auth?.['key'] as string | undefined;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase SDK requires auth.url and auth.key');
    }

    const client = new SupabaseClient(supabaseUrl, supabaseKey);
    return {
      client,
      actions: client,
    };
  },
};
