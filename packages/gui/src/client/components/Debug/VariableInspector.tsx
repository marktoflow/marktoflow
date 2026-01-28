/**
 * Variable Inspector Component
 * Displays JSON data with syntax highlighting and expand/collapse functionality
 */

import { useState } from 'react';
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';

interface VariableInspectorProps {
  data: unknown;
  name?: string;
  expanded?: boolean;
}

export function VariableInspector({ data, name, expanded = true }: VariableInspectorProps) {
  return (
    <div className="font-mono text-sm">
      <JsonNode value={data} name={name} depth={0} initiallyExpanded={expanded} />
    </div>
  );
}

interface JsonNodeProps {
  value: unknown;
  name?: string;
  depth: number;
  initiallyExpanded?: boolean;
}

function JsonNode({ value, name, depth, initiallyExpanded = true }: JsonNodeProps) {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const [copied, setCopied] = useState(false);

  const indent = depth * 16;
  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getValueColor = (val: unknown): string => {
    if (val === null) return 'text-gray-500';
    if (typeof val === 'string') return 'text-green-400';
    if (typeof val === 'number') return 'text-blue-400';
    if (typeof val === 'boolean') return 'text-purple-400';
    return 'text-gray-300';
  };

  const renderValue = (val: unknown): string => {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'string') return `"${val}"`;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    return '';
  };

  if (!isExpandable) {
    return (
      <div className="flex items-center gap-2 py-0.5 hover:bg-white/5 rounded px-1" style={{ paddingLeft: indent }}>
        {name && (
          <>
            <span className="text-cyan-400">{name}</span>
            <span className="text-gray-500">:</span>
          </>
        )}
        <span className={getValueColor(value)}>{renderValue(value)}</span>
      </div>
    );
  }

  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(value as Record<string, unknown>);

  const preview = isArray
    ? `Array(${entries.length})`
    : `Object {${entries.length} ${entries.length === 1 ? 'key' : 'keys'}}`;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-0.5 hover:bg-white/5 rounded px-1 cursor-pointer group"
        style={{ paddingLeft: indent }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <button className="text-gray-500 hover:text-white">
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>

        {name && (
          <>
            <span className="text-cyan-400">{name}</span>
            <span className="text-gray-500">:</span>
          </>
        )}

        <span className="text-gray-500">
          {isArray ? '[' : '{'}
          {!isExpanded && <span className="text-gray-600 ml-1">{preview}</span>}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="w-3 h-3 text-green-400" />
          ) : (
            <Copy className="w-3 h-3 text-gray-500 hover:text-white" />
          )}
        </button>
      </div>

      {isExpanded && (
        <>
          {entries.map(([key, val]) => (
            <JsonNode
              key={key}
              name={isArray ? undefined : key}
              value={val}
              depth={depth + 1}
              initiallyExpanded={depth < 1}
            />
          ))}
          <div className="text-gray-500 py-0.5 px-1" style={{ paddingLeft: indent }}>
            {isArray ? ']' : '}'}
          </div>
        </>
      )}

      {!isExpanded && (
        <div className="text-gray-500 inline">{isArray ? ']' : '}'}</div>
      )}
    </div>
  );
}
