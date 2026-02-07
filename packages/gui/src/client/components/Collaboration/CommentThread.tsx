import { memo, useState } from 'react';
import { MessageSquare, Check, Reply, Send } from 'lucide-react';
import { cn } from '../../utils/cn';

interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  parentId?: string;
  resolved: boolean;
}

interface CommentThreadProps {
  comments: Comment[];
  onAddComment: (text: string, parentId?: string) => void;
  onResolve: (commentId: string) => void;
  className?: string;
}

function CommentThreadComponent({ comments, onAddComment, onResolve, className }: CommentThreadProps) {
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const rootComments = comments.filter((c) => !c.parentId);
  const replies = (parentId: string) => comments.filter((c) => c.parentId === parentId);

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    onAddComment(newComment, replyTo || undefined);
    setNewComment('');
    setReplyTo(null);
  };

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex-1 overflow-y-auto space-y-3 p-3">
        {rootComments.length === 0 ? (
          <div className="text-center py-6 text-sm text-text-muted">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No comments yet
          </div>
        ) : (
          rootComments.map((comment) => (
            <div key={comment.id} className={cn('rounded-lg border border-border-default', comment.resolved && 'opacity-60')}>
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-text-primary">{comment.author}</span>
                  <span className="text-xs text-text-muted">{new Date(comment.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-text-secondary">{comment.text}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => setReplyTo(comment.id)} className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1">
                    <Reply className="w-3 h-3" /> Reply
                  </button>
                  {!comment.resolved && (
                    <button onClick={() => onResolve(comment.id)} className="text-xs text-text-muted hover:text-success flex items-center gap-1">
                      <Check className="w-3 h-3" /> Resolve
                    </button>
                  )}
                </div>
              </div>
              {replies(comment.id).length > 0 && (
                <div className="border-t border-border-default bg-bg-surface/50 p-3 space-y-2">
                  {replies(comment.id).map((reply) => (
                    <div key={reply.id} className="pl-3 border-l-2 border-primary/30">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-text-primary">{reply.author}</span>
                        <span className="text-xs text-text-muted">{new Date(reply.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-text-secondary">{reply.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <div className="p-3 border-t border-border-default">
        {replyTo && (
          <div className="flex items-center justify-between mb-2 text-xs text-text-muted">
            <span>Replying to comment</span>
            <button onClick={() => setReplyTo(null)} className="hover:text-text-primary">Cancel</button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Add a comment..."
            className="flex-1 bg-bg-surface border border-border-default rounded px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary"
          />
          <button onClick={handleSubmit} disabled={!newComment.trim()} className="p-2 rounded bg-primary text-white disabled:opacity-50 hover:bg-primary/90">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export const CommentThread = memo(CommentThreadComponent);
