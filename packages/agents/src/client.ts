import type { AgentCapability, AgentClient, AgentRequest, AgentResponse } from './types.js';

export interface StubClientOptions {
  provider: string;
  capabilities: AgentCapability[];
  model?: string;
}

export class StubAgentClient implements AgentClient {
  readonly provider: string;
  readonly capabilities: AgentCapability[];
  private readonly model?: string;

  constructor(options: StubClientOptions) {
    this.provider = options.provider;
    this.capabilities = options.capabilities;
    if (options.model !== undefined) {
      this.model = options.model;
    }
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    return {
      provider: this.provider,
      ...(request.model ?? this.model ? { model: request.model ?? this.model } : {}),
      output: `[stub:${this.provider}] ${request.input}`,
      raw: {
        echoed: true,
      },
    };
  }
}
