/**
 * CLI utility exports
 */

export {
  parseInputPairs,
  debugLogInputs,
  validateAndApplyDefaults,
  printMissingInputsError,
  type ParseInputsOptions,
  type ValidateInputsResult,
} from './input-parser.js';

export {
  AI_AGENT_SDKS,
  isAIAgentSDK,
  overrideAgentInWorkflow,
  debugLogAgentOverride,
  overrideModelInWorkflow,
  type AIAgentSDK,
  type AgentOverrideOptions,
  type AgentOverrideResult,
  type ModelOverrideResult,
} from './agent-override.js';

export {
  detectAgents,
  detectAgent,
  getKnownAgentIds,
  type DetectedAgent,
} from './detect-agents.js';
