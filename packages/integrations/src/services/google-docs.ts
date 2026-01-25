/**
 * Google Docs Integration
 *
 * Document creation and editing platform.
 * API Docs: https://developers.google.com/docs/api
 */

import { google, docs_v1 } from 'googleapis';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export interface Document {
  documentId: string;
  title: string;
  body?: DocumentBody;
  revisionId?: string;
  suggestionsViewMode?: string;
}

export interface DocumentBody {
  content: StructuralElement[];
}

export interface StructuralElement {
  startIndex?: number;
  endIndex?: number;
  paragraph?: Paragraph;
  table?: Table;
  sectionBreak?: unknown;
}

export interface Paragraph {
  elements: ParagraphElement[];
  paragraphStyle?: ParagraphStyle;
}

export interface ParagraphElement {
  startIndex?: number;
  endIndex?: number;
  textRun?: TextRun;
}

export interface TextRun {
  content: string;
  textStyle?: TextStyle;
}

export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: { magnitude: number; unit: string };
  foregroundColor?: Color;
  backgroundColor?: Color;
  link?: { url: string };
}

export interface ParagraphStyle {
  headingId?: string;
  namedStyleType?: string;
  alignment?: string;
  lineSpacing?: number;
  direction?: string;
  spacingMode?: string;
  spaceAbove?: { magnitude: number; unit: string };
  spaceBelow?: { magnitude: number; unit: string };
  indentFirstLine?: { magnitude: number; unit: string };
  indentStart?: { magnitude: number; unit: string };
  indentEnd?: { magnitude: number; unit: string };
}

export interface Color {
  rgbColor?: { red: number; green: number; blue: number };
}

export interface Table {
  rows: number;
  columns: number;
  tableRows: TableRow[];
}

export interface TableRow {
  tableCells: TableCell[];
}

export interface TableCell {
  content: StructuralElement[];
}

export interface CreateDocumentOptions {
  title: string;
}

export interface InsertTextOptions {
  text: string;
  index?: number;
}

export interface DeleteContentOptions {
  startIndex: number;
  endIndex: number;
}

export interface FormatTextOptions {
  startIndex: number;
  endIndex: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  foregroundColor?: { red: number; green: number; blue: number };
}

export interface InsertTableOptions {
  rows: number;
  columns: number;
  index?: number;
}

/**
 * Google Docs actions for workflow integration
 */
export class GoogleDocsActions {
  constructor(private docs: docs_v1.Docs) {}

  /**
   * Get a document by ID
   */
  async getDocument(documentId: string): Promise<Document> {
    const response = await this.docs.documents.get({
      documentId,
    });

    return {
      documentId: response.data.documentId ?? '',
      title: response.data.title ?? '',
      body: response.data.body as DocumentBody | undefined,
      revisionId: response.data.revisionId ?? undefined,
      suggestionsViewMode: response.data.suggestionsViewMode ?? undefined,
    };
  }

  /**
   * Create a new document
   */
  async createDocument(options: CreateDocumentOptions): Promise<Document> {
    const response = await this.docs.documents.create({
      requestBody: {
        title: options.title,
      },
    });

    return {
      documentId: response.data.documentId ?? '',
      title: response.data.title ?? '',
      revisionId: response.data.revisionId ?? undefined,
    };
  }

  /**
   * Get document text content
   */
  async getDocumentText(documentId: string): Promise<string> {
    const doc = await this.getDocument(documentId);
    const content = doc.body?.content ?? [];

    let text = '';
    for (const element of content) {
      if (element.paragraph) {
        for (const elem of element.paragraph.elements) {
          if (elem.textRun) {
            text += elem.textRun.content;
          }
        }
      }
    }
    return text;
  }

  /**
   * Insert text into a document
   */
  async insertText(documentId: string, options: InsertTextOptions): Promise<void> {
    await this.batchUpdate(documentId, [
      {
        insertText: {
          text: options.text,
          location: {
            index: options.index ?? 1,
          },
        },
      },
    ]);
  }

  /**
   * Append text to the end of a document
   */
  async appendText(documentId: string, text: string): Promise<void> {
    const doc = await this.getDocument(documentId);
    const endIndex = doc.body?.content?.[doc.body.content.length - 1]?.endIndex ?? 1;

    await this.insertText(documentId, {
      text,
      index: endIndex - 1,
    });
  }

  /**
   * Delete content from a document
   */
  async deleteContent(documentId: string, options: DeleteContentOptions): Promise<void> {
    await this.batchUpdate(documentId, [
      {
        deleteContentRange: {
          range: {
            startIndex: options.startIndex,
            endIndex: options.endIndex,
          },
        },
      },
    ]);
  }

