import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('gui');
  const isSubworkflow = node.type === 'subworkflow';
  const hasError = node.data?.status === 'failed';
  const modKey = getModKey();

  return (
    <ContextMenu>
      {children}
      <ContextMenuContent>
        <ContextMenuItem onClick={onEdit}>
          <Edit className="w-4 h-4 mr-2" />
          {t('gui:canvas.editStep')}
          <ContextMenuShortcut>E</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem onClick={onViewYaml}>
          <Code className="w-4 h-4 mr-2" />
          {t('gui:canvas.viewYaml')}
          <ContextMenuShortcut>Y</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem onClick={onViewDocs}>
          <FileText className="w-4 h-4 mr-2" />
          {t('gui:canvas.viewDocumentation')}
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onDuplicate}>
          <Copy className="w-4 h-4 mr-2" />
          {t('gui:canvas.duplicate')}
          <ContextMenuShortcut>{modKey}D</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Plus className="w-4 h-4 mr-2" />
            {t('gui:canvas.addStep')}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={onAddStepBefore}>
              {t('gui:canvas.beforeThisStep')}
            </ContextMenuItem>
            <ContextMenuItem onClick={onAddStepAfter}>
              {t('gui:canvas.afterThisStep')}
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        {!isSubworkflow && (
          <ContextMenuItem onClick={onConvertToSubworkflow}>
            <FolderOpen className="w-4 h-4 mr-2" />
            {t('gui:canvas.convertToSubWorkflow')}
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onExecuteFrom}>
          <Play className="w-4 h-4 mr-2" />
          {t('gui:canvas.executeFromHere')}
        </ContextMenuItem>

        {hasError && (
          <ContextMenuItem className="text-error">
            <AlertTriangle className="w-4 h-4 mr-2" />
            {t('gui:canvas.viewErrorDetails')}
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem destructive onClick={onDelete}>
          <Trash2 className="w-4 h-4 mr-2" />
          {t('gui:canvas.delete')}
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
  const { t } = useTranslation('gui');
  const modKey = getModKey();

  return (
    <ContextMenu>
      {children}
      <ContextMenuContent>
        <ContextMenuItem onClick={onAddStep}>
          <Plus className="w-4 h-4 mr-2" />
          {t('gui:canvas.addStep')}
          <ContextMenuShortcut>N</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem onClick={onAddSubworkflow}>
          <FolderOpen className="w-4 h-4 mr-2" />
          {t('gui:canvas.addSubWorkflow')}
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onPaste} disabled={!canPaste}>
          <Copy className="w-4 h-4 mr-2" />
          {t('common:actions.paste')}
          <ContextMenuShortcut>{modKey}V</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onAutoLayout}>
          {t('gui:canvas.autoLayout')}
          <ContextMenuShortcut>{modKey}L</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem onClick={onFitView}>
          {t('gui:canvas.fitToView')}
          <ContextMenuShortcut>{modKey}0</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
