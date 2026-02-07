import { memo } from 'react';
import { FolderOpen } from 'lucide-react';
import { cn } from '../../utils/cn';

interface TemplateCardProps {
  name: string;
  description: string;
  category: string;
  tags: string[];
  onClick: () => void;
  className?: string;
}

function TemplateCardComponent({ name, description, category, tags, onClick, className }: TemplateCardProps) {
  return (
    <button onClick={onClick} className={cn('p-4 bg-bg-surface border border-border-default rounded-lg hover:border-primary transition-all text-left group hover:shadow-lg', className)}>
      <div className="flex items-center gap-2 mb-2">
        <FolderOpen className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-text-primary group-hover:text-primary">{name}</span>
        <span className="ml-auto text-xs text-text-muted capitalize px-1.5 py-0.5 bg-bg-hover rounded">{category}</span>
      </div>
      <p className="text-xs text-text-secondary mb-3 line-clamp-2">{description}</p>
      <div className="flex flex-wrap gap-1">
        {tags.slice(0, 4).map((tag) => (
          <span key={tag} className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">{tag}</span>
        ))}
      </div>
    </button>
  );
}

export const TemplateCard = memo(TemplateCardComponent);
