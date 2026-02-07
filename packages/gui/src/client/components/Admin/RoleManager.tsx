import { memo, useEffect, useState } from 'react';
import { Shield, Plus, Edit, Trash2 } from 'lucide-react';
import { useGovernanceStore } from '../../stores/governanceStore';
import { cn } from '../../utils/cn';

function RoleManagerComponent() {
  const { roles, loadRoles, createRole, updateRole } = useGovernanceStore();
  const [newRoleName, setNewRoleName] = useState('');

  useEffect(() => { loadRoles(); }, [loadRoles]);

  const handleCreate = () => {
    if (!newRoleName.trim()) return;
    createRole(newRoleName, []);
    setNewRoleName('');
  };

  const allPermissions = ['workflow:read', 'workflow:write', 'workflow:execute', 'workflow:delete', 'admin:read', 'admin:write'];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
          <Shield className="w-4 h-4" /> Roles
        </h3>
      </div>
      <div className="flex gap-2">
        <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} placeholder="New role name..." className="flex-1 bg-bg-surface border border-border-default rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
        <button onClick={handleCreate} className="px-3 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90"><Plus className="w-4 h-4" /></button>
      </div>
      <div className="space-y-2">
        {roles.map((role) => (
          <div key={role.id} className="p-3 bg-bg-surface rounded-lg border border-border-default">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-primary">{role.name}</span>
              <span className="text-xs text-text-muted">{role.permissions.length} permissions</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {allPermissions.map((perm) => (
                <button key={perm} onClick={() => {
                  const perms = role.permissions.includes(perm) ? role.permissions.filter((p) => p !== perm) : [...role.permissions, perm];
                  updateRole(role.id, role.name, perms);
                }} className={cn('px-2 py-0.5 text-xs rounded-full border transition-colors', role.permissions.includes(perm) || role.permissions.includes('*') ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-bg-hover border-border-default text-text-muted hover:text-text-primary')}>
                  {perm}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const RoleManager = memo(RoleManagerComponent);
