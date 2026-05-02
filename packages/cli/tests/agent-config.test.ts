import { describe, expect, it } from 'vitest';
import { AI_AGENT_SDKS } from '../src/utils/agent-override.js';
import { getAgentAuthConfig, getAgentSDKName } from '../src/utils/agent-config.js';

describe('agent-config', () => {
  it('maps canonical ACP providers to their SDK names', () => {
    expect(getAgentSDKName('copilot-acp')).toBe('copilot-acp');
    expect(getAgentSDKName('claude-code-acp')).toBe('claude-code-acp');
    expect(getAgentSDKName('codex-acp')).toBe('codex-acp');
    expect(getAgentSDKName('gemini')).toBe('gemini-cli');
    expect(getAgentSDKName('gemini-acp')).toBe('gemini-acp');
  });

  it('returns empty default auth for CLI-driven ACP adapters', () => {
    expect(getAgentAuthConfig('copilot-acp')).toEqual({});
    expect(getAgentAuthConfig('gemini-acp')).toEqual({});
    expect(getAgentAuthConfig('claude-code-acp')).toEqual({});
    expect(getAgentAuthConfig('codex-acp')).toEqual({});
  });

  it('treats the canonical ACP SDK keys as AI agent tools', () => {
    expect(AI_AGENT_SDKS).toEqual(
      expect.arrayContaining([
        'copilot-acp',
        'gemini-cli',
        'gemini-acp',
        'claude-code-acp',
        'codex-acp',
      ])
    );
  });
});
