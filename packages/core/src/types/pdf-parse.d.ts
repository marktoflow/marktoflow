// Type definitions for pdf-parse 1.1.1

declare module 'pdf-parse' {
  interface PDFParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
    version: string;
  }

  interface PDFParseOptions {
    pagerender?: (pageData: unknown) => Promise<string>;
    max?: number;
    version?: string;
  }

  function pdfParse(buffer: Buffer, options?: PDFParseOptions): Promise<PDFParseResult>;

  export default pdfParse;
}
