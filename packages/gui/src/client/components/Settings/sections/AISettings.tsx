import { useSettingsStore } from '../../../stores/settingsStore';
import { SettingToggle } from '../controls/SettingToggle';

export function AISettings() {
  const { settings, updateSetting } = useSettingsStore();

  return (
    <div className="divide-y divide-border-default">
      <SettingToggle
        label="Show Prompt Bar"
        description="Display the AI prompt input at the bottom of the canvas"
        checked={settings.ai.showPromptBar}
        onChange={(v) => updateSetting('ai', 'showPromptBar', v)}
      />
      <SettingToggle
        label="Show AI Suggestions"
        description="Display AI-generated suggestions while editing workflows"
        checked={settings.ai.showAISuggestions}
        onChange={(v) => updateSetting('ai', 'showAISuggestions', v)}
      />
    </div>
  );
}
