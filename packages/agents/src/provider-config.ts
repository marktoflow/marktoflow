export type CanonicalAgentProvider =
  | 'claude'
  | 'copilot'
  | 'codex'
  | 'gemini'
  | 'qwen'
  | 'openai'
  | 'ollama'
  | 'opencode';

const PROVIDER_ALIASES: Record<string, CanonicalAgentProvider> = {
  claude: 'claude',
  'claude-agent': 'claude',
  copilot: 'copilot',
  'github-copilot': 'copilot',
  codex: 'codex',
  gemini: 'gemini',
  'gemini-cli': 'gemini',
  'google-gemini-cli': 'gemini',
  qwen: 'qwen',
  openai: 'openai',
  vllm: 'openai',
  'openai-compatible': 'openai',
  ollama: 'ollama',
  opencode: 'opencode',
};

const SDK_NAMES: Record<CanonicalAgentProvider, string> = {
  claude: 'claude-agent',
  copilot: 'github-copilot',
  codex: 'codex',
  gemini: 'gemini',
  qwen: 'qwen',
  openai: 'openai',
  ollama: 'ollama',
  opencode: 'opencode',
};

const AUTH_TEMPLATES: Record<CanonicalAgentProvider, Record<string, string>> = {
  claude: { api_key: '${ANTHROPIC_API_KEY}' },
  copilot: { token: '${GITHUB_TOKEN}' },
  codex: { api_key: '${OPENAI_API_KEY}' },
  gemini: {
    api_key: '${GEMINI_API_KEY}',
  },
  qwen: {
    api_key: '${QWEN_API_KEY}',
    base_url: '${QWEN_BASE_URL:-https://dashscope.aliyuncs.com/compatible-mode/v1}',
  },
  openai: {
    api_key: '${OPENAI_API_KEY}',
    base_url: '${OPENAI_BASE_URL:-https://api.openai.com/v1}',
  },
  ollama: {
    base_url: '${OLLAMA_BASE_URL:-http://localhost:11434}',
  },
  opencode: {},
};

export function getCanonicalAgentProvider(provider: string): CanonicalAgentProvider {
  const canonical = PROVIDER_ALIASES[provider.toLowerCase()];
  if (!canonical) {
    throw new Error(`Unknown agent provider: ${provider}. Available: ${Object.keys(PROVIDER_ALIASES).join(', ')}`);
  }
  return canonical;
}

export function getAgentSDKNameForProvider(provider: string): string {
  const canonical = getCanonicalAgentProvider(provider);
  return SDK_NAMES[canonical];
}

export function getDefaultAgentAuthTemplate(providerOrSdk: string): Record<string, string> {
  const normalized = providerOrSdk.toLowerCase();

  // allow either sdk names or provider aliases
  const providerEntry = Object.entries(SDK_NAMES).find(([, sdk]) => sdk === normalized)?.[0] as
    | CanonicalAgentProvider
    | undefined;

  const canonical = providerEntry ?? getCanonicalAgentProvider(normalized);
  return AUTH_TEMPLATES[canonical] ?? {};
}
