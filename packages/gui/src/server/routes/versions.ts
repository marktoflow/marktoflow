import { Router, type Request, type Response } from 'express';
import { VersionService } from '../services/VersionService.js';

export const versionRoutes = Router();

// List versions for a workflow
versionRoutes.get('/:path(*)/versions', (req: Request, res: Response) => {
  try {
    const workflowPath = req.params.path as string;
    const versions = VersionService.listVersions(workflowPath);
    res.json({ versions });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list versions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create a version snapshot
versionRoutes.post('/:path(*)/versions', (req: Request, res: Response) => {
  try {
    const workflowPath = req.params.path as string;
    const { content, message, author, isAutoSave } = req.body;
    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }
    const version = VersionService.createVersion(workflowPath, content, message, author, isAutoSave);
    res.json({ version });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create version',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get a specific version
versionRoutes.get('/:path(*)/versions/:versionId', (req: Request, res: Response) => {
  try {
    const workflowPath = req.params.path as string;
    const versionId = req.params.versionId as string;
    const version = VersionService.getVersion(workflowPath, versionId);
    if (!version) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }
    res.json({ version });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get version',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Restore a version
versionRoutes.post('/:path(*)/versions/:versionId/restore', (req: Request, res: Response) => {
  try {
    const workflowPath = req.params.path as string;
    const versionId = req.params.versionId as string;
    const version = VersionService.getVersion(workflowPath, versionId);
    if (!version) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }
    // Create a new version that restores this content
    const restored = VersionService.createVersion(
      workflowPath,
      version.content,
      `Restored from version ${version.version}`,
      req.body.author || 'system'
    );
    res.json({ version: restored, restoredContent: version.content });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to restore version',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Compare two versions
versionRoutes.get('/:path(*)/versions/compare', (req: Request, res: Response) => {
  try {
    const workflowPath = req.params.path as string;
    const v1 = req.query.v1 as string;
    const v2 = req.query.v2 as string;
    if (!v1 || !v2) {
      res.status(400).json({ error: 'v1 and v2 query parameters are required' });
      return;
    }
    const diff = VersionService.compareVersions(workflowPath, v1, v2);
    if (!diff) {
      res.status(404).json({ error: 'One or both versions not found' });
      return;
    }
    res.json({ diff });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to compare versions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
