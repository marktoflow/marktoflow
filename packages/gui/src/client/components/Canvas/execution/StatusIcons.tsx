/**
 * Status icon components and helper functions for execution overlay.
 */

import { CheckCircle, XCircle, Loader2, Square, SkipForward } from 'lucide-react';
import type { StepStatus, WorkflowStatus } from '@shared/types';

export function StatusIcon({ status }: { status: WorkflowStatus }) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-success" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-error" />;
    case 'cancelled':
      return <Square className="w-5 h-5 text-text-secondary" />;
    default:
      return <div className="w-5 h-5 rounded-full bg-gray-500" />;
  }
}

export function StepStatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-4 h-4 text-warning animate-spin" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-success" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-error" />;
    case 'skipped':
      return <SkipForward className="w-4 h-4 text-text-secondary" />;
    default:
      return <div className="w-4 h-4 rounded-full border-2 border-gray-500" />;
  }
}

export function getStatusText(status: WorkflowStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'running':
      return 'Executing Workflow...';
    case 'completed':
      return 'Workflow Completed';
    case 'failed':
      return 'Workflow Failed';
    case 'cancelled':
      return 'Workflow Cancelled';
    default:
      return 'Unknown';
  }
}