  /**
   * Replace all occurrences of text
   */
  async replaceAllText(
    documentId: string,
    find: string,
    replace: string,
    matchCase = false
  ): Promise<number> {
    const response = await this.batchUpdate(documentId, [
      {
        replaceAllText: {
          containsText: {
            text: find,
            matchCase,
          },
          replaceText: replace,
        },
      },
    ]);

    return response.replies?.[0]?.replaceAllText?.occurrencesChanged ?? 0;
  }

  /**
   * Format text
   */
  async formatText(documentId: string, options: FormatTextOptions): Promise<void> {
    const fields: string[] = [];
    const textStyle: docs_v1.Schema$TextStyle = {};

    if (options.bold !== undefined) {
      textStyle.bold = options.bold;
      fields.push('bold');
    }
    if (options.italic !== undefined) {
      textStyle.italic = options.italic;
      fields.push('italic');
    }
    if (options.underline !== undefined) {
      textStyle.underline = options.underline;
      fields.push('underline');
    }
    if (options.fontSize !== undefined) {
      textStyle.fontSize = { magnitude: options.fontSize, unit: 'PT' };
      fields.push('fontSize');
    }
    if (options.foregroundColor !== undefined) {
      textStyle.foregroundColor = {
        color: {
          rgbColor: options.foregroundColor,
        },
      };
      fields.push('foregroundColor');
    }

    await this.batchUpdate(documentId, [
      {
        updateTextStyle: {
          range: {
            startIndex: options.startIndex,
            endIndex: options.endIndex,
          },
          textStyle,
          fields: fields.join(','),
        },
      },
    ]);
  }

  /**
   * Insert a table
   */
  async insertTable(documentId: string, options: InsertTableOptions): Promise<void> {
    await this.batchUpdate(documentId, [
      {
        insertTable: {
          rows: options.rows,
          columns: options.columns,
          location: {
            index: options.index ?? 1,
          },
        },
      },
    ]);
  }

  /**
   * Insert a page break
   */
  async insertPageBreak(documentId: string, index?: number): Promise<void> {
    await this.batchUpdate(documentId, [
      {
        insertPageBreak: {
          location: {
            index: index ?? 1,
          },
        },
      },
    ]);
  }

  /**
   * Create a named range
   */
  async createNamedRange(
    documentId: string,
    name: string,
    startIndex: number,
    endIndex: number
  ): Promise<string> {
    const response = await this.batchUpdate(documentId, [
      {
        createNamedRange: {
          name,
          range: {
            startIndex,
            endIndex,
          },
        },
      },
    ]);

    return response.replies?.[0]?.createNamedRange?.namedRangeId ?? '';
  }

  /**
   * Update paragraph style
   */
  async updateParagraphStyle(
    documentId: string,
    startIndex: number,
    endIndex: number,
    style: {
      headingId?: string;
      namedStyleType?: string;
      alignment?: 'ALIGNMENT_UNSPECIFIED' | 'START' | 'CENTER' | 'END' | 'JUSTIFIED';
    }
  ): Promise<void> {
    const fields: string[] = [];
    const paragraphStyle: docs_v1.Schema$ParagraphStyle = {};

    if (style.headingId !== undefined) {
      paragraphStyle.headingId = style.headingId;
      fields.push('headingId');
    }
    if (style.namedStyleType !== undefined) {
      paragraphStyle.namedStyleType = style.namedStyleType;
      fields.push('namedStyleType');
    }
    if (style.alignment !== undefined) {
      paragraphStyle.alignment = style.alignment;
      fields.push('alignment');
    }

    await this.batchUpdate(documentId, [
      {
        updateParagraphStyle: {
          range: {
            startIndex,
            endIndex,
          },
          paragraphStyle,
          fields: fields.join(','),
        },
      },
    ]);
  }

  /**
   * Insert inline image
   */
  async insertImage(documentId: string, imageUri: string, index?: number): Promise<void> {
    await this.batchUpdate(documentId, [
      {
        insertInlineImage: {
          uri: imageUri,
          location: {
            index: index ?? 1,
          },
        },
      },
    ]);
  }

  /**
   * Batch update operations
   */
  async batchUpdate(
    documentId: string,
    requests: docs_v1.Schema$Request[]
  ): Promise<docs_v1.Schema$BatchUpdateDocumentResponse> {
    const response = await this.docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests,
      },
    });

    return response.data;
  }
}

export const GoogleDocsInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const clientId = config.auth?.['client_id'] as string | undefined;
    const clientSecret = config.auth?.['client_secret'] as string | undefined;
    const redirectUri = config.auth?.['redirect_uri'] as string | undefined;
    const refreshToken = config.auth?.['refresh_token'] as string | undefined;
    const accessToken = config.auth?.['access_token'] as string | undefined;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(
        'Google Docs SDK requires auth.client_id, auth.client_secret, auth.redirect_uri'
      );
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
      access_token: accessToken,
    });

    const docs = google.docs({ version: 'v1', auth: oauth2Client });
    return {
      client: docs,
      actions: new GoogleDocsActions(docs),
    };
  },
};
