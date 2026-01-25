import { useState } from 'react';
import { Modal, ModalFooter } from '../common/Modal';
import { Button } from '../common/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../common/Tabs';
import Editor from '@monaco-editor/react';
import { stringify } from 'yaml';
import { Check, X, Eye, Code, GitCompare } from 'lucide-react';
import type { Workflow } from '@shared/types';

interface ChangePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalWorkflow: Workflow | null;
  modifiedWorkflow: Workflow | null;
  explanation: string;
  onAccept: () => void;
  onReject: () => void;
}

export function ChangePreview({
  open,
  onOpenChange,
  originalWorkflow,
  modifiedWorkflow,
  explanation,
  onAccept,
  onReject,
}: ChangePreviewProps) {
  const [activeTab, setActiveTab] = useState('explanation');

  const originalYaml = originalWorkflow
    ? stringify(originalWorkflow, { indent: 2 })
    : '';
  const modifiedYaml = modifiedWorkflow
    ? stringify(modifiedWorkflow, { indent: 2 })
    : '';

  const handleAccept = () => {
    onAccept();
    onOpenChange(false);
  };

  const handleReject = () => {
    onReject();
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Review Changes"
      description="The AI has suggested the following changes to your workflow"
      size="xl"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="explanation">
            <Eye className="w-4 h-4 mr-1.5" />
            Explanation
          </TabsTrigger>
          <TabsTrigger value="diff">
            <GitCompare className="w-4 h-4 mr-1.5" />
            Side by Side
          </TabsTrigger>
          <TabsTrigger value="modified">
            <Code className="w-4 h-4 mr-1.5" />
            Modified YAML
          </TabsTrigger>
        </TabsList>

        <div className="p-4">
          <TabsContent value="explanation">
            <div className="prose prose-invert max-w-none">
              <div className="p-4 bg-node-bg rounded-lg border border-node-border">
                <p className="text-gray-300 whitespace-pre-wrap">{explanation}</p>
              </div>

              {modifiedWorkflow && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">
                    Changes Summary
                  </h4>
                  <ul className="space-y-2">
                    {getChangesSummary(originalWorkflow, modifiedWorkflow).map(
                      (change, index) => (
                        <li
                          key={index}
                          className={`flex items-start gap-2 text-sm ${
                            change.type === 'added'
                              ? 'text-success'
                              : change.type === 'removed'
                                ? 'text-error'
                                : 'text-warning'
                          }`}
                        >
                          <span className="flex-shrink-0">
                            {change.type === 'added'
                              ? '+'
                              : change.type === 'removed'
                                ? '-'
                                : '~'}
                          </span>
                          <span>{change.description}</span>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="diff">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">
                  Original
                </h4>
                <div className="border border-node-border rounded-lg overflow-hidden">
                  <Editor
                    height="400px"
                    language="yaml"
                    value={originalYaml}
                    theme="vs-dark"
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 12,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                    }}
                  />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">
                  Modified
                </h4>
                <div className="border border-node-border rounded-lg overflow-hidden">
                  <Editor
                    height="400px"
                    language="yaml"
                    value={modifiedYaml}
                    theme="vs-dark"
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 12,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                    }}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="modified">
            <div className="border border-node-border rounded-lg overflow-hidden">
              <Editor
                height="500px"
                language="yaml"
                value={modifiedYaml}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, Consolas, monospace',
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <ModalFooter>
        <Button
          variant="secondary"
          onClick={handleReject}
          icon={<X className="w-4 h-4" />}
        >
          Reject
        </Button>
        <Button onClick={handleAccept} icon={<Check className="w-4 h-4" />}>
          Accept Changes
        </Button>
      </ModalFooter>
    </Modal>
  );
}

interface Change {
  type: 'added' | 'removed' | 'modified';
  description: string;
}

function getChangesSummary(
  original: Workflow | null,
  modified: Workflow | null
): Change[] {
  const changes: Change[] = [];

  if (!original || !modified) return changes;

  // Check steps
  const originalStepIds = new Set(original.steps.map((s) => s.id));
  const modifiedStepIds = new Set(modified.steps.map((s) => s.id));

  // Added steps
  for (const step of modified.steps) {
    if (!originalStepIds.has(step.id)) {
      changes.push({
        type: 'added',
        description: `Added step "${step.name || step.id}"`,
      });
    }
  }

  // Removed steps
  for (const step of original.steps) {
    if (!modifiedStepIds.has(step.id)) {
      changes.push({
        type: 'removed',
        description: `Removed step "${step.name || step.id}"`,
      });
    }
  }

  // Modified steps
  for (const modStep of modified.steps) {
    if (originalStepIds.has(modStep.id)) {
      const origStep = original.steps.find((s) => s.id === modStep.id);
      if (origStep) {
        // Check for modifications
        if (JSON.stringify(origStep) !== JSON.stringify(modStep)) {
          const modifications: string[] = [];

          if (origStep.action !== modStep.action) {
            modifications.push('action');
          }
          if (JSON.stringify(origStep.inputs) !== JSON.stringify(modStep.inputs)) {
            modifications.push('inputs');
          }
          if (
            JSON.stringify(origStep.errorHandling) !==
            JSON.stringify(modStep.errorHandling)
          ) {
            modifications.push('error handling');
          }
          if (
            JSON.stringify(origStep.conditions) !==
            JSON.stringify(modStep.conditions)
          ) {
            modifications.push('conditions');
          }

          if (modifications.length > 0) {
            changes.push({
              type: 'modified',
              description: `Modified "${modStep.name || modStep.id}": ${modifications.join(', ')}`,
            });
          }
        }
      }
    }
  }

  // Check metadata changes
  if (original.metadata.name !== modified.metadata.name) {
    changes.push({
      type: 'modified',
      description: `Renamed workflow to "${modified.metadata.name}"`,
    });
  }

  return changes;
}
