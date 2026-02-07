import { createHash } from 'crypto';

export interface WorkflowVersion {
  id: string;
  workflowPath: string;
  version: number;
  content: string;
  message: string;
  author: string;
  createdAt: string;
  hash: string;
  isAutoSave: boolean;
}

export interface VersionDiff {
  added: string[];
  removed: string[];
  modified: string[];
  summary: string;
}

class VersionServiceImpl {
  private versions = new Map<string, WorkflowVersion[]>();
  private nextVersion = new Map<string, number>();

  createVersion(
    workflowPath: string,
    content: string,
    message: string,
    author: string = 'system',
    isAutoSave: boolean = false
  ): WorkflowVersion {
    const versionNum = (this.nextVersion.get(workflowPath) || 0) + 1;
    this.nextVersion.set(workflowPath, versionNum);

    const hash = createHash('sha256').update(content).digest('hex').slice(0, 12);
    const version: WorkflowVersion = {
      id: `v-${workflowPath}-${versionNum}`,
      workflowPath,
      version: versionNum,
      content,
      message: message || (isAutoSave ? 'Auto-save' : `Version ${versionNum}`),
      author,
      createdAt: new Date().toISOString(),
      hash,
      isAutoSave,
    };

    const existing = this.versions.get(workflowPath) || [];
    existing.push(version);
    this.versions.set(workflowPath, existing);

    return version;
  }

  listVersions(workflowPath: string): Omit<WorkflowVersion, 'content'>[] {
    const versions = this.versions.get(workflowPath) || [];
    return versions
      .map(({ content, ...rest }) => rest)
      .sort((a, b) => b.version - a.version);
  }

  getVersion(workflowPath: string, versionId: string): WorkflowVersion | null {
    const versions = this.versions.get(workflowPath) || [];
    return versions.find((v) => v.id === versionId) || null;
  }

  getLatestVersion(workflowPath: string): WorkflowVersion | null {
    const versions = this.versions.get(workflowPath) || [];
    return versions.length > 0 ? versions[versions.length - 1] : null;
  }

  compareVersions(
    workflowPath: string,
    versionId1: string,
    versionId2: string
  ): VersionDiff | null {
    const v1 = this.getVersion(workflowPath, versionId1);
    const v2 = this.getVersion(workflowPath, versionId2);
    if (!v1 || !v2) return null;

    const lines1 = v1.content.split('\n');
    const lines2 = v2.content.split('\n');

    const set1 = new Set(lines1);
    const set2 = new Set(lines2);

    const added = lines2.filter((l) => !set1.has(l));
    const removed = lines1.filter((l) => !set2.has(l));

    return {
      added,
      removed,
      modified: [],
      summary: `+${added.length} -${removed.length} lines`,
    };
  }

  shouldAutoSave(workflowPath: string, newContent: string): boolean {
    const latest = this.getLatestVersion(workflowPath);
    if (!latest) return true;
    return latest.hash !== createHash('sha256').update(newContent).digest('hex').slice(0, 12);
  }
}

export const VersionService = new VersionServiceImpl();
