import { describe, it, expect } from 'vitest';
import {
  mergePermissions,
  checkPermission,
  toSecurityPolicy,
  createDefaultPermissions,
  type EffectivePermissions,
} from '../src/permissions.js';
import type { Permissions } from '../src/models.js';

describe('mergePermissions', () => {
  it('should return default permissions when both are undefined', () => {
    const result = mergePermissions(undefined, undefined);

    expect(result.read).toBe(true);
    expect(result.write).toBe(true);
    expect(result.execute).toBe(true);
    expect(result.network).toBe(true);
    expect(result.blockedCommands).toEqual([]);
    expect(result.allowedCommands).toEqual([]);
  });

  it('should apply workflow-level permissions', () => {
    const workflow: Permissions = {
      read: true,
      write: ['./output/**'],
      network: false,
    };

    const result = mergePermissions(workflow, undefined);

    expect(result.read).toBe(true);
    expect(result.write).toEqual(['./output/**']);
    expect(result.network).toBe(false);
  });

  it('should override workflow permissions with step permissions', () => {
    const workflow: Permissions = {
      read: true,
      write: ['./output/**'],
      network: true,
    };

    const step: Permissions = {
      write: false, // More restrictive
      network: false,
    };

    const result = mergePermissions(workflow, step);

    expect(result.read).toBe(true); // Inherited from workflow
    expect(result.write).toBe(false); // Step override
    expect(result.network).toBe(false); // Step override
  });

  it('should merge blocked commands from both levels', () => {
    const workflow: Permissions = {
      blockedCommands: ['rm -rf', 'sudo'],
    };

    const step: Permissions = {
      blockedCommands: ['chmod', 'chown'],
    };

    const result = mergePermissions(workflow, step);

    expect(result.blockedCommands).toContain('rm -rf');
    expect(result.blockedCommands).toContain('sudo');
    expect(result.blockedCommands).toContain('chmod');
    expect(result.blockedCommands).toContain('chown');
  });

  it('should use minimum maxFileSize (most restrictive)', () => {
    const workflow: Permissions = {
      maxFileSize: 10000,
    };

    const step: Permissions = {
      maxFileSize: 5000,
    };

    const result = mergePermissions(workflow, step);

    expect(result.maxFileSize).toBe(5000);
  });
});

