import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { stringify, parse } from 'yaml';
import { AlertCircle, Check } from 'lucide-react';
import type { WorkflowStep } from '@shared/types';

interface YamlEditorProps {
  value: WorkflowStep;
  onChange: (step: WorkflowStep) => void;
}

export function YamlEditor({ value, onChange }: YamlEditorProps) {
  const [yamlContent, setYamlContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    try {
      const yaml = stringify(value, {
        indent: 2,
        lineWidth: 0,
      });
      setYamlContent(yaml);
      setError(null);
      setIsValid(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to serialize');
      setIsValid(false);
    }
  }, [value]);

  const handleEditorChange = (content: string | undefined) => {
    if (!content) return;

    setYamlContent(content);

    try {
      const parsed = parse(content) as WorkflowStep;

      // Validate required fields
      if (!parsed.id) {
        throw new Error('Step ID is required');
      }
      if (!parsed.action && !parsed.workflow) {
        throw new Error('Either action or workflow is required');
      }

      setError(null);
      setIsValid(true);
      onChange(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid YAML');
      setIsValid(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isValid ? (
            <span className="flex items-center gap-1 text-xs text-success">
              <Check className="w-3 h-3" />
              Valid YAML
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-error">
              <AlertCircle className="w-3 h-3" />
              {error}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {yamlContent.split('\n').length} lines
        </span>
      </div>

      {/* Editor */}
      <div className="border border-node-border rounded-lg overflow-hidden">
        <Editor
          height="400px"
          language="yaml"
          value={yamlContent}
          onChange={handleEditorChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: 'JetBrains Mono, Consolas, monospace',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>

      {/* Help text */}
      <div className="text-xs text-gray-500">
        <p>
          Edit the step configuration directly in YAML format. Changes are
          applied automatically when valid.
        </p>
      </div>
    </div>
  );
}

// Read-only YAML viewer
interface YamlViewerProps {
  value: unknown;
  title?: string;
}

export function YamlViewer({ value, title }: YamlViewerProps) {
  const [yamlContent, setYamlContent] = useState('');

  useEffect(() => {
    try {
      const yaml = stringify(value, {
        indent: 2,
        lineWidth: 0,
      });
      setYamlContent(yaml);
    } catch {
      setYamlContent('# Failed to serialize value');
    }
  }, [value]);

  return (
    <div className="space-y-2">
      {title && (
        <h4 className="text-sm font-medium text-gray-300">{title}</h4>
      )}
      <div className="border border-node-border rounded-lg overflow-hidden">
        <Editor
          height="300px"
          language="yaml"
          value={yamlContent}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: 'JetBrains Mono, Consolas, monospace',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>
    </div>
  );
}
