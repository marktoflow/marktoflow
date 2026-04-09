import { describe, expect, it } from 'vitest';

import { OpenAIInitializer as OpenAIShimInitializer } from '../src/adapters/openai.js';
import { CodexInitializer as CodexShimInitializer } from '../src/adapters/codex.js';
import { GitHubCopilotInitializer as CopilotShimInitializer } from '../src/adapters/github-copilot.js';

import { OpenAIInitializer } from '@marktoflow/agents/adapters/openai';
import { CodexInitializer } from '@marktoflow/agents/adapters/codex';
import { GitHubCopilotInitializer } from '@marktoflow/agents/adapters/github-copilot';

describe('AI adapter shims', () => {
  it('re-exports OpenAI initializer from @marktoflow/agents', () => {
    expect(OpenAIShimInitializer).toBe(OpenAIInitializer);
  });

  it('re-exports Codex initializer from @marktoflow/agents', () => {
    expect(CodexShimInitializer).toBe(CodexInitializer);
  });

  it('re-exports Copilot initializer from @marktoflow/agents', () => {
    expect(CopilotShimInitializer).toBe(GitHubCopilotInitializer);
  });
});
