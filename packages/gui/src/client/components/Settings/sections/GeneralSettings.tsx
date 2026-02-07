import { useSettingsStore } from '../../../stores/settingsStore';
import { SettingSelect } from '../controls/SettingSelect';

export function GeneralSettings() {
  const { settings, updateSetting } = useSettingsStore();

  return (
    <div className="divide-y divide-border-default">
      <SettingSelect
        label="Theme"
        description="Choose the color scheme for the application"
        value={settings.general.theme}
        options={[
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
          { value: 'system', label: 'System' },
        ]}
        onChange={(v) => updateSetting('general', 'theme', v as 'dark' | 'light' | 'system')}
      />
    </div>
  );
}
