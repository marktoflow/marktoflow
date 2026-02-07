import { memo } from 'react';
import { cn } from '../../utils/cn';

interface PresenceUser {
  userId: string;
  userName: string;
  color: string;
}

interface PresenceIndicatorProps {
  users: PresenceUser[];
  className?: string;
  maxVisible?: number;
}

function PresenceIndicatorComponent({ users, className, maxVisible = 4 }: PresenceIndicatorProps) {
  if (users.length === 0) return null;

  const visible = users.slice(0, maxVisible);
  const overflow = users.length - maxVisible;

  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {visible.map((user) => (
        <div
          key={user.userId}
          className="w-7 h-7 rounded-full border-2 border-bg-panel flex items-center justify-center text-xs font-medium text-white"
          style={{ backgroundColor: user.color }}
          title={user.userName}
        >
          {user.userName.charAt(0).toUpperCase()}
        </div>
      ))}
      {overflow > 0 && (
        <div className="w-7 h-7 rounded-full border-2 border-bg-panel bg-bg-surface flex items-center justify-center text-xs text-text-muted">
          +{overflow}
        </div>
      )}
    </div>
  );
}

export const PresenceIndicator = memo(PresenceIndicatorComponent);
