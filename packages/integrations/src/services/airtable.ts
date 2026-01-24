/**
 * Airtable Integration
 *
 * Flexible database/spreadsheet platform.
 * API Docs: https://airtable.com/developers/web/api/introduction
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';

const AIRTABLE_API_URL = 'https://api.airtable.com/v0';

export interface AirtableRecord<T = Record<string, unknown>> {
  id: string;
  createdTime: string;
  fields: T;
}

export interface AirtableBase {
  id: string;
  name: string;
  permissionLevel: string;
}

export interface AirtableTable {
  id: string;
  name: string;
  primaryFieldId: string;
  fields: AirtableField[];
  views: { id: string; name: string; type: string }[];
}

export interface AirtableField {
  id: string;
  name: string;
  type: string;
  description?: string;
  options?: Record<string, unknown>;
}

export interface ListRecordsOptions {
  fields?: string[];
  filterByFormula?: string;
  maxRecords?: number;
  pageSize?: number;
  sort?: { field: string; direction?: 'asc' | 'desc' }[];
  view?: string;
  offset?: string;
  cellFormat?: 'json' | 'string';
  timeZone?: string;
  userLocale?: string;
}

export interface CreateRecordOptions<T = Record<string, unknown>> {
  fields: T;
  typecast?: boolean;
}

export interface UpdateRecordOptions<T = Record<string, unknown>> {
  fields: Partial<T>;
  typecast?: boolean;
}

export interface ListRecordsResult<T = Record<string, unknown>> {
  records: AirtableRecord<T>[];
  offset?: string;
}

/**
 * Airtable API client for workflow integration
 */
