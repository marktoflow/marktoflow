/**
 * Type declarations for @marktoflow/gui
 * This allows the CLI to compile without requiring the GUI package to be installed
 */

declare module '@marktoflow/gui' {
  import type { Server } from 'http';

  export interface ServerOptions {
    port?: number;
    workflowDir?: string;
    staticDir?: string;
  }

  export function startServer(options?: ServerOptions): Promise<Server>;
  export function stopServer(): void;
}
