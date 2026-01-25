import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  id: string;
  name: string;
  path?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (item: BreadcrumbItem, index: number) => void;
}

export function Breadcrumb({ items, onNavigate }: BreadcrumbProps) {
  if (items.length <= 1) {
    return null;
  }

  return (
    <nav className="flex items-center gap-1 px-4 py-2 bg-panel-bg border-b border-node-border">
      {items.map((item, index) => (
        <div key={item.id} className="flex items-center">
          {index > 0 && <ChevronRight className="w-4 h-4 text-gray-600 mx-1" />}
          <button
            onClick={() => onNavigate(item, index)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors ${
              index === items.length - 1
                ? 'text-white font-medium cursor-default'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            disabled={index === items.length - 1}
          >
            {index === 0 && <Home className="w-3.5 h-3.5" />}
            <span className="max-w-[150px] truncate">{item.name}</span>
          </button>
        </div>
      ))}
    </nav>
  );
}
