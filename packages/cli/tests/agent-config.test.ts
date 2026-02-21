import { describe, expect, it } from 'vitest';
import { getAgentAuthConfig, getAgentSDKName } from '../src/utils/agent-config.js';

describe('agent-config (delegated to @marktoflow/agents)', () => {
  it('maps provider aliases to sdk names', () => {
    expect(getAgentSDKName('claude')).toBe('claude-agent');
    expect(getAgentSDKName('github-copilot')).toBe('github-copilot');
    expect(getAgentSDKName('gemini-cli')).toBe('gemini');
    expect(getAgentSDKName('qwen')).toBe('qwen');
  });

  it('returns auth templates for providers/sdk names', () => {
    expect(getAgentAuthConfig('claude')).toEqual({ api_key: '${ANTHROPIC_API_KEY}' });
    expect(getAgentAuthConfig('codex')).toEqual({ api_key: '${OPENAI_API_KEY}' });
    expect(getAgentAuthConfig('gemini')).toEqual({ api_key: '${GEMINI_API_KEY}' });
    expect(getAgentAuthConfig('qwen')).toEqual({
      api_key: '${QWEN_API_KEY}',
      base_url: '${QWEN_BASE_URL:-https://dashscope.aliyuncs.com/compatible-mode/v1}',
    });
    expect(getAgentAuthConfig('github-copilot')).toEqual({ token: '${GITHUB_TOKEN}' });
  });
});
