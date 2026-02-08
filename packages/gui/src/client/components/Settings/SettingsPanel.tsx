import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings2,
  LayoutGrid,
  Code2,
  Play,
  Bot,
  Bell,
  RotateCcw,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useSettingsStore } from '../../stores/settingsStore';
import { GeneralSettings } from './sections/GeneralSettings';
import { CanvasSettings } from './sections/CanvasSettings';
import { EditorSettings } from './sections/EditorSettings';
import { ExecutionSettings } from './sections/ExecutionSettings';
import { AISettings } from './sections/AISettings';
import { NotificationSettings } from './sections/NotificationSettings';
import type { SettingsCategory } from '@shared/settings';

interface CategoryDef {
  key: SettingsCategory;
  labelKey: string;
  icon: typeof Settings2;
  component: React.ComponentType;
}

const CATEGORIES: CategoryDef[] = [
  { key: 'general', labelKey: 'settings.categories.general', icon: Settings2, component: GeneralSettings },
  { key: 'canvas', labelKey: 'settings.categories.canvas', icon: LayoutGrid, component: CanvasSettings },
  { key: 'editor', labelKey: 'settings.categories.editor', icon: Code2, component: EditorSettings },
  { key: 'execution', labelKey: 'settings.categories.execution', icon: Play, component: ExecutionSettings },
  { key: 'ai', labelKey: 'settings.categories.ai', icon: Bot, component: AISettings },
  { key: 'notifications', labelKey: 'settings.categories.notifications', icon: Bell, component: NotificationSettings },
];

export function SettingsPanel() {
  const { settingsOpen, closeSettings, resetCategory } = useSettingsStore();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('general');
  const { t } = useTranslation('gui');

  const activeDef = CATEGORIES.find((c) => c.key === activeCategory)!;
  const ActiveComponent = activeDef.component;

  return (
    <Modal
      open={settingsOpen}
      onOpenChange={(open) => {
        if (!open) closeSettings();
      }}
      title={t('gui:settings.title')}
      size="xl"
    >
      <div className="flex min-h-[400px]">
        {/* Left nav */}
        <nav className="w-48 border-r border-border-default p-2 flex-shrink-0">
          {CATEGORIES.map(({ key, labelKey, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeCategory === key
                  ? 'bg-accent-muted text-accent'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(`gui:${labelKey}`)}
            </button>
          ))}
        </nav>

        {/* Right content */}
        <div className="flex-1 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-text-primary">{t(`gui:${activeDef.labelKey}`)}</h3>
            <button
              onClick={() => resetCategory(activeCategory)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
              title={t('gui:settings.resetToDefaults')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('gui:settings.reset')}
            </button>
          </div>
          <ActiveComponent />
        </div>
      </div>
    </Modal>
  );
}
