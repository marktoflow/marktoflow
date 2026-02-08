import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../stores/settingsStore';
import { SettingToggle } from '../controls/SettingToggle';

export function AISettings() {
  const { settings, updateSetting } = useSettingsStore();
  const { t } = useTranslation('gui');

  return (
    <div className="divide-y divide-border-default">
      <SettingToggle
        label={t('gui:settings.ai.showPromptBar')}
        description={t('gui:settings.ai.showPromptBarDescription')}
        checked={settings.ai.showPromptBar}
        onChange={(v) => updateSetting('ai', 'showPromptBar', v)}
      />
      <SettingToggle
        label={t('gui:settings.ai.showSuggestions')}
        description={t('gui:settings.ai.showSuggestionsDescription')}
        checked={settings.ai.showAISuggestions}
        onChange={(v) => updateSetting('ai', 'showAISuggestions', v)}
      />
    </div>
  );
}
