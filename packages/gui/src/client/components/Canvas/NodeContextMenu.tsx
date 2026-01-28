import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuShortcut,
} from '../common/ContextMenu';
import {
  Edit,
  Code,
  FileText,
  Copy,
  Trash2,
  Plus,
  FolderOpen,
  Play,
  AlertTriangle,
} from 'lucide-react';
import type { Node } from '@xyflow/react';
import { getModKey } from '../../utils/platform';

interface NodeContextMenuProps {
  children: React.ReactNode;
  node: Node;
  onEdit: () => void;
  onViewYaml: () => void;
  onViewDocs: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAddStepBefore: () => void;
  onAddStepAfter: () => void;
  onConvertToSubworkflow: () => void;
  onExecuteFrom: () => void;
}

export function NodeContextMenu({
  children,
  node,
  onEdit,
  onViewYaml,
  onViewDocs,
  onDuplicate,
  onDelete,
  onAddStepBefore,
  onAddStepAfter,
  onConvertToSubworkflow,
  onExecuteFrom,
}: NodeContextMenuProps) {
  const isSubworkflow = node.type === 'subworkflow';
  const hasError = node.data?.status === 'failed';
  const modKey = getModKey();

  return (
    <ContextMenu>
      {children}
      <ContextMenuContent>
        <ContextMenuItem onClick={onEdit}>
          <Edit className="w-4 h-4 mr-2" />
          Edit Step
          <ContextMenuShortcut>E</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem onClick={onViewYaml}>
          <Code className="w-4 h-4 mr-2" />
          View YAML
          <ContextMenuShortcut>Y</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem onClick={onViewDocs}>
          <FileText className="w-4 h-4 mr-2" />
          View Documentation
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onDuplicate}>
          <Copy className="w-4 h-4 mr-2" />
          Duplicate
          <ContextMenuShortcut>{modKey}D</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Plus className="w-4 h-4 mr-2" />
            Add Step
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={onAddStepBefore}>
              Before this step
            </ContextMenuItem>
            <ContextMenuItem onClick={onAddStepAfter}>
              After this step
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        {!isSubworkflow && (
          <ContextMenuItem onClick={onConvertToSubworkflow}>
            <FolderOpen className="w-4 h-4 mr-2" />
            Convert to Sub-workflow
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onExecuteFrom}>
          <Play className="w-4 h-4 mr-2" />
          Execute from here
        </ContextMenuItem>

        {hasError && (
          <ContextMenuItem className="text-error">
            <AlertTriangle className="w-4 h-4 mr-2" />
            View Error Details
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem destructive onClick={onDelete}>
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// Canvas context menu (right-click on empty space)
interface CanvasContextMenuProps {
  children: React.ReactNode;
  onAddStep: () => void;
  onAddSubworkflow: () => void;
  onPaste: () => void;
  onAutoLayout: () => void;
  onFitView: () => void;
  canPaste: boolean;
}

export function CanvasContextMenu({
  children,
  onAddStep,
  onAddSubworkflow,
  onPaste,
  onAutoLayout,
  onFitView,
  canPaste,
}: CanvasContextMenuProps) {
  const modKey = getModKey();

  return (
    <ContextMenu>
      {children}
      <ContextMenuContent>
        <ContextMenuItem onClick={onAddStep}>
          <Plus className="w-4 h-4 mr-2" />
          Add Step
          <ContextMenuShortcut>N</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem onClick={onAddSubworkflow}>
          <FolderOpen className="w-4 h-4 mr-2" />
          Add Sub-workflow
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onPaste} disabled={!canPaste}>
          <Copy className="w-4 h-4 mr-2" />
          Paste
          <ContextMenuShortcut>{modKey}V</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onAutoLayout}>
          Auto-layout
          <ContextMenuShortcut>{modKey}L</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem onClick={onFitView}>
          Fit to View
          <ContextMenuShortcut>{modKey}0</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
