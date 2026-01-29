import { memo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface CollapsibleGroupHeaderProps {
  label: string;
  color: string;
  collapsed: boolean;
  stepCount: number;
  icon?: React.ReactNode;
  onToggle: () => void;
}

function CollapsibleGroupHeaderComponent({
  label,
  color,
  collapsed,
  stepCount,
  icon,
  onToggle,
}: CollapsibleGroupHeaderProps) {
  return (
    <div
      className="flex items-center gap-2 p-2 cursor-pointer select-none hover:bg-white/5 transition-colors rounded"
      onClick={onToggle}
    >
      {/* Chevron icon */}
      <button
        className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 transition-colors"
        style={{ color }}
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Optional custom icon */}
      {icon && (
        <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          {icon}
        </div>
      )}

      {/* Label */}
      <div className="flex-1 text-xs font-medium text-white/90">
        {label}
      </div>

      {/* Step count badge */}
      <div
        className="px-2 py-0.5 rounded text-[10px] font-medium"
        style={{
          backgroundColor: `${color}20`,
          color: color,
        }}
      >
        {stepCount} step{stepCount !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

export const CollapsibleGroupHeader = memo(CollapsibleGroupHeaderComponent);
