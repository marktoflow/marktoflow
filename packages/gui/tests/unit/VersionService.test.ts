import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { VersionService } from '../../src/server/services/VersionService.js';

function sha256First12(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 12);
}

describe('VersionService', () => {
  // Use unique workflowPath per test group to avoid singleton state leaking

  describe('createVersion', () => {
    const path = 'test/create-version.md';

    it('creates version with incrementing version numbers and correct hash', () => {
      const v1 = VersionService.createVersion(path, 'content-v1', 'First version');
      expect(v1.version).toBe(1);
      expect(v1.id).toBe(`v-${path}-1`);
      expect(v1.workflowPath).toBe(path);
      expect(v1.content).toBe('content-v1');
      expect(v1.message).toBe('First version');
      expect(v1.hash).toBe(sha256First12('content-v1'));
      expect(v1.createdAt).toBeDefined();

      const v2 = VersionService.createVersion(path, 'content-v2', 'Second version');
      expect(v2.version).toBe(2);
      expect(v2.id).toBe(`v-${path}-2`);
      expect(v2.hash).toBe(sha256First12('content-v2'));
    });

    it('correct id format is v-{path}-{num}', () => {
      const wf = 'test/id-format.md';
      const v = VersionService.createVersion(wf, 'data', 'msg');
      expect(v.id).toMatch(/^v-.+-\d+$/);
      expect(v.id).toBe(`v-${wf}-1`);
    });
  });

  describe('createVersion with defaults', () => {
    const path = 'test/defaults.md';

    it('author defaults to system', () => {
      const v = VersionService.createVersion(path, 'content', 'msg');
      expect(v.author).toBe('system');
    });

    it('isAutoSave defaults to false', () => {
      const v = VersionService.createVersion(path, 'content2', 'msg2');
      expect(v.isAutoSave).toBe(false);
    });
  });

  describe('createVersion auto-save message', () => {
    const path = 'test/autosave-msg.md';

    it('defaults message to Auto-save when isAutoSave is true and message is empty', () => {
      const v = VersionService.createVersion(path, 'auto content', '', 'bot', true);
      expect(v.message).toBe('Auto-save');
      expect(v.isAutoSave).toBe(true);
    });

    it('uses provided message even when isAutoSave is true', () => {
      const v = VersionService.createVersion(path, 'auto content 2', 'my msg', 'bot', true);
      expect(v.message).toBe('my msg');
    });
  });

  describe('listVersions', () => {
    const path = 'test/list-versions.md';

    it('returns versions without content, sorted newest first', () => {
      VersionService.createVersion(path, 'c1', 'v1');
      VersionService.createVersion(path, 'c2', 'v2');
      VersionService.createVersion(path, 'c3', 'v3');

      const list = VersionService.listVersions(path);
      expect(list.length).toBe(3);

      // Sorted newest first (highest version number first)
      expect(list[0].version).toBe(3);
      expect(list[1].version).toBe(2);
      expect(list[2].version).toBe(1);

      // Should not contain content
      for (const item of list) {
        expect(item).not.toHaveProperty('content');
      }
    });

    it('returns empty array for unknown path', () => {
      const list = VersionService.listVersions('test/nonexistent-list.md');
      expect(list).toEqual([]);
    });
  });

  describe('getVersion', () => {
    const path = 'test/get-version.md';

    it('returns full version with content by id', () => {
      const created = VersionService.createVersion(path, 'my content', 'msg');
      const fetched = VersionService.getVersion(path, created.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.content).toBe('my content');
      expect(fetched!.message).toBe('msg');
    });

    it('returns null for unknown id', () => {
      const result = VersionService.getVersion(path, 'v-nonexistent-999');
      expect(result).toBeNull();
    });
  });

  describe('getLatestVersion', () => {
    const path = 'test/get-latest.md';

    it('returns null if no versions exist', () => {
      const result = VersionService.getLatestVersion('test/no-versions-latest.md');
      expect(result).toBeNull();
    });

    it('returns most recent version', () => {
      VersionService.createVersion(path, 'first', 'msg1');
      VersionService.createVersion(path, 'second', 'msg2');
      const v3 = VersionService.createVersion(path, 'third', 'msg3');

      const latest = VersionService.getLatestVersion(path);
      expect(latest).not.toBeNull();
      expect(latest!.id).toBe(v3.id);
      expect(latest!.content).toBe('third');
      expect(latest!.version).toBe(3);
    });
  });

  describe('compareVersions', () => {
    const path = 'test/compare-versions.md';

    it('returns diff with added/removed lines and summary', () => {
      const v1 = VersionService.createVersion(path, 'line1\nline2\nline3', 'v1');
      const v2 = VersionService.createVersion(path, 'line1\nline4\nline3', 'v2');

      const diff = VersionService.compareVersions(path, v1.id, v2.id);
      expect(diff).not.toBeNull();
      expect(diff!.added).toContain('line4');
      expect(diff!.removed).toContain('line2');
      expect(diff!.summary).toMatch(/\+\d+ -\d+ lines/);
    });

    it('returns null if either version not found', () => {
      const v1 = VersionService.createVersion(path, 'some content', 'v');
      const result1 = VersionService.compareVersions(path, v1.id, 'v-nonexistent-999');
      expect(result1).toBeNull();

      const result2 = VersionService.compareVersions(path, 'v-nonexistent-999', v1.id);
      expect(result2).toBeNull();
    });
  });

  describe('shouldAutoSave', () => {
    it('returns true if no versions exist', () => {
      const result = VersionService.shouldAutoSave('test/no-versions-autosave.md', 'anything');
      expect(result).toBe(true);
    });

    it('returns true if content hash differs from latest', () => {
      const path = 'test/should-autosave-diff.md';
      VersionService.createVersion(path, 'original content', 'v1');

      const result = VersionService.shouldAutoSave(path, 'modified content');
      expect(result).toBe(true);
    });

    it('returns false if content hash matches latest', () => {
      const path = 'test/should-autosave-same.md';
      const content = 'same content';
      VersionService.createVersion(path, content, 'v1');

      const result = VersionService.shouldAutoSave(path, content);
      expect(result).toBe(false);
    });
  });
});
