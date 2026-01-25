import { useState } from 'react';
import { Plus, Trash2, Variable } from 'lucide-react';
import { Button } from '../common/Button';

interface InputsEditorProps {
  inputs: Record<string, unknown>;
  onChange: (inputs: Record<string, unknown>) => void;
  availableVariables: string[];
}

export function InputsEditor({
  inputs,
  onChange,
  availableVariables,
}: InputsEditorProps) {
  const [newKey, setNewKey] = useState('');

  const entries = Object.entries(inputs);

  const updateInput = (key: string, value: unknown) => {
    onChange({ ...inputs, [key]: value });
  };

  const removeInput = (key: string) => {
    const updated = { ...inputs };
    delete updated[key];
    onChange(updated);
  };

  const addInput = () => {
    if (newKey && !inputs.hasOwnProperty(newKey)) {
      onChange({ ...inputs, [newKey]: '' });
      setNewKey('');
    }
  };

  const renameKey = (oldKey: string, newKeyName: string) => {
    if (newKeyName && newKeyName !== oldKey && !inputs.hasOwnProperty(newKeyName)) {
      const updated: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(inputs)) {
        if (key === oldKey) {
          updated[newKeyName] = value;
        } else {
          updated[key] = value;
        }
      }
      onChange(updated);
    }
  };

  const insertVariable = (key: string, variable: string) => {
    const currentValue = String(inputs[key] || '');
    updateInput(key, currentValue + `{{ ${variable} }}`);
  };

  return (
    <div className="space-y-4">
      {entries.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 mb-3">No inputs defined</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(([key, value]) => (
            <InputField
              key={key}
              inputKey={key}
              value={value}
              onChange={(newValue) => updateInput(key, newValue)}
              onRemove={() => removeInput(key)}
              onRename={(newName) => renameKey(key, newName)}
              availableVariables={availableVariables}
              onInsertVariable={(variable) => insertVariable(key, variable)}
            />
          ))}
        </div>
      )}

      {/* Add new input */}
      <div className="flex gap-2 pt-2 border-t border-node-border">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="New input key..."
          className="flex-1 px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              addInput();
            }
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={addInput}
          disabled={!newKey || inputs.hasOwnProperty(newKey)}
          icon={<Plus className="w-4 h-4" />}
        >
          Add
        </Button>
      </div>

      {/* Variable reference help */}
      {availableVariables.length > 0 && (
        <div className="p-3 bg-node-bg rounded-lg border border-node-border">
          <div className="flex items-center gap-2 mb-2">
            <Variable className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Available Variables
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availableVariables.map((variable) => (
              <code
                key={variable}
                className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded"
              >
                {variable}
              </code>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Click on an input field, then use the variable button to insert
          </p>
        </div>
      )}
    </div>
  );
}

interface InputFieldProps {
  inputKey: string;
  value: unknown;
  onChange: (value: unknown) => void;
  onRemove: () => void;
  onRename: (newKey: string) => void;
  availableVariables: string[];
  onInsertVariable: (variable: string) => void;
}

function InputField({
  inputKey,
  value,
  onChange,
  onRemove,
  onRename,
  availableVariables,
  onInsertVariable,
}: InputFieldProps) {
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [editedKey, setEditedKey] = useState(inputKey);
  const [showVariables, setShowVariables] = useState(false);

  const valueType = typeof value;
  const isObject = valueType === 'object' && value !== null;
  const isArray = Array.isArray(value);

  const handleKeySubmit = () => {
    if (editedKey !== inputKey) {
      onRename(editedKey);
    }
    setIsEditingKey(false);
  };

  const renderValueInput = () => {
    if (isArray || isObject) {
      return (
        <textarea
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              // Keep as string if not valid JSON
              onChange(e.target.value);
            }
          }}
          className="flex-1 px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm font-mono focus:outline-none focus:border-primary resize-none"
          rows={3}
        />
      );
    }

    if (valueType === 'boolean') {
      return (
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value === 'true')}
          className="flex-1 px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    if (valueType === 'number') {
      return (
        <input
          type="number"
          value={String(value)}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="flex-1 px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
        />
      );
    }

    // String input (default)
    return (
      <input
        type="text"
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
        placeholder="Value or {{ variable }}"
      />
    );
  };

  return (
    <div className="p-3 bg-node-bg/50 rounded-lg border border-node-border space-y-2">
      {/* Key row */}
      <div className="flex items-center gap-2">
        {isEditingKey ? (
          <input
            type="text"
            value={editedKey}
            onChange={(e) => setEditedKey(e.target.value)}
            onBlur={handleKeySubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleKeySubmit();
              if (e.key === 'Escape') {
                setEditedKey(inputKey);
                setIsEditingKey(false);
              }
            }}
            className="flex-1 px-2 py-1 bg-node-bg border border-primary rounded text-white text-sm font-mono focus:outline-none"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setIsEditingKey(true)}
            className="flex-1 text-left px-2 py-1 text-sm font-mono text-primary hover:bg-white/5 rounded"
          >
            {inputKey}
          </button>
        )}
        <span className="text-xs text-gray-500">{valueType}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="!p-1 text-gray-400 hover:text-error"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Value row */}
      <div className="flex gap-2">
        {renderValueInput()}
        {availableVariables.length > 0 && !isArray && !isObject && (
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowVariables(!showVariables)}
              className="!p-2"
            >
              <Variable className="w-4 h-4" />
            </Button>
            {showVariables && (
              <div className="absolute right-0 top-full mt-1 z-10 p-2 bg-panel-bg border border-node-border rounded-lg shadow-lg min-w-[150px]">
                <div className="text-xs text-gray-400 mb-1">Insert variable</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {availableVariables.map((variable) => (
                    <button
                      key={variable}
                      onClick={() => {
                        onInsertVariable(variable);
                        setShowVariables(false);
                      }}
                      className="w-full text-left px-2 py-1 text-xs font-mono text-primary hover:bg-white/10 rounded"
                    >
                      {variable}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
