import { useSettingsStore } from '../../../stores/settingsStore';
import { SettingToggle } from '../controls/SettingToggle';

export function NotificationSettings() {
  const { settings, updateSetting } = useSettingsStore();

  return (
    <div className="divide-y divide-border-default">
      <SettingToggle
        label="Execution Complete"
        description="Notify when a workflow execution finishes successfully"
        checked={settings.notifications.executionComplete}
        onChange={(v) => updateSetting('notifications', 'executionComplete', v)}
      />
      <SettingToggle
        label="Execution Failed"
        description="Notify when a workflow execution fails"
        checked={settings.notifications.executionFailed}
        onChange={(v) => updateSetting('notifications', 'executionFailed', v)}
      />
      <SettingToggle
        label="Workflow Saved"
        description="Notify when a workflow is saved"
        checked={settings.notifications.workflowSaved}
        onChange={(v) => updateSetting('notifications', 'workflowSaved', v)}
      />
      <SettingToggle
        label="Connection Status"
        description="Notify when WebSocket connection state changes"
        checked={settings.notifications.connectionStatus}
        onChange={(v) => updateSetting('notifications', 'connectionStatus', v)}
      />
    </div>
  );
}
