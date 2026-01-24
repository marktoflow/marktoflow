import { Ollama } from 'ollama';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export const OllamaInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const host = (config.options?.['host'] as string) || (config.auth?.['host'] as string) || 'http://127.0.0.1:11434';
    
    // The ollama package constructor takes an object with host
    return new Ollama({ host });
  },
};
