import type { z } from 'zod';

export type SecretString = string & { readonly __secretBrand: unique symbol };

export type AuthType = 'api_key' | 'oauth';

export interface ApiKeyAuthConfig {
  type: 'api_key';
  apiKey: SecretString;
  headerName?: string;
  prefix?: string;
}

export interface OAuthAuthConfig {
  type: 'oauth';
  accessToken: SecretString;
  refreshToken?: SecretString;
  expiresAt?: number;
  tokenType?: string;
  scopes?: string[];
}

export type AuthConfig = ApiKeyAuthConfig | OAuthAuthConfig;

export type AgentCapability =
  | 'chat'
  | 'tools'
  | 'vision'
  | 'code-exec'
  | 'streaming'
  | 'structured-output'
  | 'mcp';

export interface AuthSupport {
  required: boolean;
  supported: AuthType[];
}

export interface ProviderMetadata {
  id: string;
  displayName: string;
  description?: string;
  capabilities: AgentCapability[];
  auth: AuthSupport;
  defaultModel?: string;
  models?: string[];
}

export interface ClientCreateContext<TConfig> {
  config: TConfig;
  auth?: AuthConfig;
}

export interface AgentRequest {
  input: string;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentResponse {
  provider: string;
  model?: string;
  output: string;
  raw?: unknown;
}

export interface AgentClient {
  readonly provider: string;
  readonly capabilities: AgentCapability[];
  invoke(request: AgentRequest): Promise<AgentResponse>;
}

export interface AgentProvider<TConfig = unknown> {
  readonly metadata: ProviderMetadata;
  readonly configSchema: z.ZodType<TConfig, z.ZodTypeDef, unknown>;
  createClient(context: ClientCreateContext<TConfig>): Promise<AgentClient> | AgentClient;
}

export interface CreateClientInput<TConfig = unknown> {
  provider: string;
  config: TConfig;
  auth?: AuthConfig;
}
