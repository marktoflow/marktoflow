import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../stores/settingsStore';
import { SettingToggle } from '../controls/SettingToggle';

export function ExecutionSettings() {
  const { settings, updateSetting } = useSettingsStore();
  const { t } = useTranslation('gui');

  return (
    <div className="divide-y divide-border-default">
      <SettingToggle
        label={t('gui:settings.execution.confirmExecute')}
        description={t('gui:settings.execution.confirmExecuteDescription')}
        checked={settings.execution.confirmBeforeExecute}
        onChange={(v) => updateSetting('execution', 'confirmBeforeExecute', v)}
      />
      <SettingToggle
        label={t('gui:settings.execution.autoScrollLogs')}
        description={t('gui:settings.execution.autoScrollLogsDescription')}
        checked={settings.execution.autoScrollLogs}
        onChange={(v) => updateSetting('execution', 'autoScrollLogs', v)}
      />
      <SettingToggle
        label={t('gui:settings.execution.showNotifications')}
        description={t('gui:settings.execution.showNotificationsDescription')}
        checked={settings.execution.showExecutionNotifications}
        onChange={(v) => updateSetting('execution', 'showExecutionNotifications', v)}
      />
    </div>
  );
}
