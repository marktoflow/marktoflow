import { describe, it, expect } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { Ollama } from 'ollama';
import { registerIntegrations, OllamaInitializer } from '../src/index.js';

describe('Ollama Integration', () => {
  it('should register ollama initializer', () => {
    const registry = new SDKRegistry();
    registerIntegrations(registry);

    const config = {
      sdk: 'ollama',
      options: { host: 'http://localhost:11434' }
    };

    const client = OllamaInitializer.initialize({}, config);
    expect(client).toBeInstanceOf(Promise);
    
    return expect(client).resolves.toBeInstanceOf(Ollama);
  });
});
