import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface InlineEditorProps {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  multiline?: boolean;
  disabled?: boolean;
}

function InlineEditorComponent({
  value,
  onSave,
  placeholder = 'Click to edit...',
  className,
  inputClassName,
  multiline = false,
  disabled = false,
}: InlineEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    if (editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
  }, [editValue, value, onSave]);

  const handleCancel = useCallback(() => {
    setEditValue(value);
    setIsEditing(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !multiline) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel, multiline]
  );

  if (disabled) {
    return (
      <div className={cn('text-sm text-text-muted', className)}>
        {value || placeholder}
      </div>
    );
  }

  if (!isEditing) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
        className={cn(
          'text-sm text-left w-full rounded px-1 -mx-1 py-0.5 transition-colors',
          'hover:bg-bg-hover text-text-primary cursor-text',
          !value && 'text-text-muted italic',
          className
        )}
        title="Click to edit"
      >
        {value || placeholder}
      </button>
    );
  }

  const InputComponent = multiline ? 'textarea' : 'input';

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <InputComponent
        ref={inputRef as any}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        className={cn(
          'flex-1 bg-bg-surface border border-primary rounded px-2 py-1 text-sm text-text-primary',
          'focus:outline-none focus:ring-1 focus:ring-primary',
          multiline && 'min-h-[60px] resize-y',
          inputClassName
        )}
        placeholder={placeholder}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex flex-col gap-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); handleSave(); }}
          className="p-1 rounded hover:bg-success/20 text-success"
          title="Save"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleCancel(); }}
          className="p-1 rounded hover:bg-error/20 text-error"
          title="Cancel"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export const InlineEditor = memo(InlineEditorComponent);
