import { memo, useState, useCallback } from 'react';
import { type Node, type NodeProps, NodeResizer } from '@xyflow/react';
import { StickyNote, Palette } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface StickyNoteNodeData extends Record<string, unknown> {
  id: string;
  text: string;
  color: 'yellow' | 'blue' | 'green' | 'pink' | 'purple' | 'orange';
  author?: string;
  createdAt?: string;
}

export type StickyNoteNodeType = Node<StickyNoteNodeData, 'sticky'>;

const colorClasses: Record<StickyNoteNodeData['color'], { bg: string; border: string; text: string }> = {
  yellow: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-200' },
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-200' },
  green: { bg: 'bg-green-500/20', border: 'border-green-500/40', text: 'text-green-200' },
  pink: { bg: 'bg-pink-500/20', border: 'border-pink-500/40', text: 'text-pink-200' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-200' },
  orange: { bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-200' },
};

const allColors: StickyNoteNodeData['color'][] = ['yellow', 'blue', 'green', 'pink', 'purple', 'orange'];

function StickyNoteNodeComponent({ data, selected }: NodeProps<StickyNoteNodeType>) {
  const [isEditing, setIsEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const color = data.color || 'yellow';
  const colors = colorClasses[color];

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // The parent canvas would need to handle data updates via updateNodeData
    // For now, we just display the text
  }, []);

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={150}
        minHeight={100}
        lineClassName="!border-primary"
        handleClassName="!bg-primary !border-primary !w-2 !h-2"
      />
      <div
        className={cn(
          'rounded-lg border-2 p-3 min-w-[150px] min-h-[100px] transition-shadow',
          colors.bg,
          colors.border,
          selected && 'shadow-lg ring-2 ring-primary/30'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <StickyNote className={cn('w-3.5 h-3.5', colors.text)} />
            <span className={cn('text-xs font-medium', colors.text)}>Note</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Change color"
          >
            <Palette className="w-3 h-3 text-text-muted" />
          </button>
        </div>

        {/* Color picker */}
        {showColorPicker && (
          <div className="flex gap-1 mb-2 p-1 bg-bg-panel rounded border border-border-default">
            {allColors.map((c) => (
              <button
                key={c}
                onClick={(e) => { e.stopPropagation(); setShowColorPicker(false); }}
                className={cn(
                  'w-5 h-5 rounded-full border-2 transition-transform',
                  colorClasses[c].bg,
                  c === color ? 'border-white scale-110' : 'border-transparent hover:scale-110'
                )}
                title={c}
              />
            ))}
          </div>
        )}

        {/* Content */}
        {isEditing ? (
          <textarea
            defaultValue={data.text || ''}
            onChange={handleTextChange}
            onBlur={() => setIsEditing(false)}
            autoFocus
            className="w-full bg-transparent text-sm text-text-primary resize-none focus:outline-none min-h-[60px]"
            placeholder="Type a note..."
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className="text-sm text-text-primary whitespace-pre-wrap min-h-[60px] cursor-text"
          >
            {data.text || 'Double-click to edit...'}
          </div>
        )}

        {/* Author/timestamp */}
        {data.author && (
          <div className="mt-2 text-xs text-text-muted">
            {data.author}
          </div>
        )}
      </div>
    </>
  );
}

export const StickyNoteNode = memo(StickyNoteNodeComponent);
