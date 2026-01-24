/**
 * marktoflow configuration loader.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { findProjectRoot } from './env.js';

export interface MarktoflowConfig {
  agent?: {
    primary?: string;
    fallback?: string | null;
    selectionStrategy?: string;
  };
  runtime?: {
    mode?: string;
    nodeVersion?: string;
  };
  logging?: {
    level?: string;
    destination?: string;
    format?: string;
    logPath?: string;
  };
  tools?: {
    discovery?: string;
    timeout?: string;
    registryPath?: string;
  };
  workflows?: {
    path?: string;
    maxConcurrent?: number;
    defaultTimeout?: string;
  };
  features?: Record<string, string>;
}

const DEFAULT_CONFIG: MarktoflowConfig = {
  workflows: { path: '.marktoflow/workflows' },
  tools: { registryPath: '.marktoflow/tools/registry.yaml' },
};

export function loadConfig(cwd: string = process.cwd()): MarktoflowConfig {
  const root = findProjectRoot(cwd);
  const configPath = root ? join(root, 'marktoflow.yaml') : join(cwd, 'marktoflow.yaml');
  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }
  const contents = readFileSync(configPath, 'utf8');
  const data = parse(contents) as MarktoflowConfig;
  return {
    ...DEFAULT_CONFIG,
    ...data,
    workflows: { ...DEFAULT_CONFIG.workflows, ...data?.workflows },
    tools: { ...DEFAULT_CONFIG.tools, ...data?.tools },
  };
}
