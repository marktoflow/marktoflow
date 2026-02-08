import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../stores/settingsStore';
import { SettingToggle } from '../controls/SettingToggle';

export function NotificationSettings() {
  const { settings, updateSetting } = useSettingsStore();
  const { t } = useTranslation('gui');

  return (
    <div className="divide-y divide-border-default">
      <SettingToggle
        label={t('gui:settings.notifications.executionComplete')}
        description={t('gui:settings.notifications.executionCompleteDescription')}
        checked={settings.notifications.executionComplete}
        onChange={(v) => updateSetting('notifications', 'executionComplete', v)}
      />
      <SettingToggle
        label={t('gui:settings.notifications.executionFailed')}
        description={t('gui:settings.notifications.executionFailedDescription')}
        checked={settings.notifications.executionFailed}
        onChange={(v) => updateSetting('notifications', 'executionFailed', v)}
      />
      <SettingToggle
        label={t('gui:settings.notifications.workflowSaved')}
        description={t('gui:settings.notifications.workflowSavedDescription')}
        checked={settings.notifications.workflowSaved}
        onChange={(v) => updateSetting('notifications', 'workflowSaved', v)}
      />
      <SettingToggle
        label={t('gui:settings.notifications.connectionStatus')}
        description={t('gui:settings.notifications.connectionStatusDescription')}
        checked={settings.notifications.connectionStatus}
        onChange={(v) => updateSetting('notifications', 'connectionStatus', v)}
      />
    </div>
  );
}
