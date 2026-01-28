import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { usePromptStore } from '../../stores/promptStore';
import { PromptHistoryPanel } from './PromptHistoryPanel';
import { getModKey } from '../../utils/platform';

export function PromptInput() {
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isProcessing, history, sendPrompt } = usePromptStore();
  const modKey = getModKey();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [prompt]);

  const handleSubmit = async () => {
    if (!prompt.trim() || isProcessing) return;

    await sendPrompt(prompt);
    setPrompt('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'ArrowUp' && !prompt && history.length > 0) {
      setPrompt(history[0].prompt);
    }
  };

  const suggestions = [
    'Add a Slack notification step',
    'Add error handling with 3 retries',
    'Convert to a sub-workflow',
    'Add a condition to skip if draft',
  ];

  return (
    <div className="bg-panel-bg">
      {/* History Panel */}
      <PromptHistoryPanel onSelectPrompt={setPrompt} />

      {/* Suggestions */}
      {!prompt && !isProcessing && (
        <div className="px-4 py-2 border-t border-node-border/50">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setPrompt(suggestion)}
                className="px-3 py-1 bg-node-bg border border-node-border rounded-full text-xs text-gray-300 hover:border-primary hover:text-primary transition-colors whitespace-nowrap"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 flex items-end gap-3 border-t border-node-border">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the changes you want to make to the workflow..."
            disabled={isProcessing}
            rows={1}
            className="w-full px-4 py-3 bg-node-bg border border-node-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary resize-none disabled:opacity-50"
          />
          {isProcessing && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!prompt.trim() || isProcessing}
          className="w-10 h-10 rounded-lg bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        >
          <Send className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Keyboard hint */}
      <div className="px-4 pb-2 text-xs text-gray-500">
        Press <kbd className="px-1.5 py-0.5 bg-node-bg rounded text-gray-400">{modKey}</kbd> +{' '}
        <kbd className="px-1.5 py-0.5 bg-node-bg rounded text-gray-400">Enter</kbd> to send
        {history.length > 0 && (
          <span className="ml-4">
            <kbd className="px-1.5 py-0.5 bg-node-bg rounded text-gray-400">↑</kbd> for last prompt
          </span>
        )}
      </div>
    </div>
  );
}
