import { useState, useCallback } from 'react';
import { X, FileText, MessageSquare, GitPullRequest, Globe, Clock } from 'lucide-react';

interface NewWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, template: string) => void;
}

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
}

const templates: Template[] = [
  {
    id: 'blank',
    name: 'Blank Workflow',
    description: 'Start from scratch with an empty workflow',
    icon: <FileText className="w-5 h-5" />,
    category: 'General',
  },
  {
    id: 'slack-notification',
    name: 'Slack Notification',
    description: 'Send messages to Slack channels',
    icon: <MessageSquare className="w-5 h-5" />,
    category: 'Communication',
  },
  {
    id: 'github-pr',
    name: 'GitHub Pull Request',
    description: 'Create and manage GitHub pull requests',
    icon: <GitPullRequest className="w-5 h-5" />,
    category: 'Development',
  },
  {
    id: 'http-request',
    name: 'HTTP Request',
    description: 'Make HTTP API calls and process responses',
    icon: <Globe className="w-5 h-5" />,
    category: 'Integration',
  },
  {
    id: 'scheduled-task',
    name: 'Scheduled Task',
    description: 'Run workflows on a schedule with cron triggers',
    icon: <Clock className="w-5 h-5" />,
    category: 'Automation',
  },
];

export function NewWorkflowDialog({ open, onOpenChange, onCreate }: NewWorkflowDialogProps) {
  const [name, setName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('blank');
  const [error, setError] = useState<string>('');

  const handleCreate = useCallback(() => {
    if (!name.trim()) {
      setError('Workflow name is required');
      return;
    }

    onCreate(name.trim(), selectedTemplate);
    setName('');
    setSelectedTemplate('blank');
    setError('');
    onOpenChange(false);
  }, [name, selectedTemplate, onCreate, onOpenChange]);

  const handleCancel = useCallback(() => {
    setName('');
    setSelectedTemplate('blank');
    setError('');
    onOpenChange(false);
  }, [onOpenChange]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-modal-backdrop backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-modal p-4">
        <div className="bg-bg-elevated border border-border-default rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border-subtle">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Create New Workflow</h2>
              <p className="text-sm text-text-secondary mt-1">
                Choose a template to get started quickly
              </p>
            </div>
            <button
              onClick={handleCancel}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-bg-hover transition-colors text-text-secondary"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Name Input */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Workflow Name <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder="e.g., Daily Standup Reminder"
                className={`w-full px-3 py-2 bg-bg-surface border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 transition-colors ${
                  error
                    ? 'border-error focus:ring-error/50'
                    : 'border-border-default focus:ring-accent/50'
                }`}
                autoFocus
              />
              {error && (
                <p className="text-xs text-error mt-1.5">{error}</p>
              )}
            </div>

            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-3">
                Template
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      selectedTemplate === template.id
                        ? 'border-accent bg-accent-muted'
                        : 'border-border-default hover:border-border-strong bg-bg-surface'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                          selectedTemplate === template.id
                            ? 'bg-accent text-text-inverse'
                            : 'bg-bg-elevated text-text-secondary'
                        }`}
                      >
                        {template.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-medium text-text-primary truncate">
                            {template.name}
                          </h3>
                          {selectedTemplate === template.id && (
                            <div className="flex-shrink-0 w-2 h-2 rounded-full bg-accent" />
                          )}
                        </div>
                        <p className="text-xs text-text-secondary line-clamp-2">
                          {template.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-border-subtle">
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-bg-surface border border-border-default hover:bg-bg-hover text-text-primary rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-text-inverse rounded-lg text-sm font-medium transition-colors"
            >
              Create Workflow
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
