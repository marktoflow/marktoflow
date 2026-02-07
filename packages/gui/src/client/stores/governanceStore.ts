import { create } from 'zustand';

interface Role {
  id: string;
  name: string;
  permissions: string[];
}

interface Environment {
  id: string;
  name: string;
  label: string;
  config: Record<string, string>;
  isActive: boolean;
}

interface AuditEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details: string;
  timestamp: string;
}

interface Secret {
  id: string;
  name: string;
  environment: string;
  maskedValue: string;
  lastRotated: string;
}

interface GovernanceState {
  roles: Role[];
  environments: Environment[];
  activeEnvironment: string;
  auditEntries: AuditEntry[];
  secrets: Secret[];
  isLoading: boolean;

  loadRoles: () => Promise<void>;
  createRole: (name: string, permissions: string[]) => Promise<void>;
  updateRole: (id: string, name: string, permissions: string[]) => Promise<void>;

  loadEnvironments: () => Promise<void>;
  activateEnvironment: (id: string) => Promise<void>;

  loadAudit: (limit?: number) => Promise<void>;

  loadSecrets: () => Promise<void>;
  createSecret: (name: string, environment: string, value: string) => Promise<void>;
}

export const useGovernanceStore = create<GovernanceState>((set, get) => ({
  roles: [],
  environments: [],
  activeEnvironment: 'dev',
  auditEntries: [],
  secrets: [],
  isLoading: false,

  loadRoles: async () => {
    try {
      const res = await fetch('/api/admin/roles');
      const data = await res.json();
      set({ roles: data.roles });
    } catch { /* ignore */ }
  },

  createRole: async (name, permissions) => {
    try {
      await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, permissions }),
      });
      await get().loadRoles();
    } catch { /* ignore */ }
  },

  updateRole: async (id, name, permissions) => {
    try {
      await fetch(`/api/admin/roles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, permissions }),
      });
      await get().loadRoles();
    } catch { /* ignore */ }
  },

  loadEnvironments: async () => {
    try {
      const res = await fetch('/api/admin/environments');
      const data = await res.json();
      const active = data.environments.find((e: Environment) => e.isActive);
      set({ environments: data.environments, activeEnvironment: active?.id || 'dev' });
    } catch { /* ignore */ }
  },

  activateEnvironment: async (id) => {
    try {
      await fetch(`/api/admin/environments/${id}/activate`, { method: 'POST' });
      set({ activeEnvironment: id });
      await get().loadEnvironments();
    } catch { /* ignore */ }
  },

  loadAudit: async (limit = 50) => {
    try {
      const res = await fetch(`/api/admin/audit?limit=${limit}`);
      const data = await res.json();
      set({ auditEntries: data.entries });
    } catch { /* ignore */ }
  },

  loadSecrets: async () => {
    try {
      const res = await fetch('/api/admin/secrets');
      const data = await res.json();
      set({ secrets: data.secrets });
    } catch { /* ignore */ }
  },

  createSecret: async (name, environment, value) => {
    try {
      await fetch('/api/admin/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, environment, value }),
      });
      await get().loadSecrets();
    } catch { /* ignore */ }
  },
}));
