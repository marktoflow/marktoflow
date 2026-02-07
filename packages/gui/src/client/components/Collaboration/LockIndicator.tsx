import { memo } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { cn } from '../../utils/cn';

interface LockIndicatorProps {
  isLocked: boolean;
  lockedBy?: string;
  expiresAt?: string;
  onUnlock?: () => void;
  className?: string;
}

function LockIndicatorComponent({ isLocked, lockedBy, expiresAt, onUnlock, className }: LockIndicatorProps) {
  if (!isLocked) return null;

  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full text-xs', 'bg-warning/10 text-warning', className)}>
      <Lock className="w-3.5 h-3.5" />
      <span>Locked by {lockedBy || 'unknown'}</span>
      {onUnlock && (
        <button onClick={onUnlock} className="ml-1 p-0.5 rounded hover:bg-warning/20" title="Force unlock">
          <Unlock className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export const LockIndicator = memo(LockIndicatorComponent);
