import { useSettingsStore } from '../../../stores/settingsStore';
import { SettingToggle } from '../controls/SettingToggle';

export function ExecutionSettings() {
  const { settings, updateSetting } = useSettingsStore();

  return (
    <div className="divide-y divide-border-default">
      <SettingToggle
        label="Confirm Before Execute"
        description="Show confirmation dialog before running workflows"
        checked={settings.execution.confirmBeforeExecute}
        onChange={(v) => updateSetting('execution', 'confirmBeforeExecute', v)}
      />
      <SettingToggle
        label="Auto-Scroll Logs"
        description="Automatically scroll to the latest log entry during execution"
        checked={settings.execution.autoScrollLogs}
        onChange={(v) => updateSetting('execution', 'autoScrollLogs', v)}
      />
      <SettingToggle
        label="Show Execution Notifications"
        description="Display toast notifications when execution completes or fails"
        checked={settings.execution.showExecutionNotifications}
        onChange={(v) => updateSetting('execution', 'showExecutionNotifications', v)}
      />
    </div>
  );
}
