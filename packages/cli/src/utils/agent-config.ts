/**
 * Agent provider SDK mapping and auth configuration are centralized in
 * @marktoflow/agents so all packages share one source of truth.
 */
import { getAgentSDKNameForProvider, getDefaultAgentAuthTemplate } from '@marktoflow/agents';

export function getAgentSDKName(provider: string): string {
  return getAgentSDKNameForProvider(provider);
}

export function getAgentAuthConfig(sdkNameOrProvider: string): Record<string, string> {
  return getDefaultAgentAuthTemplate(sdkNameOrProvider);
}
