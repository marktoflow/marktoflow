import { useSettingsStore } from '../../../stores/settingsStore';
import { SettingToggle } from '../controls/SettingToggle';
import { SettingNumber } from '../controls/SettingNumber';

export function EditorSettings() {
  const { settings, updateSetting } = useSettingsStore();

  return (
    <div className="divide-y divide-border-default">
      <SettingToggle
        label="Auto-Save"
        description="Automatically save workflows at a regular interval"
        checked={settings.editor.autoSaveEnabled}
        onChange={(v) => updateSetting('editor', 'autoSaveEnabled', v)}
      />
      {settings.editor.autoSaveEnabled && (
        <SettingNumber
          label="Auto-Save Interval"
          description="Interval in seconds between automatic saves"
          value={settings.editor.autoSaveIntervalMs / 1000}
          min={5}
          max={300}
          step={5}
          onChange={(v) => updateSetting('editor', 'autoSaveIntervalMs', v * 1000)}
        />
      )}
      <SettingToggle
        label="Auto-Validate on Change"
        description="Run workflow validation after each edit"
        checked={settings.editor.autoValidateOnChange}
        onChange={(v) => updateSetting('editor', 'autoValidateOnChange', v)}
      />
      <SettingToggle
        label="Confirm Before Delete"
        description="Show confirmation dialog before deleting steps"
        checked={settings.editor.confirmBeforeDelete}
        onChange={(v) => updateSetting('editor', 'confirmBeforeDelete', v)}
      />
    </div>
  );
}
