import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../stores/settingsStore';
import { SettingToggle } from '../controls/SettingToggle';
import { SettingNumber } from '../controls/SettingNumber';

export function CanvasSettings() {
  const { settings, updateSetting } = useSettingsStore();
  const { t } = useTranslation('gui');

  return (
    <div className="divide-y divide-border-default">
      <SettingToggle
        label={t('gui:settings.canvas.showGrid')}
        description={t('gui:settings.canvas.showGridDescription')}
        checked={settings.canvas.showGrid}
        onChange={(v) => updateSetting('canvas', 'showGrid', v)}
      />
      <SettingToggle
        label={t('gui:settings.canvas.snapToGrid')}
        description={t('gui:settings.canvas.snapToGridDescription')}
        checked={settings.canvas.snapToGrid}
        onChange={(v) => updateSetting('canvas', 'snapToGrid', v)}
      />
      <SettingNumber
        label={t('gui:settings.canvas.gridSize')}
        description={t('gui:settings.canvas.gridSizeDescription')}
        value={settings.canvas.gridSize}
        min={5}
        max={100}
        step={5}
        onChange={(v) => updateSetting('canvas', 'gridSize', v)}
      />
      <SettingToggle
        label={t('gui:settings.canvas.showMinimap')}
        description={t('gui:settings.canvas.showMinimapDescription')}
        checked={settings.canvas.showMinimap}
        onChange={(v) => updateSetting('canvas', 'showMinimap', v)}
      />
      <SettingToggle
        label={t('gui:settings.canvas.animateEdges')}
        description={t('gui:settings.canvas.animateEdgesDescription')}
        checked={settings.canvas.animateEdges}
        onChange={(v) => updateSetting('canvas', 'animateEdges', v)}
      />
    </div>
  );
}
