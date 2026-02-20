import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleSheetsInitializer, GoogleSheetsActions } from '../src/services/google-sheets.js';

describe('Google Sheets Integration', () => {
  describe('GoogleSheetsInitializer', () => {
    it('should throw if required auth fields missing', async () => {
      const config = { sdk: 'google-sheets', auth: {} };
      await expect(GoogleSheetsInitializer.initialize({}, config as any)).rejects.toThrow(
        'auth.client_id'
      );
    });

    it('should throw if client_secret missing', async () => {
      const config = {
        sdk: 'google-sheets',
        auth: { client_id: 'id' },
      };
      await expect(GoogleSheetsInitializer.initialize({}, config as any)).rejects.toThrow(
        'auth.client_secret'
      );
    });

    it('should throw if redirect_uri missing', async () => {
      const config = {
        sdk: 'google-sheets',
        auth: { client_id: 'id', client_secret: 'secret' },
      };
      await expect(GoogleSheetsInitializer.initialize({}, config as any)).rejects.toThrow(
        'auth.redirect_uri'
      );
    });

    it('should initialize sheets client with oauth config', async () => {
      const config = {
        sdk: 'google-sheets',
        auth: {
          client_id: 'id',
          client_secret: 'secret',
          redirect_uri: 'http://localhost',
          refresh_token: 'refresh',
        },
      };

      const result = await GoogleSheetsInitializer.initialize({}, config as any);
      expect(result).toBeTruthy();
      expect(typeof (result as any).client).toBe('object');
      expect((result as any).actions).toBeInstanceOf(GoogleSheetsActions);
    });

    it('should return client with spreadsheets property', async () => {
      const config = {
        sdk: 'google-sheets',
        auth: {
          client_id: 'id',
          client_secret: 'secret',
          redirect_uri: 'http://localhost',
        },
      };

      const result = await GoogleSheetsInitializer.initialize({}, config as any);
      expect(typeof (result as any).client.spreadsheets).toBe('object');
    });
  });

  describe('GoogleSheetsActions', () => {
    let mockSheets: any;
    let actions: GoogleSheetsActions;

    beforeEach(() => {
      mockSheets = {
        spreadsheets: {
          get: vi.fn(),
          create: vi.fn(),
          batchUpdate: vi.fn(),
          values: {
            get: vi.fn(),
            batchGet: vi.fn(),
            append: vi.fn(),
            update: vi.fn(),
            batchUpdate: vi.fn(),
            clear: vi.fn(),
          },
        },
      };
      actions = new GoogleSheetsActions(mockSheets);
    });

    it('should have all required methods', () => {
      expect(typeof actions.getSpreadsheet).toBe('function');
      expect(typeof actions.getValues).toBe('function');
      expect(typeof actions.batchGetValues).toBe('function');
      expect(typeof actions.appendValues).toBe('function');
      expect(typeof actions.updateValues).toBe('function');
      expect(typeof actions.batchUpdateValues).toBe('function');
      expect(typeof actions.clearValues).toBe('function');
      expect(typeof actions.createSpreadsheet).toBe('function');
      expect(typeof actions.addSheet).toBe('function');
      expect(typeof actions.deleteSheet).toBe('function');
      expect(typeof actions.duplicateSheet).toBe('function');
      expect(typeof actions.findReplace).toBe('function');
      expect(typeof actions.sortRange).toBe('function');
    });

    it('should get spreadsheet metadata', async () => {
      mockSheets.spreadsheets.get.mockResolvedValue({
        data: {
          spreadsheetId: 'sheet-123',
          properties: {
            title: 'Test Sheet',
            locale: 'en_US',
            autoRecalc: 'ON_CHANGE',
            timeZone: 'America/New_York',
          },
          sheets: [
            {
              properties: {
                sheetId: 0,
                title: 'Sheet1',
                index: 0,
                sheetType: 'GRID',
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 26,
                },
              },
            },
          ],
        },
      });

      const result = await actions.getSpreadsheet('sheet-123');
      expect(result.spreadsheetId).toBe('sheet-123');
      expect(result.properties.title).toBe('Test Sheet');
      expect(result.sheets).toHaveLength(1);
      expect(result.sheets[0].title).toBe('Sheet1');
    });

    it('should get values from a range', async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [
            ['Name', 'Age'],
            ['Alice', '30'],
            ['Bob', '25'],
          ],
        },
      });

      const result = await actions.getValues('sheet-123', 'Sheet1!A1:B3');
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(['Name', 'Age']);
      expect(result[1]).toEqual(['Alice', '30']);
    });

    it('should append values to a sheet', async () => {
      mockSheets.spreadsheets.values.append.mockResolvedValue({
        data: {
          updates: {
            updatedRange: 'Sheet1!A4:B4',
            updatedRows: 1,
            updatedColumns: 2,
          },
        },
      });

      const result = await actions.appendValues('sheet-123', {
        range: 'Sheet1!A1:B1',
        values: [['Charlie', '35']],
      });

      expect(result.updatedRows).toBe(1);
      expect(result.updatedColumns).toBe(2);
      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith({
        spreadsheetId: 'sheet-123',
        range: 'Sheet1!A1:B1',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [['Charlie', '35']],
        },
      });
    });

    it('should update values in a range', async () => {
      mockSheets.spreadsheets.values.update.mockResolvedValue({
        data: {
          updatedRange: 'Sheet1!A1:B2',
          updatedRows: 2,
          updatedColumns: 2,
          updatedCells: 4,
        },
      });

      const result = await actions.updateValues('sheet-123', {
        range: 'Sheet1!A1:B2',
        values: [
          ['Header1', 'Header2'],
          ['Value1', 'Value2'],
        ],
      });

      expect(result.updatedCells).toBe(4);
      expect(result.updatedRows).toBe(2);
    });

    it('should clear values in a range', async () => {
      mockSheets.spreadsheets.values.clear.mockResolvedValue({
        data: {
          clearedRange: 'Sheet1!A1:B10',
        },
      });

      const result = await actions.clearValues('sheet-123', 'Sheet1!A1:B10');
      expect(result.clearedRange).toBe('Sheet1!A1:B10');
    });

    it('should create a new spreadsheet', async () => {
      mockSheets.spreadsheets.create.mockResolvedValue({
        data: {
          spreadsheetId: 'new-sheet-123',
          properties: {
            title: 'New Spreadsheet',
            locale: 'en_US',
          },
          sheets: [
            {
              properties: {
                sheetId: 0,
                title: 'Sheet1',
                index: 0,
                sheetType: 'GRID',
                gridProperties: { rowCount: 1000, columnCount: 26 },
              },
            },
          ],
        },
      });

      const result = await actions.createSpreadsheet({
        title: 'New Spreadsheet',
      });

      expect(result.spreadsheetId).toBe('new-sheet-123');
      expect(result.properties.title).toBe('New Spreadsheet');
    });

    it('should add a new sheet', async () => {
      mockSheets.spreadsheets.batchUpdate.mockResolvedValue({
        data: {
          replies: [
            {
              addSheet: {
                properties: {
                  sheetId: 1,
                  title: 'Sheet2',
                  index: 1,
                  sheetType: 'GRID',
                  gridProperties: { rowCount: 1000, columnCount: 26 },
                },
              },
            },
          ],
        },
      });

      const result = await actions.addSheet('sheet-123', {
        title: 'Sheet2',
        rowCount: 1000,
        columnCount: 26,
      });

      expect(result.sheetId).toBe(1);
      expect(result.title).toBe('Sheet2');
    });

    it('should delete a sheet', async () => {
      mockSheets.spreadsheets.batchUpdate.mockResolvedValue({ data: {} });

      await actions.deleteSheet('sheet-123', 1);

      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'sheet-123',
        requestBody: {
          requests: [{ deleteSheet: { sheetId: 1 } }],
        },
      });
    });

    it('should find and replace text', async () => {
      mockSheets.spreadsheets.batchUpdate.mockResolvedValue({
        data: {
          replies: [
            {
              findReplace: {
                occurrencesChanged: 3,
                valuesChanged: 3,
              },
            },
          ],
        },
      });

      const result = await actions.findReplace('sheet-123', 'old', 'new', {
        sheetId: 0,
        matchCase: true,
      });

      expect(result.occurrencesChanged).toBe(3);
      expect(result.valuesChanged).toBe(3);
    });

    // ── sortRange / parseA1Notation ───────────────────────────────────────────

    describe('sortRange() and parseA1Notation()', () => {
      beforeEach(() => {
        mockSheets.spreadsheets.batchUpdate.mockResolvedValue({ data: { replies: [] } });
      });

      it('parses plain A1 notation (A1:D100) correctly', async () => {
        await actions.sortRange('sheet-123', 'A1:D100', [{ dimensionIndex: 0, sortOrder: 'ASCENDING' }]);

        const call = mockSheets.spreadsheets.batchUpdate.mock.calls[0][0];
        const gridRange = call.requestBody.requests[0].sortRange.range;
        expect(gridRange.startRowIndex).toBe(0);
        expect(gridRange.endRowIndex).toBe(100);
        expect(gridRange.startColumnIndex).toBe(0); // A
        expect(gridRange.endColumnIndex).toBe(4);   // D (0-based inclusive → exclusive +1)
        expect(gridRange.sheetId).toBe(0);
      });

      it('strips sheet-name prefix (Sheet1!A1:D100) before parsing', async () => {
        await actions.sortRange('sheet-123', 'Sheet1!A1:D100', [{ dimensionIndex: 0, sortOrder: 'ASCENDING' }]);

        const call = mockSheets.spreadsheets.batchUpdate.mock.calls[0][0];
        const gridRange = call.requestBody.requests[0].sortRange.range;
        // Should parse correctly — this was the failing case before the fix
        expect(gridRange.startRowIndex).toBe(0);
        expect(gridRange.endRowIndex).toBe(100);
        expect(gridRange.startColumnIndex).toBe(0);
        expect(gridRange.endColumnIndex).toBe(4);
      });

      it('strips quoted sheet-name prefix ("My Sheet"!B2:E50)', async () => {
        await actions.sortRange('sheet-123', "'My Sheet'!B2:E50", [{ dimensionIndex: 0, sortOrder: 'DESCENDING' }]);

        const call = mockSheets.spreadsheets.batchUpdate.mock.calls[0][0];
        const gridRange = call.requestBody.requests[0].sortRange.range;
        expect(gridRange.startRowIndex).toBe(1);  // row 2 → index 1
        expect(gridRange.endRowIndex).toBe(50);
        expect(gridRange.startColumnIndex).toBe(1); // B
        expect(gridRange.endColumnIndex).toBe(5);   // E
      });

      it('uses the provided sheetId in the GridRange', async () => {
        await actions.sortRange('sheet-123', 'A1:B10', [{ dimensionIndex: 0, sortOrder: 'ASCENDING' }], 3);

        const call = mockSheets.spreadsheets.batchUpdate.mock.calls[0][0];
        const gridRange = call.requestBody.requests[0].sortRange.range;
        expect(gridRange.sheetId).toBe(3);
      });

      it('defaults sheetId to 0 when not provided', async () => {
        await actions.sortRange('sheet-123', 'A1:B10', [{ dimensionIndex: 0, sortOrder: 'ASCENDING' }]);

        const call = mockSheets.spreadsheets.batchUpdate.mock.calls[0][0];
        expect(call.requestBody.requests[0].sortRange.range.sheetId).toBe(0);
      });

      it('throws a descriptive error for completely invalid range strings', async () => {
        await expect(
          actions.sortRange('sheet-123', 'NOT_A_RANGE', [{ dimensionIndex: 0, sortOrder: 'ASCENDING' }])
        ).rejects.toThrow(/Invalid range format/);
      });

      it('includes correct sortSpecs in the request', async () => {
        const specs = [
          { dimensionIndex: 2, sortOrder: 'DESCENDING' as const },
          { dimensionIndex: 0, sortOrder: 'ASCENDING' as const },
        ];
        await actions.sortRange('sheet-123', 'A1:C10', specs);

        const call = mockSheets.spreadsheets.batchUpdate.mock.calls[0][0];
        expect(call.requestBody.requests[0].sortRange.sortSpecs).toEqual(specs);
      });
    });
  });
});