describe('checkPermission', () => {
  describe('read operations', () => {
    it('should allow read when read is true', () => {
      const perms: EffectivePermissions = {
        ...createDefaultPermissions(),
        read: true,
      };

      const result = checkPermission(perms, 'read', './file.txt');
      expect(result.allowed).toBe(true);
    });

    it('should deny read when read is false', () => {
      const perms: EffectivePermissions = {
        ...createDefaultPermissions(),
        read: false,
      };

      const result = checkPermission(perms, 'read', './file.txt');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('disabled');
    });

    it('should allow read when path matches pattern', () => {
      const perms: EffectivePermissions = {
        ...createDefaultPermissions(),
        read: ['./src/**/*.ts', './tests/**/*.ts'],
      };

      const result1 = checkPermission(perms, 'read', './src/index.ts');
      expect(result1.allowed).toBe(true);

      const result2 = checkPermission(perms, 'read', './tests/foo.test.ts');
      expect(result2.allowed).toBe(true);

      const result3 = checkPermission(perms, 'read', './dist/index.js');
      expect(result3.allowed).toBe(false);
    });

    it('should deny read when path is blocked', () => {
      const perms: EffectivePermissions = {
        ...createDefaultPermissions(),
        read: true,
        blockedPaths: ['.env', '**/.git/**'],
      };

      const result = checkPermission(perms, 'read', '.env');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('blocked');
    });
  });

  describe('write operations', () => {
    it('should allow write when write is true', () => {
      const perms: EffectivePermissions = {
        ...createDefaultPermissions(),
        write: true,
      };

      const result = checkPermission(perms, 'write', './output.txt');
      expect(result.allowed).toBe(true);
    });

    it('should deny write when write is false', () => {
      const perms: EffectivePermissions = {
        ...createDefaultPermissions(),
        write: false,
      };

      const result = checkPermission(perms, 'write', './output.txt');
      expect(result.allowed).toBe(false);
    });

    it('should restrict write to allowed directories', () => {
      const perms: EffectivePermissions = {
        ...createDefaultPermissions(),
        write: true,
        allowedDirectories: ['./output', './tmp'],
      };

      const result1 = checkPermission(perms, 'write', './output/file.txt');
      expect(result1.allowed).toBe(true);

      const result2 = checkPermission(perms, 'write', './src/index.ts');
      expect(result2.allowed).toBe(false);
    });
  });

  describe('execute operations', () => {
    it('should allow execute when execute is true', () => {
      const perms: EffectivePermissions = {
        ...createDefaultPermissions(),
        execute: true,
      };

      const result = checkPermission(perms, 'execute', 'npm test');
      expect(result.allowed).toBe(true);
    });

    it('should deny execute when execute is false', () => {
      const perms: EffectivePermissions = {
        ...createDefaultPermissions(),
        execute: false,
      };

      const result = checkPermission(perms, 'execute', 'npm test');
      expect(result.allowed).toBe(false);
    });

    it('should block specific commands', () => {
      const perms: EffectivePermissions = {
        ...createDefaultPermissions(),
        execute: true,
        blockedCommands: ['rm -rf', 'sudo'],
      };

      const result1 = checkPermission(perms, 'execute', 'rm -rf /');
      expect(result1.allowed).toBe(false);

      const result2 = checkPermission(perms, 'execute', 'sudo apt install');
      expect(result2.allowed).toBe(false);

      const result3 = checkPermission(perms, 'execute', 'npm test');
      expect(result3.allowed).toBe(true);
    });

    it('should only allow specified commands', () => {
      const perms: EffectivePermissions = {
        ...createDefaultPermissions(),
        execute: true,
        allowedCommands: ['npm test', 'npm run build'],
      };

      const result1 = checkPermission(perms, 'execute', 'npm test');
      expect(result1.allowed).toBe(true);

      const result2 = checkPermission(perms, 'execute', 'rm -rf');
      expect(result2.allowed).toBe(false);
    });
  });

  describe('network operations', () => {
    it('should allow network when network is true', () => {
      const perms: EffectivePermissions = {
        ...createDefaultPermissions(),
        network: true,
      };

      const result = checkPermission(perms, 'network', 'api.example.com');
      expect(result.allowed).toBe(true);
    });

    it('should deny network when network is false', () => {
      const perms: EffectivePermissions = {
        ...createDefaultPermissions(),
        network: false,
      };

      const result = checkPermission(perms, 'network', 'api.example.com');
      expect(result.allowed).toBe(false);
    });

    it('should restrict to allowed hosts', () => {
      const perms: EffectivePermissions = {
        ...createDefaultPermissions(),
        network: true,
        allowedHosts: ['api.example.com', '*.github.com'],
      };

      const result1 = checkPermission(perms, 'network', 'api.example.com');
      expect(result1.allowed).toBe(true);

      const result2 = checkPermission(perms, 'network', 'raw.github.com');
      expect(result2.allowed).toBe(true);

      const result3 = checkPermission(perms, 'network', 'evil.com');
      expect(result3.allowed).toBe(false);
    });
  });
});

describe('toSecurityPolicy', () => {
  it('should create a security policy from permissions', () => {
    const perms: EffectivePermissions = {
      read: true,
      write: ['./output/**'],
      execute: true,
      allowedCommands: [],
      blockedCommands: ['rm -rf'],
      allowedDirectories: [],
      blockedPaths: ['.env'],
      network: true,
      allowedHosts: ['api.example.com'],
      maxFileSize: 10000,
    };

    const policy = toSecurityPolicy(perms);

    // Test read
    expect(policy.allowFileRead('./src/index.ts').allowed).toBe(true);
    expect(policy.allowFileRead('.env').allowed).toBe(false);

    // Test write
    expect(policy.allowFileWrite('./output/result.json').allowed).toBe(true);
    expect(policy.allowFileWrite('./src/index.ts').allowed).toBe(false);

    // Test execute
    expect(policy.allowCommand('npm test').allowed).toBe(true);
    expect(policy.allowCommand('rm -rf /').allowed).toBe(false);

    // Test network
    expect(policy.allowNetwork('api.example.com').allowed).toBe(true);
    expect(policy.allowNetwork('evil.com').allowed).toBe(false);

    // Test maxFileSize
    expect(policy.maxFileSize).toBe(10000);
  });
});

describe('createDefaultPermissions', () => {
  it('should return fully permissive defaults', () => {
    const perms = createDefaultPermissions();

    expect(perms.read).toBe(true);
    expect(perms.write).toBe(true);
    expect(perms.execute).toBe(true);
    expect(perms.network).toBe(true);
    expect(perms.allowedCommands).toEqual([]);
    expect(perms.blockedCommands).toEqual([]);
    expect(perms.allowedDirectories).toEqual([]);
    expect(perms.blockedPaths).toEqual([]);
    expect(perms.allowedHosts).toEqual([]);
    expect(perms.maxFileSize).toBeUndefined();
  });
});
