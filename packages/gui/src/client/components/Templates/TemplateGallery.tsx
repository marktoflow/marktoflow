import { memo, useState, useEffect } from 'react';
import { Search, LayoutTemplate, FolderOpen } from 'lucide-react';
import { cn } from '../../utils/cn';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
}

interface TemplateGalleryProps {
  onSelect: (templateId: string) => void;
  className?: string;
}

function TemplateGalleryComponent({ onSelect, className }: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/templates').then((r) => r.json()).then((d) => setTemplates(d.templates || [])).catch(() => {});
  }, []);

  const categories = [...new Set(templates.map((t) => t.category))];
  const filtered = templates.filter((t) => {
    if (category && t.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tags.some((tag) => tag.includes(q));
    }
    return true;
  });

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="p-4 border-b border-border-default space-y-3">
        <h2 className="text-lg font-medium text-text-primary flex items-center gap-2">
          <LayoutTemplate className="w-5 h-5" /> Template Gallery
        </h2>
        <div className="flex items-center gap-2 bg-bg-surface border border-border-default rounded px-3">
          <Search className="w-4 h-4 text-text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." className="flex-1 bg-transparent py-2 text-sm text-text-primary focus:outline-none" />
        </div>
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setCategory(null)} className={cn('px-2.5 py-1 text-xs rounded-full transition-colors', !category ? 'bg-primary/20 text-primary' : 'bg-bg-hover text-text-muted hover:text-text-primary')}>All</button>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)} className={cn('px-2.5 py-1 text-xs rounded-full transition-colors capitalize', category === cat ? 'bg-primary/20 text-primary' : 'bg-bg-hover text-text-muted hover:text-text-primary')}>{cat}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((template) => (
          <button key={template.id} onClick={() => onSelect(template.id)} className="p-4 bg-bg-surface border border-border-default rounded-lg hover:border-primary transition-colors text-left group">
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors">{template.name}</span>
            </div>
            <p className="text-xs text-text-secondary mb-3">{template.description}</p>
            <div className="flex flex-wrap gap-1">
              {template.tags.map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 text-xs bg-bg-hover text-text-muted rounded">{tag}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export const TemplateGallery = memo(TemplateGalleryComponent);
