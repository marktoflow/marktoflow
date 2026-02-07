import { memo, useEffect, useState } from 'react';
import { Key, Plus, Eye, EyeOff, RotateCw } from 'lucide-react';
import { useGovernanceStore } from '../../stores/governanceStore';

function SecretsVaultComponent() {
  const { secrets, loadSecrets, createSecret } = useGovernanceStore();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');

  useEffect(() => { loadSecrets(); }, [loadSecrets]);

  const handleCreate = () => {
    if (!name.trim() || !value.trim()) return;
    createSecret(name, 'dev', value);
    setName(''); setValue(''); setShowForm(false);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
          <Key className="w-4 h-4" /> Secrets
        </h3>
        <button onClick={() => setShowForm(!showForm)} className="p-1.5 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {showForm && (
        <div className="p-3 bg-bg-surface rounded-lg border border-border-default space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Secret name" className="w-full bg-transparent border border-border-default rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
          <input type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Secret value" className="w-full bg-transparent border border-border-default rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
          <button onClick={handleCreate} className="w-full px-3 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90">Add Secret</button>
        </div>
      )}
      <div className="space-y-2">
        {secrets.map((secret) => (
          <div key={secret.id} className="flex items-center gap-3 p-3 bg-bg-surface rounded-lg border border-border-default">
            <Key className="w-4 h-4 text-warning flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary">{secret.name}</div>
              <div className="text-xs font-mono text-text-muted">{secret.maskedValue}</div>
            </div>
            <span className="text-xs text-text-muted">{secret.environment}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const SecretsVault = memo(SecretsVaultComponent);
