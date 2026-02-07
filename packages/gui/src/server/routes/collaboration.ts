import { Router, type Request, type Response } from 'express';

export const collaborationRoutes = Router();

// In-memory state for collaboration
interface WorkflowLock {
  workflowPath: string;
  lockedBy: string;
  lockedAt: string;
  expiresAt: string;
}

interface Comment {
  id: string;
  workflowPath: string;
  nodeId?: string;
  author: string;
  text: string;
  createdAt: string;
  parentId?: string;
  resolved: boolean;
}

interface Activity {
  id: string;
  workflowPath: string;
  author: string;
  action: string;
  details: string;
  createdAt: string;
}

const locks = new Map<string, WorkflowLock>();
const comments = new Map<string, Comment[]>();
const activities = new Map<string, Activity[]>();
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Lock a workflow
collaborationRoutes.post('/lock', (req: Request, res: Response) => {
  const { workflowPath, userId } = req.body;
  if (!workflowPath || !userId) {
    res.status(400).json({ error: 'workflowPath and userId are required' });
    return;
  }

  const existing = locks.get(workflowPath);
  if (existing && new Date(existing.expiresAt) > new Date() && existing.lockedBy !== userId) {
    res.status(409).json({ error: 'Workflow is locked', lock: existing });
    return;
  }

  const lock: WorkflowLock = {
    workflowPath,
    lockedBy: userId,
    lockedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + LOCK_TIMEOUT_MS).toISOString(),
  };
  locks.set(workflowPath, lock);
  res.json({ lock });
});

// Unlock a workflow
collaborationRoutes.post('/unlock', (req: Request, res: Response) => {
  const { workflowPath, userId } = req.body;
  const existing = locks.get(workflowPath);
  if (existing && existing.lockedBy === userId) {
    locks.delete(workflowPath);
  }
  res.json({ success: true });
});

// Get lock status
collaborationRoutes.get('/lock/:path(*)', (req: Request, res: Response) => {
  const lock = locks.get(req.params.path as string);
  if (lock && new Date(lock.expiresAt) > new Date()) {
    res.json({ locked: true, lock });
  } else {
    if (lock) locks.delete(req.params.path as string);
    res.json({ locked: false });
  }
});

// Get comments for a workflow
collaborationRoutes.get('/comments/:path(*)', (req: Request, res: Response) => {
  const workflowComments = comments.get(req.params.path as string) || [];
  res.json({ comments: workflowComments });
});

// Add a comment
collaborationRoutes.post('/comments', (req: Request, res: Response) => {
  const { workflowPath, nodeId, author, text, parentId } = req.body;
  const comment: Comment = {
    id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workflowPath,
    nodeId,
    author: author || 'anonymous',
    text,
    createdAt: new Date().toISOString(),
    parentId,
    resolved: false,
  };

  const existing = comments.get(workflowPath) || [];
  existing.push(comment);
  comments.set(workflowPath, existing);

  // Track activity
  addActivity(workflowPath, author || 'anonymous', 'comment', `Added comment${nodeId ? ` on node ${nodeId}` : ''}`);

  res.json({ comment });
});

// Resolve a comment
collaborationRoutes.post('/comments/:commentId/resolve', (req: Request, res: Response) => {
  const { workflowPath } = req.body;
  const existing = comments.get(workflowPath) || [];
  const comment = existing.find((c) => c.id === req.params.commentId as string);
  if (comment) {
    comment.resolved = true;
    res.json({ comment });
  } else {
    res.status(404).json({ error: 'Comment not found' });
  }
});

// Get activity feed
collaborationRoutes.get('/activity/:path(*)', (req: Request, res: Response) => {
  const feed = activities.get(req.params.path as string) || [];
  res.json({ activities: feed.slice(-50).reverse() });
});

function addActivity(workflowPath: string, author: string, action: string, details: string) {
  const existing = activities.get(workflowPath) || [];
  existing.push({
    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workflowPath,
    author,
    action,
    details,
    createdAt: new Date().toISOString(),
  });
  activities.set(workflowPath, existing);
}
