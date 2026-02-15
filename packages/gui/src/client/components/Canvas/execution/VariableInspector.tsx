/**
 * VariableInspector — Displays step inputs and outputs with expandable sections.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { ValueRenderer } from './ValueRenderer';
import type { ExecutionStep } from './StepsList';

export function VariableInspector({ steps }: { steps: ExecutionStep[] }) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [expandedSection, setExpandedSection] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const stepsWithData = steps.filter(
    (step) => step.inputs !== undefined || (step.output !== undefined && step.outputVariable)
  );

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSection((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const copyValue = async (key: string, value: unknown) => {
    try {
      const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (stepsWithData.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        No data available yet.
        <br />
        <span className="text-xs">Step inputs and outputs will appear as steps execute.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {stepsWithData.map((step) => {
        const isExpanded = expandedSteps.has(step.stepId);
        const hasInputs = step.inputs && Object.keys(step.inputs).length > 0;
        const hasOutput = step.output !== undefined && step.outputVariable;

        return (
          <div key={step.stepId} className="border border-border-default rounded-lg overflow-hidden">
            <button
              onClick={() => toggleStep(step.stepId)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-bg-surface hover:bg-white/5 transition-colors"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4 text-text-secondary" /> : <ChevronRight className="w-4 h-4 text-text-secondary" />}
              <code className="text-sm text-text-primary font-mono">{step.stepName || step.stepId}</code>
              <span className="text-xs text-text-muted ml-auto">
                {hasInputs && `${Object.keys(step.inputs!).length} inputs`}
                {hasInputs && hasOutput && ' • '}
                {hasOutput && step.outputVariable}
              </span>
            </button>

            {isExpanded && (
              <div className="bg-bg-panel border-t border-border-default">
                {hasInputs && (
                  <div className="border-b border-border-default">
                    <button
                      onClick={() => toggleSection(`${step.stepId}-inputs`)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
                    >
                      {expandedSection.has(`${step.stepId}-inputs`) ? <ChevronDown className="w-3 h-3 text-text-secondary" /> : <ChevronRight className="w-3 h-3 text-text-secondary" />}
                      <span className="text-xs font-medium text-text-secondary">Inputs ({Object.keys(step.inputs!).length})</span>
                    </button>
                    {expandedSection.has(`${step.stepId}-inputs`) && (
                      <div className="px-3 pb-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 overflow-x-auto">
                            <ValueRenderer value={step.inputs} onCopy={(key, val) => copyValue(key, val)} copiedKey={copiedKey} path="inputs" />
                          </div>
                          <button onClick={() => copyValue(`${step.stepId}-inputs`, step.inputs)} className="p-1.5 hover:bg-white/10 rounded transition-colors" title="Copy inputs">
                            {copiedKey === `${step.stepId}-inputs` ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-text-secondary" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {hasOutput && (
                  <div>
                    <button
                      onClick={() => toggleSection(`${step.stepId}-output`)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
                    >
                      {expandedSection.has(`${step.stepId}-output`) ? <ChevronDown className="w-3 h-3 text-text-secondary" /> : <ChevronRight className="w-3 h-3 text-text-secondary" />}
                      <span className="text-xs font-medium text-text-secondary">Output</span>
                      <code className="text-xs text-primary font-mono ml-auto">{step.outputVariable}</code>
                    </button>
                    {expandedSection.has(`${step.stepId}-output`) && (
                      <div className="px-3 pb-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 overflow-x-auto">
                            <ValueRenderer value={step.output} onCopy={(key, val) => copyValue(key, val)} copiedKey={copiedKey} path={step.outputVariable || 'output'} />
                          </div>
                          <button onClick={() => copyValue(step.outputVariable || '', step.output)} className="p-1.5 hover:bg-white/10 rounded transition-colors" title="Copy output">
                            {copiedKey === step.outputVariable ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-text-secondary" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
