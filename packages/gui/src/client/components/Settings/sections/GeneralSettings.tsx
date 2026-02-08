import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../stores/settingsStore';
import { SettingSelect } from '../controls/SettingSelect';
import { LANGUAGES, isRTL } from '@marktoflow/i18n';

export function GeneralSettings() {
  const { settings, updateSetting } = useSettingsStore();
  const { t, i18n } = useTranslation('gui');

  return (
    <div className="divide-y divide-border-default">
      <SettingSelect
        label={t('settings.language')}
        description={t('settings.languageDescription')}
        value={settings.general.language}
        options={LANGUAGES.map((lang) => ({
          value: lang.code,
          label: `${lang.nativeName} (${lang.name})`,
        }))}
        onChange={(v) => {
          updateSetting('general', 'language', v);
          i18n.changeLanguage(v);
          document.documentElement.lang = v;
          document.documentElement.dir = isRTL(v) ? 'rtl' : 'ltr';
        }}
      />
      <SettingSelect
        label={t('settings.general.theme')}
        description={t('settings.general.themeDescription')}
        value={settings.general.theme}
        options={[
          { value: 'dark', label: t('settings.general.dark') },
          { value: 'light', label: t('settings.general.light') },
          { value: 'system', label: t('settings.general.system') },
        ]}
        onChange={(v) => updateSetting('general', 'theme', v as 'dark' | 'light' | 'system')}
      />
    </div>
  );
}
