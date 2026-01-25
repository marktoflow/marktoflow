/**
 * Google Sheets Integration
 *
 * Spreadsheet automation platform.
 * API Docs: https://developers.google.com/sheets/api
 */

import { google, sheets_v4 } from 'googleapis';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export interface SpreadsheetInfo {
  spreadsheetId: string;
  properties: {
    title: string;
    locale: string;
    autoRecalc: string;
    timeZone: string;
  };
  sheets: SheetInfo[];
}

export interface SheetInfo {
  sheetId: number;
  title: string;
  index: number;
  sheetType: string;
  gridProperties: {
    rowCount: number;
    columnCount: number;
  };
}

export interface CellData {
  row: number;
  column: number;
  value: string | number | boolean | null;
  formattedValue?: string;
  formula?: string;
}

export interface AppendValuesOptions {
  range: string;
  values: unknown[][];
  valueInputOption?: 'RAW' | 'USER_ENTERED';
  insertDataOption?: 'OVERWRITE' | 'INSERT_ROWS';
}

export interface UpdateValuesOptions {
  range: string;
  values: unknown[][];
  valueInputOption?: 'RAW' | 'USER_ENTERED';
}

export interface BatchUpdateOptions {
  data: {
    range: string;
    values: unknown[][];
  }[];
  valueInputOption?: 'RAW' | 'USER_ENTERED';
}

export interface CreateSpreadsheetOptions {
  title: string;
  sheets?: {
    title: string;
    rowCount?: number;
    columnCount?: number;
  }[];
  locale?: string;
  timeZone?: string;
}

export interface AddSheetOptions {
  title: string;
  rowCount?: number;
  columnCount?: number;
  index?: number;
}

/**
 * Google Sheets actions for workflow integration
 */
export class GoogleSheetsActions {
  constructor(private sheets: sheets_v4.Sheets) {}

  /**
   * Get spreadsheet metadata
   */
  async getSpreadsheet(spreadsheetId: string): Promise<SpreadsheetInfo> {
    const response = await this.sheets.spreadsheets.get({
      spreadsheetId,
    });

    const data = response.data;
    return {
      spreadsheetId: data.spreadsheetId ?? spreadsheetId,
      properties: {
        title: data.properties?.title ?? '',
        locale: data.properties?.locale ?? '',
        autoRecalc: data.properties?.autoRecalc ?? '',
        timeZone: data.properties?.timeZone ?? '',
      },
      sheets:
        data.sheets?.map((sheet) => ({
          sheetId: sheet.properties?.sheetId ?? 0,
          title: sheet.properties?.title ?? '',
          index: sheet.properties?.index ?? 0,
          sheetType: sheet.properties?.sheetType ?? '',
          gridProperties: {
            rowCount: sheet.properties?.gridProperties?.rowCount ?? 0,
            columnCount: sheet.properties?.gridProperties?.columnCount ?? 0,
          },
        })) ?? [],
    };
  }

