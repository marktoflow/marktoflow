import { useState } from 'react';
import {
  History,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  RefreshCw,
  Trash2,
  Clock,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { usePromptStore, type PromptHistoryItem } from '../../stores/promptStore';
import { Button } from '../common/Button';

interface PromptHistoryPanelProps {
  onSelectPrompt?: (prompt: string) => void;
}

export function PromptHistoryPanel({ onSelectPrompt }: PromptHistoryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PromptHistoryItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { history, clearHistory, sendPrompt, isProcessing } = usePromptStore();

  const handleRerun = async (prompt: string) => {
    if (isProcessing) return;
    await sendPrompt(prompt);
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(date).toLocaleDateString();
  };

  if (history.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-node-border">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 bg-panel-bg hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">Prompt History</span>
          <span className="text-xs text-gray-500">({history.length})</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="bg-panel-bg">
          {/* Action bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-node-border">
            <span className="text-xs text-gray-500">
              {history.filter((h) => h.success).length} successful,{' '}
              {history.filter((h) => !h.success).length} failed
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              icon={<Trash2 className="w-3 h-3" />}
            >
              Clear
            </Button>
          </div>

          {/* History list */}
          <div className="max-h-64 overflow-y-auto">
            {history.map((item, index) => {
              const itemId = `${index}-${item.timestamp}`;
              const isSelected = selectedItem === item;

              return (
                <div
                  key={itemId}
                  className="border-b border-node-border last:border-b-0"
                >
                  {/* Item header */}
                  <div
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/10' : 'hover:bg-white/5'
                    }`}
                    onClick={() => setSelectedItem(isSelected ? null : item)}
                  >
                    {/* Status icon */}
                    {item.success ? (
                      <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-300 line-clamp-2">
                        {item.prompt}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-500">
                          {formatTime(item.timestamp)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(item.prompt, itemId);
                        }}
                        className="p-1.5 hover:bg-white/10 rounded transition-colors"
                        title="Copy prompt"
                      >
                        {copiedId === itemId ? (
                          <Check className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRerun(item.prompt);
                        }}
                        disabled={isProcessing}
                        className="p-1.5 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
                        title="Re-run prompt"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${isProcessing ? 'animate-spin' : ''}`} />
                      </button>
                      {onSelectPrompt && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPrompt(item.prompt);
                          }}
                          className="p-1.5 hover:bg-white/10 rounded transition-colors"
                          title="Edit prompt"
                        >
                          <span className="text-xs text-gray-400">Edit</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isSelected && (
                    <div className="px-4 pb-3 pl-11">
                      <div className="bg-node-bg rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-500 uppercase">
                            Response
                          </span>
                          <button
                            onClick={() => handleCopy(item.response, `${itemId}-response`)}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                          >
                            {copiedId === `${itemId}-response` ? (
                              <Check className="w-3 h-3 text-success" />
                            ) : (
                              <Copy className="w-3 h-3 text-gray-400" />
                            )}
                          </button>
                        </div>
                        <div className={`text-xs font-mono ${item.success ? 'text-gray-300' : 'text-error'}`}>
                          {item.response || 'No response'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
