/**
 * Agent provider SDK name mapping and auth configuration.
 */

/**
 * Map agent provider aliases to SDK names
 */
export function getAgentSDKName(provider: string): string {
  const providerMap: Record<string, string> = {
    'claude': 'claude-agent',
    'claude-agent': 'claude-agent',
    'claude-code-acp': 'claude-code-acp',
    'copilot': 'github-copilot',
    'github-copilot': 'github-copilot',
    'copilot-acp': 'copilot-acp',
    'codex-acp': 'codex-acp',
    'gemini': 'gemini-cli',
    'gemini-cli': 'gemini-cli',
    'google-gemini-cli': 'gemini-cli',
    'gemini-acp': 'gemini-acp',
    'opencode': 'opencode',
    'ollama': 'ollama',
    'codex': 'codex',
    'openai': 'openai',
    'vllm': 'openai',
    'openai-compatible': 'openai',
    'qwen-code': 'qwen-code',
  };

  const normalized = provider.toLowerCase();
  const sdkName = providerMap[normalized];

  if (!sdkName) {
    throw new Error(`Unknown agent provider: ${provider}. Available: ${Object.keys(providerMap).join(', ')}`);
  }

  return sdkName;
}

/**
 * Get default auth configuration for an agent provider
 */
export function getAgentAuthConfig(sdkName: string): Record<string, string> {
  const authConfigs: Record<string, Record<string, string>> = {
    'claude-agent': {
      api_key: '${ANTHROPIC_API_KEY}',
    },
    'claude-code-acp': {},
    'github-copilot': {
      token: '${GITHUB_TOKEN}',
    },
    'copilot-acp': {},
    'codex-acp': {},
    'gemini-cli': {},
    'gemini-acp': {},
    'opencode': {},
    'ollama': {
      base_url: '${OLLAMA_BASE_URL:-http://localhost:11434}',
    },
    'codex': {
      api_key: '${OPENAI_API_KEY}',
    },
    'openai': {
      api_key: '${OPENAI_API_KEY}',
      base_url: '${OPENAI_BASE_URL:-https://api.openai.com/v1}',
    },
    'qwen-code': {},
  };

  return authConfigs[sdkName] || {};
}