  /**
   * Get values from a range
   */
  async getValues(spreadsheetId: string, range: string): Promise<unknown[][]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return (response.data.values as unknown[][]) ?? [];
  }

  /**
   * Get multiple ranges at once
   */
  async batchGetValues(
    spreadsheetId: string,
    ranges: string[]
  ): Promise<{ range: string; values: unknown[][] }[]> {
    const response = await this.sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges,
    });

    return (
      response.data.valueRanges?.map((vr) => ({
        range: vr.range ?? '',
        values: (vr.values as unknown[][]) ?? [],
      })) ?? []
    );
  }

  /**
   * Append values to a sheet
   */
  async appendValues(
    spreadsheetId: string,
    options: AppendValuesOptions
  ): Promise<{ updatedRange: string; updatedRows: number; updatedColumns: number }> {
    const response = await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: options.range,
      valueInputOption: options.valueInputOption ?? 'USER_ENTERED',
      insertDataOption: options.insertDataOption ?? 'INSERT_ROWS',
      requestBody: {
        values: options.values,
      },
    });

    return {
      updatedRange: response.data.updates?.updatedRange ?? '',
      updatedRows: response.data.updates?.updatedRows ?? 0,
      updatedColumns: response.data.updates?.updatedColumns ?? 0,
    };
  }

  /**
   * Update values in a range
   */
  async updateValues(
    spreadsheetId: string,
    options: UpdateValuesOptions
  ): Promise<{
    updatedRange: string;
    updatedRows: number;
    updatedColumns: number;
    updatedCells: number;
  }> {
    const response = await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: options.range,
      valueInputOption: options.valueInputOption ?? 'USER_ENTERED',
      requestBody: {
        values: options.values,
      },
    });

    return {
      updatedRange: response.data.updatedRange ?? '',
      updatedRows: response.data.updatedRows ?? 0,
      updatedColumns: response.data.updatedColumns ?? 0,
      updatedCells: response.data.updatedCells ?? 0,
    };
  }

  /**
   * Update multiple ranges at once
   */
  async batchUpdateValues(
    spreadsheetId: string,
    options: BatchUpdateOptions
  ): Promise<{ totalUpdatedRows: number; totalUpdatedColumns: number; totalUpdatedCells: number }> {
    const response = await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: options.valueInputOption ?? 'USER_ENTERED',
        data: options.data,
      },
    });

    return {
      totalUpdatedRows: response.data.totalUpdatedRows ?? 0,
      totalUpdatedColumns: response.data.totalUpdatedColumns ?? 0,
      totalUpdatedCells: response.data.totalUpdatedCells ?? 0,
    };
  }

  /**
   * Clear values in a range
   */
  async clearValues(spreadsheetId: string, range: string): Promise<{ clearedRange: string }> {
    const response = await this.sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
    });

    return {
      clearedRange: response.data.clearedRange ?? '',
    };
  }

  /**
   * Create a new spreadsheet
   */
  async createSpreadsheet(options: CreateSpreadsheetOptions): Promise<SpreadsheetInfo> {
    const response = await this.sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: options.title,
          locale: options.locale,
          timeZone: options.timeZone,
        },
        sheets: options.sheets?.map((sheet) => ({
          properties: {
            title: sheet.title,
            gridProperties: {
              rowCount: sheet.rowCount ?? 1000,
              columnCount: sheet.columnCount ?? 26,
            },
          },
        })),
      },
    });

    const data = response.data;
    return {
      spreadsheetId: data.spreadsheetId ?? '',
      properties: {
        title: data.properties?.title ?? '',
        locale: data.properties?.locale ?? '',
        autoRecalc: data.properties?.autoRecalc ?? '',
        timeZone: data.properties?.timeZone ?? '',
      },
      sheets:
        data.sheets?.map((sheet) => ({
          sheetId: sheet.properties?.sheetId ?? 0,
          title: sheet.properties?.title ?? '',
          index: sheet.properties?.index ?? 0,
          sheetType: sheet.properties?.sheetType ?? '',
          gridProperties: {
            rowCount: sheet.properties?.gridProperties?.rowCount ?? 0,
            columnCount: sheet.properties?.gridProperties?.columnCount ?? 0,
          },
        })) ?? [],
    };
  }

  /**
   * Add a new sheet to an existing spreadsheet
   */
  async addSheet(spreadsheetId: string, options: AddSheetOptions): Promise<SheetInfo> {
    const response = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: options.title,
                index: options.index,
                gridProperties: {
                  rowCount: options.rowCount ?? 1000,
                  columnCount: options.columnCount ?? 26,
                },
              },
            },
          },
        ],
      },
    });

    const addedSheet = response.data.replies?.[0]?.addSheet?.properties;
    return {
      sheetId: addedSheet?.sheetId ?? 0,
      title: addedSheet?.title ?? '',
      index: addedSheet?.index ?? 0,
      sheetType: addedSheet?.sheetType ?? '',
      gridProperties: {
        rowCount: addedSheet?.gridProperties?.rowCount ?? 0,
        columnCount: addedSheet?.gridProperties?.columnCount ?? 0,
      },
    };
  }

  /**
   * Delete a sheet
   */
  async deleteSheet(spreadsheetId: string, sheetId: number): Promise<void> {
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteSheet: {
              sheetId,
            },
          },
        ],
      },
    });
  }

  /**
   * Duplicate a sheet
   */
  async duplicateSheet(
    spreadsheetId: string,
    sourceSheetId: number,
    newSheetName?: string
  ): Promise<SheetInfo> {
    const response = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            duplicateSheet: {
              sourceSheetId,
              newSheetName,
            },
          },
        ],
      },
    });

    const duplicatedSheet = response.data.replies?.[0]?.duplicateSheet?.properties;
    return {
      sheetId: duplicatedSheet?.sheetId ?? 0,
      title: duplicatedSheet?.title ?? '',
      index: duplicatedSheet?.index ?? 0,
      sheetType: duplicatedSheet?.sheetType ?? '',
      gridProperties: {
        rowCount: duplicatedSheet?.gridProperties?.rowCount ?? 0,
        columnCount: duplicatedSheet?.gridProperties?.columnCount ?? 0,
      },
    };
  }

  /**
   * Find and replace text
   */
  async findReplace(
    spreadsheetId: string,
    find: string,
    replacement: string,
    options?: {
      sheetId?: number;
      allSheets?: boolean;
      matchCase?: boolean;
      matchEntireCell?: boolean;
      searchByRegex?: boolean;
    }
  ): Promise<{ occurrencesChanged: number; valuesChanged: number }> {
    const response = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            findReplace: {
              find,
              replacement,
              sheetId: options?.sheetId,
              allSheets: options?.allSheets ?? false,
              matchCase: options?.matchCase ?? false,
              matchEntireCell: options?.matchEntireCell ?? false,
              searchByRegex: options?.searchByRegex ?? false,
            },
          },
        ],
      },
    });

    const result = response.data.replies?.[0]?.findReplace;
    return {
      occurrencesChanged: result?.occurrencesChanged ?? 0,
      valuesChanged: result?.valuesChanged ?? 0,
    };
  }

  /**
   * Sort a range
   */
  async sortRange(
    spreadsheetId: string,
    range: string,
    sortSpecs: { dimensionIndex: number; sortOrder: 'ASCENDING' | 'DESCENDING' }[]
  ): Promise<void> {
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            sortRange: {
              range: this.parseA1Notation(range),
              sortSpecs,
            },
          },
        ],
      },
    });
  }

  /**
   * Parse A1 notation into grid range
   * Helper method for internal use
   */
  private parseA1Notation(range: string): sheets_v4.Schema$GridRange {
    // This is a simplified parser - production code should handle more cases
    const match = range.match(/^([A-Za-z]+)(\d+):([A-Za-z]+)(\d+)$/);
    if (!match) {
      throw new Error(`Invalid range format: ${range}`);
    }

    const [, startCol, startRow, endCol, endRow] = match;

    const columnToIndex = (col: string): number => {
      let index = 0;
      for (let i = 0; i < col.length; i++) {
        index = index * 26 + col.charCodeAt(i) - 'A'.charCodeAt(0) + 1;
      }
      return index - 1;
    };

    return {
      startRowIndex: parseInt(startRow) - 1,
      endRowIndex: parseInt(endRow),
      startColumnIndex: columnToIndex(startCol.toUpperCase()),
      endColumnIndex: columnToIndex(endCol.toUpperCase()) + 1,
    };
  }
}

export const GoogleSheetsInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const clientId = config.auth?.['client_id'] as string | undefined;
    const clientSecret = config.auth?.['client_secret'] as string | undefined;
    const redirectUri = config.auth?.['redirect_uri'] as string | undefined;
    const refreshToken = config.auth?.['refresh_token'] as string | undefined;
    const accessToken = config.auth?.['access_token'] as string | undefined;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(
        'Google Sheets SDK requires auth.client_id, auth.client_secret, auth.redirect_uri'
      );
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
      access_token: accessToken,
    });

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    return {
      client: sheets,
      actions: new GoogleSheetsActions(sheets),
    };
  },
};
