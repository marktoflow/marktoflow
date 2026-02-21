import { describe, expect, it } from 'vitest';
import {
  getAgentSDKNameForProvider,
  getCanonicalAgentProvider,
  getDefaultAgentAuthTemplate,
} from '../src/provider-config.js';

describe('provider-config', () => {
  it('normalizes aliases', () => {
    expect(getCanonicalAgentProvider('claude-agent')).toBe('claude');
    expect(getCanonicalAgentProvider('github-copilot')).toBe('copilot');
    expect(getCanonicalAgentProvider('google-gemini-cli')).toBe('gemini');
  });

  it('resolves sdk name from provider alias', () => {
    expect(getAgentSDKNameForProvider('claude')).toBe('claude-agent');
    expect(getAgentSDKNameForProvider('copilot')).toBe('github-copilot');
    expect(getAgentSDKNameForProvider('vllm')).toBe('openai');
  });

  it('returns auth template for provider or sdk name', () => {
    expect(getDefaultAgentAuthTemplate('qwen')).toEqual({
      api_key: '${QWEN_API_KEY}',
      base_url: '${QWEN_BASE_URL:-https://dashscope.aliyuncs.com/compatible-mode/v1}',
    });
    expect(getDefaultAgentAuthTemplate('claude-agent')).toEqual({ api_key: '${ANTHROPIC_API_KEY}' });
  });
});
