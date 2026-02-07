import { memo, useEffect } from 'react';
import { Server, Check } from 'lucide-react';
import { useGovernanceStore } from '../../stores/governanceStore';
import { cn } from '../../utils/cn';

function EnvironmentSwitcherComponent() {
  const { environments, activeEnvironment, loadEnvironments, activateEnvironment } = useGovernanceStore();

  useEffect(() => { loadEnvironments(); }, [loadEnvironments]);

  const envColors: Record<string, string> = { dev: 'bg-green-500', staging: 'bg-yellow-500', prod: 'bg-red-500' };

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
        <Server className="w-4 h-4" /> Environments
      </h3>
      <div className="space-y-2">
        {environments.map((env) => (
          <button key={env.id} onClick={() => activateEnvironment(env.id)} className={cn('w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left', env.isActive ? 'border-primary bg-primary/10' : 'border-border-default bg-bg-surface hover:border-border-default/80')}>
            <div className={cn('w-3 h-3 rounded-full', envColors[env.id] || 'bg-gray-500')} />
            <div className="flex-1">
              <div className="text-sm font-medium text-text-primary">{env.label}</div>
              <div className="text-xs text-text-muted">{env.name}</div>
            </div>
            {env.isActive && <Check className="w-4 h-4 text-primary" />}
          </button>
        ))}
      </div>
    </div>
  );
}

export const EnvironmentSwitcher = memo(EnvironmentSwitcherComponent);
