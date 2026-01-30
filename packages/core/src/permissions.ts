/**
 * Permissions module for marktoflow v2.0
 *
 * Provides permission merging and enforcement utilities for step-level
 * and workflow-level permission restrictions.
 */

import { Permissions } from './models.js';
import { minimatch } from 'minimatch';

// ============================================================================
// Types
// ============================================================================

export interface EffectivePermissions {
  // File operations (resolved to arrays of glob patterns)
  read: string[] | boolean;
  write: string[] | boolean;

  // Command execution
  execute: string[] | boolean;
  allowedCommands: string[];
  blockedCommands: string[];

  // Directory restrictions
  allowedDirectories: string[];
  blockedPaths: string[];

  // Network
  network: boolean;
  allowedHosts: string[];

  // Limits
  maxFileSize: number | undefined;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

export type OperationType = 'read' | 'write' | 'execute' | 'network';

// ============================================================================
// Permission Merging
// ============================================================================

/**
 * Merge workflow-level and step-level permissions.
 * Step permissions override workflow permissions, with most restrictive winning.
 */
export function mergePermissions(
  workflow?: Permissions,
  step?: Permissions
): EffectivePermissions {
  // Start with defaults (most permissive)
  const effective: EffectivePermissions = {
    read: true,
    write: true,
    execute: true,
    allowedCommands: [],
    blockedCommands: [],
    allowedDirectories: [],
    blockedPaths: [],
    network: true,
    allowedHosts: [],
    maxFileSize: undefined,
  };

  // Apply workflow-level permissions first
  if (workflow) {
    applyPermissions(effective, workflow);
  }

  // Apply step-level permissions (overrides workflow)
  if (step) {
    applyPermissions(effective, step);
  }

  return effective;
}

/**
 * Apply a permission configuration to effective permissions.
 */
function applyPermissions(effective: EffectivePermissions, perms: Permissions): void {
  if (!perms) return;

  // File operations
  if (perms.read !== undefined) {
    effective.read = perms.read;
  }
  if (perms.write !== undefined) {
    effective.write = perms.write;
  }

  // Command execution
  if (perms.execute !== undefined) {
    effective.execute = perms.execute;
  }
  if (perms.allowedCommands) {
    // Merge allowed commands (union)
    effective.allowedCommands = [
      ...new Set([...effective.allowedCommands, ...perms.allowedCommands]),
    ];
  }
  if (perms.blockedCommands) {
    // Merge blocked commands (union)
    effective.blockedCommands = [
      ...new Set([...effective.blockedCommands, ...perms.blockedCommands]),
    ];
  }

  // Directory restrictions
  if (perms.allowedDirectories) {
    effective.allowedDirectories = [
      ...new Set([...effective.allowedDirectories, ...perms.allowedDirectories]),
    ];
  }
  if (perms.blockedPaths) {
    effective.blockedPaths = [
      ...new Set([...effective.blockedPaths, ...perms.blockedPaths]),
    ];
  }

  // Network
  if (perms.network !== undefined) {
    effective.network = perms.network;
  }
  if (perms.allowedHosts) {
    effective.allowedHosts = [
      ...new Set([...effective.allowedHosts, ...perms.allowedHosts]),
    ];
  }

  // Limits (most restrictive wins)
  if (perms.maxFileSize !== undefined) {
    if (effective.maxFileSize === undefined) {
      effective.maxFileSize = perms.maxFileSize;
    } else {
      effective.maxFileSize = Math.min(effective.maxFileSize, perms.maxFileSize);
    }
  }
}

// ============================================================================
// Permission Checking
// ============================================================================

/**
 * Check if an operation is permitted.
 */
export function checkPermission(
  perms: EffectivePermissions,
  operation: OperationType,
  target?: string
): PermissionCheckResult {
  switch (operation) {
    case 'read':
      return checkFilePermission(perms.read, target, 'read', perms);

    case 'write':
      return checkFilePermission(perms.write, target, 'write', perms);

    case 'execute':
      return checkExecutePermission(perms, target);

    case 'network':
      return checkNetworkPermission(perms, target);

    default:
      return { allowed: false, reason: `Unknown operation: ${operation}` };
  }
}

/**
 * Check file operation permission (read/write).
 */
function checkFilePermission(
  permission: string[] | boolean,
  target: string | undefined,
  operation: string,
  perms: EffectivePermissions
): PermissionCheckResult {
  // If permission is false, deny all
  if (!permission) {
    return { allowed: false, reason: `${operation} operations are disabled` };
  }

  // If permission is true and no target, allow
  if (permission === true && !target) {
    return { allowed: true };
  }

  // Check blocked paths first
  if (target && perms.blockedPaths.length > 0) {
    for (const blocked of perms.blockedPaths) {
      if (matchPath(target, blocked)) {
        return { allowed: false, reason: `Path is blocked: ${blocked}` };
      }
    }
  }

  // Check allowed directories if specified
  if (target && perms.allowedDirectories.length > 0) {
    const inAllowedDir = perms.allowedDirectories.some((dir) =>
      target.startsWith(dir) || matchPath(target, dir + '/**')
    );
    if (!inAllowedDir) {
      return { allowed: false, reason: `Path not in allowed directories` };
    }
  }

  // If permission is an array, check if target matches any pattern
  if (Array.isArray(permission)) {
    if (!target) {
      return { allowed: true }; // No specific target, allow
    }

    const matches = permission.some((pattern) => matchPath(target, pattern));
    if (!matches) {
      return { allowed: false, reason: `Path does not match allowed patterns for ${operation}` };
    }
  }

  return { allowed: true };
}

/**
 * Check execute permission for a command.
 */
function checkExecutePermission(
  perms: EffectivePermissions,
  command?: string
): PermissionCheckResult {
  // If execute is false, deny all
  if (perms.execute === false) {
    return { allowed: false, reason: 'Command execution is disabled' };
  }

  if (!command) {
    return { allowed: true };
  }

  // Check blocked commands first
  if (perms.blockedCommands.length > 0) {
    for (const blocked of perms.blockedCommands) {
      if (commandMatches(command, blocked)) {
        return { allowed: false, reason: `Command is blocked: ${blocked}` };
      }
    }
  }

  // If execute is an array of allowed commands
  if (Array.isArray(perms.execute)) {
    const matches = perms.execute.some((allowed) => commandMatches(command, allowed));
    if (!matches) {
      return { allowed: false, reason: 'Command not in allowed list' };
    }
  }

  // Check allowed commands if specified
  if (perms.allowedCommands.length > 0) {
    const matches = perms.allowedCommands.some((allowed) => commandMatches(command, allowed));
    if (!matches) {
      return { allowed: false, reason: 'Command not in allowed list' };
    }
  }

  return { allowed: true };
}

/**
 * Check network permission for a host.
 */
function checkNetworkPermission(
  perms: EffectivePermissions,
  host?: string
): PermissionCheckResult {
  // If network is false, deny all
  if (!perms.network) {
    return { allowed: false, reason: 'Network access is disabled' };
  }

  if (!host) {
    return { allowed: true };
  }

  // Check allowed hosts if specified
  if (perms.allowedHosts.length > 0) {
    const matches = perms.allowedHosts.some((allowed) => hostMatches(host, allowed));
    if (!matches) {
      return { allowed: false, reason: `Host not in allowed list: ${host}` };
    }
  }

  return { allowed: true };
}

// ============================================================================
// Pattern Matching Helpers
// ============================================================================

/**
 * Match a path against a glob pattern.
 */
function matchPath(path: string, pattern: string): boolean {
  return minimatch(path, pattern, { dot: true });
}

/**
 * Check if a command matches a pattern.
 * Patterns can be exact matches or wildcards.
 */
function commandMatches(command: string, pattern: string): boolean {
  // Exact match
  if (command === pattern) {
    return true;
  }

  // Check if command starts with pattern (for matching command prefixes like "rm -rf")
  if (command.startsWith(pattern + ' ') || command.startsWith(pattern)) {
    return true;
  }

  // Wildcard pattern matching
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(command);
  }

