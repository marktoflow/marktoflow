/**
 * File Operations for marktoflow
 *
 * Provides file read/write operations for workflows:
 * - file.read: Read files with automatic format conversion
 *   - Text files: raw content
 *   - MS Word (.docx): convert to markdown
 *   - PDF: convert to markdown
 *   - Excel (.xlsx): convert to CSV
 * - file.write: Write files (text or binary)
 */

import { promises as fs } from 'node:fs';
import { extname, resolve, dirname } from 'node:path';
import { ExecutionContext } from './models.js';
import { resolveTemplates } from './engine/variable-resolution.js';

// ============================================================================
// Types
// ============================================================================

export interface FileReadInputs {
  path: string;
  encoding?: BufferEncoding;
}

export interface FileWriteInputs {
  path: string;
  data: string | Buffer;
  encoding?: BufferEncoding;
  createDirectory?: boolean;
}

export interface FileReadResult {
  content: string;
  path: string;
  size: number;
  originalFormat: string;
  convertedFrom: string | undefined;
}

export interface FileWriteResult {
  path: string;
  size: number;
  success: boolean;
}

// ============================================================================
// Format Detection
// ============================================================================

type FileFormat = 'text' | 'docx' | 'pdf' | 'xlsx' | 'binary';

function detectFileFormat(filePath: string): FileFormat {
  const ext = extname(filePath).toLowerCase();

  switch (ext) {
    case '.docx':
    case '.doc':
      return 'docx';
    case '.pdf':
      return 'pdf';
    case '.xlsx':
    case '.xls':
      return 'xlsx';
    case '.txt':
    case '.md':
    case '.json':
    case '.yaml':
    case '.yml':
    case '.xml':
    case '.html':
    case '.htm':
    case '.css':
    case '.js':
    case '.ts':
    case '.jsx':
    case '.tsx':
    case '.py':
    case '.rb':
    case '.go':
    case '.rs':
    case '.java':
    case '.c':
    case '.cpp':
    case '.h':
    case '.hpp':
    case '.sh':
    case '.bash':
    case '.zsh':
    case '.sql':
    case '.csv':
    case '.log':
    case '.env':
    case '.ini':
    case '.toml':
    case '.cfg':
    case '.conf':
      return 'text';
    default:
      return 'binary';
  }
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert DOCX to Markdown using mammoth
 * Uses HTML conversion then strips tags for a basic markdown representation
 */
async function convertDocxToMarkdown(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import with type casting to avoid TypeScript errors for optional dependency
    const mammoth = await Function('return import("mammoth")')() as {
      convertToHtml: (options: { buffer: Buffer }) => Promise<{
        value: string;
        messages: Array<{ type: string; message: string }>;
      }>;
    };
    // Use convertToHtml since mammoth doesn't have direct markdown support
    const result = await mammoth.convertToHtml({ buffer });

    if (result.messages && result.messages.length > 0) {
      // Log warnings but continue
      for (const msg of result.messages) {
        if (msg.type === 'warning') {
          console.warn(`DOCX conversion warning: ${msg.message}`);
        }
      }
    }

    // Convert basic HTML to markdown-like text
    const html = result.value;
    let markdown = html
      // Convert headers
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
      .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
      .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
      // Convert bold and italic
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      // Convert links
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      // Convert lists
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<\/?[ou]l[^>]*>/gi, '\n')
      // Convert paragraphs and breaks
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      // Remove remaining HTML tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Clean up extra whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return markdown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(
        'mammoth package not installed. Install it with: pnpm add mammoth'
      );
    }
    throw new Error(`Failed to convert DOCX to markdown: ${(error as Error).message}`);
  }
}

/**
 * Convert PDF to Markdown using pdf-parse
 */
async function convertPdfToMarkdown(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import with type casting to avoid TypeScript errors for optional dependency
    const pdfParseModule = await Function('return import("pdf-parse")')() as {
      default: (buffer: Buffer) => Promise<{ text: string; numpages: number }>;
    };
    const pdfParse = pdfParseModule.default;
    const data = await pdfParse(buffer);

    // Convert plain text to basic markdown
    // Split into paragraphs and format
    const text = data.text || '';
    const lines = text.split('\n');
    const paragraphs: string[] = [];
    let currentParagraph: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') {
        if (currentParagraph.length > 0) {
          paragraphs.push(currentParagraph.join(' '));
          currentParagraph = [];
        }
      } else {
        currentParagraph.push(trimmed);
      }
    }

    if (currentParagraph.length > 0) {
      paragraphs.push(currentParagraph.join(' '));
    }

    return paragraphs.join('\n\n');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(
        'pdf-parse package not installed. Install it with: pnpm add pdf-parse'
      );
    }
    throw new Error(`Failed to convert PDF to markdown: ${(error as Error).message}`);
  }
}

/**
 * Convert XLSX to CSV using exceljs
 */