export class AirtableClient {
  constructor(
    private token: string,
    private baseId?: string
  ) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${AIRTABLE_API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Airtable API error: ${response.status} ${error}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  /**
   * Set the default base ID
   */
  setBase(baseId: string): void {
    this.baseId = baseId;
  }

  /**
   * List all bases the user has access to
   */
  async listBases(): Promise<AirtableBase[]> {
    const data = await this.request<{ bases: Array<Record<string, unknown>> }>('GET', '/meta/bases');
    return data.bases.map((b) => ({
      id: b.id as string,
      name: b.name as string,
      permissionLevel: b.permissionLevel as string,
    }));
  }

  /**
   * Get base schema (tables and fields)
   */
  async getBaseSchema(baseId?: string): Promise<AirtableTable[]> {
    const id = baseId ?? this.baseId;
    if (!id) throw new Error('Base ID is required');

    const data = await this.request<{ tables: Array<Record<string, unknown>> }>('GET', `/meta/bases/${id}/tables`);
    return data.tables.map((t) => ({
      id: t.id as string,
      name: t.name as string,
      primaryFieldId: t.primaryFieldId as string,
      fields: (t.fields as AirtableField[]) ?? [],
      views: (t.views as AirtableTable['views']) ?? [],
    }));
  }

  /**
   * List records from a table
   */
  async listRecords<T = Record<string, unknown>>(
    tableIdOrName: string,
    options: ListRecordsOptions = {},
    baseId?: string
  ): Promise<ListRecordsResult<T>> {
    const id = baseId ?? this.baseId;
    if (!id) throw new Error('Base ID is required');

    const params: string[] = [];
    if (options.fields) {
      options.fields.forEach((f) => params.push(`fields[]=${encodeURIComponent(f)}`));
    }
    if (options.filterByFormula) {
      params.push(`filterByFormula=${encodeURIComponent(options.filterByFormula)}`);
    }
    if (options.maxRecords) params.push(`maxRecords=${options.maxRecords}`);
    if (options.pageSize) params.push(`pageSize=${options.pageSize}`);
    if (options.sort) {
      options.sort.forEach((s, i) => {
        params.push(`sort[${i}][field]=${encodeURIComponent(s.field)}`);
        if (s.direction) params.push(`sort[${i}][direction]=${s.direction}`);
      });
    }
    if (options.view) params.push(`view=${encodeURIComponent(options.view)}`);
    if (options.offset) params.push(`offset=${options.offset}`);
    if (options.cellFormat) params.push(`cellFormat=${options.cellFormat}`);
    if (options.timeZone) params.push(`timeZone=${encodeURIComponent(options.timeZone)}`);
    if (options.userLocale) params.push(`userLocale=${encodeURIComponent(options.userLocale)}`);

    const query = params.length ? `?${params.join('&')}` : '';
    const encodedTable = encodeURIComponent(tableIdOrName);

    const data = await this.request<{ records: Array<Record<string, unknown>>; offset?: string }>(
      'GET',
      `/${id}/${encodedTable}${query}`
    );

    return {
      records: data.records.map((r) => ({
        id: r.id as string,
        createdTime: r.createdTime as string,
        fields: r.fields as T,
      })),
      offset: data.offset,
    };
  }

  /**
   * Get all records (handles pagination automatically)
   */
  async getAllRecords<T = Record<string, unknown>>(
    tableIdOrName: string,
    options: Omit<ListRecordsOptions, 'offset'> = {},
    baseId?: string
  ): Promise<AirtableRecord<T>[]> {
    const allRecords: AirtableRecord<T>[] = [];
    let offset: string | undefined;

    do {
      const result = await this.listRecords<T>(tableIdOrName, { ...options, offset }, baseId);
      allRecords.push(...result.records);
      offset = result.offset;
    } while (offset);

    return allRecords;
  }

  /**
   * Get a single record by ID
   */
  async getRecord<T = Record<string, unknown>>(
    tableIdOrName: string,
    recordId: string,
    baseId?: string
  ): Promise<AirtableRecord<T>> {
    const id = baseId ?? this.baseId;
    if (!id) throw new Error('Base ID is required');

    const encodedTable = encodeURIComponent(tableIdOrName);
    const data = await this.request<Record<string, unknown>>('GET', `/${id}/${encodedTable}/${recordId}`);

    return {
      id: data.id as string,
      createdTime: data.createdTime as string,
      fields: data.fields as T,
    };
  }

  /**
   * Create a single record
   */
  async createRecord<T = Record<string, unknown>>(
    tableIdOrName: string,
    options: CreateRecordOptions<T>,
    baseId?: string
  ): Promise<AirtableRecord<T>> {
    const id = baseId ?? this.baseId;
    if (!id) throw new Error('Base ID is required');

    const encodedTable = encodeURIComponent(tableIdOrName);
    const data = await this.request<Record<string, unknown>>('POST', `/${id}/${encodedTable}`, {
      fields: options.fields,
      typecast: options.typecast,
    });

    return {
      id: data.id as string,
      createdTime: data.createdTime as string,
      fields: data.fields as T,
    };
  }

  /**
   * Create multiple records (up to 10 at a time)
   */
  async createRecords<T = Record<string, unknown>>(
    tableIdOrName: string,
    records: CreateRecordOptions<T>[],
    baseId?: string
  ): Promise<AirtableRecord<T>[]> {
    const id = baseId ?? this.baseId;
    if (!id) throw new Error('Base ID is required');

    if (records.length > 10) {
      throw new Error('Airtable allows maximum 10 records per request');
    }

    const encodedTable = encodeURIComponent(tableIdOrName);
    const data = await this.request<{ records: Array<Record<string, unknown>> }>('POST', `/${id}/${encodedTable}`, {
      records: records.map((r) => ({
        fields: r.fields,
        typecast: r.typecast,
      })),
    });

    return data.records.map((r) => ({
      id: r.id as string,
      createdTime: r.createdTime as string,
      fields: r.fields as T,
    }));
  }

  /**
   * Update a single record
   */
  async updateRecord<T = Record<string, unknown>>(
    tableIdOrName: string,
    recordId: string,
    options: UpdateRecordOptions<T>,
    baseId?: string
  ): Promise<AirtableRecord<T>> {
    const id = baseId ?? this.baseId;
    if (!id) throw new Error('Base ID is required');

    const encodedTable = encodeURIComponent(tableIdOrName);
    const data = await this.request<Record<string, unknown>>('PATCH', `/${id}/${encodedTable}/${recordId}`, {
      fields: options.fields,
      typecast: options.typecast,
    });

    return {
      id: data.id as string,
      createdTime: data.createdTime as string,
      fields: data.fields as T,
    };
  }

  /**
   * Update multiple records (up to 10 at a time)
   */
  async updateRecords<T = Record<string, unknown>>(
    tableIdOrName: string,
    records: { id: string; fields: Partial<T>; typecast?: boolean }[],
    baseId?: string
  ): Promise<AirtableRecord<T>[]> {
    const id = baseId ?? this.baseId;
    if (!id) throw new Error('Base ID is required');

    if (records.length > 10) {
      throw new Error('Airtable allows maximum 10 records per request');
    }

    const encodedTable = encodeURIComponent(tableIdOrName);
    const data = await this.request<{ records: Array<Record<string, unknown>> }>('PATCH', `/${id}/${encodedTable}`, {
      records,
    });

    return data.records.map((r) => ({
      id: r.id as string,
      createdTime: r.createdTime as string,
      fields: r.fields as T,
    }));
  }

  /**
   * Replace a record (destructive update - clears unspecified fields)
   */
  async replaceRecord<T = Record<string, unknown>>(
    tableIdOrName: string,
    recordId: string,
    options: CreateRecordOptions<T>,
    baseId?: string
  ): Promise<AirtableRecord<T>> {
    const id = baseId ?? this.baseId;
    if (!id) throw new Error('Base ID is required');

    const encodedTable = encodeURIComponent(tableIdOrName);
    const data = await this.request<Record<string, unknown>>('PUT', `/${id}/${encodedTable}/${recordId}`, {
      fields: options.fields,
      typecast: options.typecast,
    });

    return {
      id: data.id as string,
      createdTime: data.createdTime as string,
      fields: data.fields as T,
    };
  }

  /**
   * Delete a single record
   */
  async deleteRecord(tableIdOrName: string, recordId: string, baseId?: string): Promise<{ id: string; deleted: boolean }> {
    const id = baseId ?? this.baseId;
    if (!id) throw new Error('Base ID is required');

    const encodedTable = encodeURIComponent(tableIdOrName);
    return this.request('DELETE', `/${id}/${encodedTable}/${recordId}`);
  }

  /**
   * Delete multiple records (up to 10 at a time)
   */
  async deleteRecords(
    tableIdOrName: string,
    recordIds: string[],
    baseId?: string
  ): Promise<{ records: { id: string; deleted: boolean }[] }> {
    const id = baseId ?? this.baseId;
    if (!id) throw new Error('Base ID is required');

    if (recordIds.length > 10) {
      throw new Error('Airtable allows maximum 10 records per request');
    }

    const encodedTable = encodeURIComponent(tableIdOrName);
    const params = recordIds.map((rid) => `records[]=${rid}`).join('&');
    return this.request('DELETE', `/${id}/${encodedTable}?${params}`);
  }

  /**
   * Find records matching a formula
   */
  async findRecords<T = Record<string, unknown>>(
    tableIdOrName: string,
    formula: string,
    options: Omit<ListRecordsOptions, 'filterByFormula'> = {},
    baseId?: string
  ): Promise<AirtableRecord<T>[]> {
    return this.getAllRecords<T>(tableIdOrName, { ...options, filterByFormula: formula }, baseId);
  }

  /**
   * Find a single record by field value
   */
  async findOne<T = Record<string, unknown>>(
    tableIdOrName: string,
    fieldName: string,
    value: string | number,
    baseId?: string
  ): Promise<AirtableRecord<T> | null> {
    const formula = typeof value === 'string' ? `{${fieldName}} = "${value}"` : `{${fieldName}} = ${value}`;

    const result = await this.listRecords<T>(tableIdOrName, { filterByFormula: formula, maxRecords: 1 }, baseId);

    return result.records[0] ?? null;
  }
}

export const AirtableInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const token = config.auth?.['token'] as string | undefined;
    const baseId = config.options?.['base_id'] as string | undefined;

    if (!token) {
      throw new Error('Airtable SDK requires auth.token (personal access token)');
    }

    const client = new AirtableClient(token, baseId);
    return {
      client,
      actions: client,
    };
  },
};