  return false;
}

/**
 * Check if a host matches a pattern.
 * Supports wildcard domains like *.example.com
 */
function hostMatches(host: string, pattern: string): boolean {
  // Exact match
  if (host === pattern) {
    return true;
  }

  // Wildcard domain matching (e.g., *.example.com)
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1); // .example.com
    return host.endsWith(suffix);
  }

  return false;
}

// ============================================================================
// Security Policy Conversion
// ============================================================================

export interface SecurityPolicy {
  allowFileRead: (path: string) => PermissionCheckResult;
  allowFileWrite: (path: string) => PermissionCheckResult;
  allowCommand: (command: string) => PermissionCheckResult;
  allowNetwork: (host: string) => PermissionCheckResult;
  maxFileSize: number | undefined;
}

/**
 * Convert EffectivePermissions to a SecurityPolicy for use with hooks.
 */
export function toSecurityPolicy(perms: EffectivePermissions): SecurityPolicy {
  return {
    allowFileRead: (path: string) => checkPermission(perms, 'read', path),
    allowFileWrite: (path: string) => checkPermission(perms, 'write', path),
    allowCommand: (command: string) => checkPermission(perms, 'execute', command),
    allowNetwork: (host: string) => checkPermission(perms, 'network', host),
    maxFileSize: perms.maxFileSize,
  };
}

/**
 * Create default (permissive) permissions.
 */
export function createDefaultPermissions(): EffectivePermissions {
  return {
    read: true,
    write: true,
    execute: true,
    allowedCommands: [],
    blockedCommands: [],
    allowedDirectories: [],
    blockedPaths: [],
    network: true,
    allowedHosts: [],
    maxFileSize: undefined,
  };
}
