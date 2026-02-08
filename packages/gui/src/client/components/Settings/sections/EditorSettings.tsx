import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../stores/settingsStore';
import { SettingToggle } from '../controls/SettingToggle';
import { SettingNumber } from '../controls/SettingNumber';

export function EditorSettings() {
  const { settings, updateSetting } = useSettingsStore();
  const { t } = useTranslation('gui');

  return (
    <div className="divide-y divide-border-default">
      <SettingToggle
        label={t('gui:settings.editor.autoSave')}
        description={t('gui:settings.editor.autoSaveDescription')}
        checked={settings.editor.autoSaveEnabled}
        onChange={(v) => updateSetting('editor', 'autoSaveEnabled', v)}
      />
      {settings.editor.autoSaveEnabled && (
        <SettingNumber
          label={t('gui:settings.editor.autoSaveInterval')}
          description={t('gui:settings.editor.autoSaveIntervalDescription')}
          value={settings.editor.autoSaveIntervalMs / 1000}
          min={5}
          max={300}
          step={5}
          onChange={(v) => updateSetting('editor', 'autoSaveIntervalMs', v * 1000)}
        />
      )}
      <SettingToggle
        label={t('gui:settings.editor.autoValidate')}
        description={t('gui:settings.editor.autoValidateDescription')}
        checked={settings.editor.autoValidateOnChange}
        onChange={(v) => updateSetting('editor', 'autoValidateOnChange', v)}
      />
      <SettingToggle
        label={t('gui:settings.editor.confirmDelete')}
        description={t('gui:settings.editor.confirmDeleteDescription')}
        checked={settings.editor.confirmBeforeDelete}
        onChange={(v) => updateSetting('editor', 'confirmBeforeDelete', v)}
      />
    </div>
  );
}