async function convertXlsxToCsv(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import with type casting to avoid TypeScript errors for optional dependency
    const ExcelJSModule = await Function('return import("exceljs")')() as {
      default: {
        Workbook: new () => {
          xlsx: {
            load: (buffer: Buffer) => Promise<void>;
          };
          worksheets: Array<{
            name: string;
            rowCount: number;
            eachRow: (callback: (row: { values: unknown[] }, rowNumber: number) => void) => void;
          }>;
        };
      };
    };
    const ExcelJS = ExcelJSModule.default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheets = workbook.worksheets;

    if (worksheets.length === 0) {
      return '';
    }

    // Helper function to convert worksheet to CSV
    const worksheetToCsv = (worksheet: typeof worksheets[0]): string => {
      const rows: string[] = [];
      worksheet.eachRow((row, _rowNumber) => {
        // Convert row values to CSV format
        const values = (row.values as unknown[]).slice(1); // Skip index 0 which is undefined
        const csvRow = values.map(val => {
          if (val === null || val === undefined) return '';
          const str = String(val);
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',');
        rows.push(csvRow);
      });
      return rows.join('\n');
    };

    // If single sheet, return CSV directly
    if (worksheets.length === 1) {
      return worksheetToCsv(worksheets[0]);
    }

    // Multiple sheets: include sheet name as header
    const csvParts: string[] = [];
    for (const worksheet of worksheets) {
      const csv = worksheetToCsv(worksheet);
      if (csv.trim()) {
        csvParts.push(`# Sheet: ${worksheet.name}\n${csv}`);
      }
    }

    return csvParts.join('\n\n');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(
        'exceljs package not installed. Install it with: pnpm add exceljs'
      );
    }
    throw new Error(`Failed to convert XLSX to CSV: ${(error as Error).message}`);
  }
}

// ============================================================================
// file.read - Read File with Format Conversion
// ============================================================================

/**
 * Read a file and automatically convert based on format:
 * - Text files: return raw content
 * - DOCX: convert to markdown
 * - PDF: convert to markdown
 * - XLSX: convert to CSV
 *
 * Example:
 * ```yaml
 * action: file.read
 * inputs:
 *   path: "/path/to/document.docx"
 * output_variable: doc_content
 * ```
 */
export async function executeFileRead(
  inputs: FileReadInputs,
  context: ExecutionContext
): Promise<FileReadResult> {
  // Resolve path with template support
  const resolvedPath = resolveTemplates(inputs.path, context) as string;
  const absolutePath = resolve(resolvedPath);

  // Check file exists
  try {
    await fs.access(absolutePath);
  } catch {
    throw new Error(`File not found: ${absolutePath}`);
  }

  // Get file stats
  const stats = await fs.stat(absolutePath);

  // Detect format
  const format = detectFileFormat(absolutePath);

  // Read file as buffer
  const buffer = await fs.readFile(absolutePath);

  let content: string;
  let convertedFrom: string | undefined;

  switch (format) {
    case 'docx':
      content = await convertDocxToMarkdown(buffer);
      convertedFrom = 'docx';
      break;

    case 'pdf':
      content = await convertPdfToMarkdown(buffer);
      convertedFrom = 'pdf';
      break;

    case 'xlsx':
      content = await convertXlsxToCsv(buffer);
      convertedFrom = 'xlsx';
      break;

    case 'text':
      content = buffer.toString(inputs.encoding || 'utf8');
      break;

    case 'binary':
    default:
      // For binary files, return base64 encoded content
      content = buffer.toString('base64');
      convertedFrom = 'binary (base64 encoded)';
      break;
  }

  return {
    content,
    path: absolutePath,
    size: stats.size,
    originalFormat: format,
    convertedFrom,
  };
}

// ============================================================================
// file.write - Write File
// ============================================================================

/**
 * Write data to a file. Supports both text and binary data.
 *
 * Examples:
 * ```yaml
 * # Write text
 * action: file.write
 * inputs:
 *   path: "/path/to/output.txt"
 *   data: "{{ processed_content }}"
 *
 * # Write binary (base64 encoded)
 * action: file.write
 * inputs:
 *   path: "/path/to/output.bin"
 *   data: "{{ base64_data }}"
 *   encoding: "base64"
 *
 * # Create directory if needed
 * action: file.write
 * inputs:
 *   path: "/new/path/output.txt"
 *   data: "content"
 *   createDirectory: true
 * ```
 */
export async function executeFileWrite(
  inputs: FileWriteInputs,
  context: ExecutionContext
): Promise<FileWriteResult> {
  // Resolve path with template support
  const resolvedPath = resolveTemplates(inputs.path, context) as string;
  const absolutePath = resolve(resolvedPath);

  // Resolve data
  const resolvedData = resolveTemplates(inputs.data, context);

  // Create directory if requested
  if (inputs.createDirectory) {
    const dir = dirname(absolutePath);
    await fs.mkdir(dir, { recursive: true });
  }

  // Prepare data buffer
  let dataBuffer: Buffer;

  if (Buffer.isBuffer(resolvedData)) {
    dataBuffer = resolvedData;
  } else if (typeof resolvedData === 'string') {
    if (inputs.encoding === 'base64') {
      // Decode base64 to binary
      dataBuffer = Buffer.from(resolvedData, 'base64');
    } else {
      dataBuffer = Buffer.from(resolvedData, inputs.encoding || 'utf8');
    }
  } else {
    // Convert objects/arrays to JSON
    dataBuffer = Buffer.from(JSON.stringify(resolvedData, null, 2), 'utf8');
  }

  // Write file
  await fs.writeFile(absolutePath, dataBuffer);

  // Get final stats
  const stats = await fs.stat(absolutePath);

  return {
    path: absolutePath,
    size: stats.size,
    success: true,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Execute a file operation based on action name
 */
export async function executeFileOperation(
  action: string,
  resolvedInputs: Record<string, unknown>,
  context: ExecutionContext
): Promise<unknown> {
  switch (action) {
    case 'file.read':
      return executeFileRead(resolvedInputs as unknown as FileReadInputs, context);

    case 'file.write':
      return executeFileWrite(resolvedInputs as unknown as FileWriteInputs, context);

    default:
      return null; // Not a file operation
  }
}

/**
 * Check if an action is a file operation
 */
export function isFileOperation(action: string): boolean {
  const fileActions = ['file.read', 'file.write'];
  return fileActions.includes(action);
}
