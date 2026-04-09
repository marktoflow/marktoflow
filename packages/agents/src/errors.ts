export type AgentErrorCode =
  | 'INVALID_CONFIG'
  | 'AUTHENTICATION_FAILED'
  | 'AUTHORIZATION_FAILED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'PROVIDER_NOT_FOUND'
  | 'PROVIDER_CONFLICT'
  | 'UNSUPPORTED_CAPABILITY'
  | 'INTERNAL_ERROR';

export interface AgentErrorOptions {
  provider?: string;
  details?: unknown;
  retryable?: boolean;
  cause?: unknown;
}

export class AgentError extends Error {
  readonly code: AgentErrorCode;
  readonly provider?: string;
  readonly details?: unknown;
  readonly retryable: boolean;

  constructor(code: AgentErrorCode, message: string, options: AgentErrorOptions = {}) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    if (options.provider !== undefined) {
      this.provider = options.provider;
    }
    if (options.details !== undefined) {
      this.details = options.details;
    }
    this.retryable = options.retryable ?? false;

    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

function asErrorLike(error: unknown): {
  message?: string;
  status?: number;
  code?: string;
  name?: string;
} {
  if (error && typeof error === 'object') {
    const candidate = error as {
      message?: string;
      status?: number;
      code?: string;
      name?: string;
    };
    return candidate;
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  return {};
}

export function toAgentError(error: unknown, provider?: string): AgentError {
  if (error instanceof AgentError) {
    return error;
  }

  const err = asErrorLike(error);
  const message = err.message ?? 'Unknown provider error';
  const normalized = message.toLowerCase();
  const providerOption = provider ? { provider } : {};

  if (err.status === 401 || normalized.includes('unauthorized') || normalized.includes('invalid api key')) {
    return new AgentError('AUTHENTICATION_FAILED', message, { ...providerOption, cause: error });
  }

  if (err.status === 403 || normalized.includes('forbidden')) {
    return new AgentError('AUTHORIZATION_FAILED', message, { ...providerOption, cause: error });
  }

  if (err.status === 429 || normalized.includes('rate limit')) {
    return new AgentError('RATE_LIMITED', message, {
      ...providerOption,
      cause: error,
      retryable: true,
    });
  }

  if (err.name === 'AbortError' || normalized.includes('timeout')) {
    return new AgentError('TIMEOUT', message, { ...providerOption, cause: error, retryable: true });
  }

  if (
    normalized.includes('network') ||
    normalized.includes('econnrefused') ||
    normalized.includes('enotfound')
  ) {
    return new AgentError('NETWORK_ERROR', message, {
      ...providerOption,
      cause: error,
      retryable: true,
    });
  }

  return new AgentError('INTERNAL_ERROR', message, { ...providerOption, cause: error });
}
