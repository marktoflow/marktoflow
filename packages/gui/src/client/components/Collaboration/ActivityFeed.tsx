import { memo } from 'react';
import { Activity, Edit, Play, MessageSquare, Lock, User } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ActivityItem {
  id: string;
  author: string;
  action: string;
  details: string;
  createdAt: string;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  className?: string;
}

const actionIcons: Record<string, typeof Activity> = {
  edit: Edit,
  execute: Play,
  comment: MessageSquare,
  lock: Lock,
};

function ActivityFeedComponent({ activities, className }: ActivityFeedProps) {
  return (
    <div className={cn('space-y-1 p-3', className)}>
      {activities.length === 0 ? (
        <div className="text-center py-6 text-sm text-text-muted">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No activity yet
        </div>
      ) : (
        activities.map((item) => {
          const Icon = actionIcons[item.action] || Activity;
          return (
            <div key={item.id} className="flex items-start gap-3 py-2 border-b border-border-default last:border-0">
              <div className="w-6 h-6 rounded-full bg-bg-surface flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon className="w-3.5 h-3.5 text-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text-primary">
                  <span className="font-medium">{item.author}</span>{' '}
                  <span className="text-text-secondary">{item.details}</span>
                </div>
                <div className="text-xs text-text-muted">{new Date(item.createdAt).toLocaleString()}</div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export const ActivityFeed = memo(ActivityFeedComponent);
