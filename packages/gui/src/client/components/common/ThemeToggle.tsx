import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore, type Theme } from '../../stores/themeStore';

interface ThemeToggleProps {
  showLabel?: boolean;
}

export function ThemeToggle({ showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 dark:hover:bg-white/10 light:hover:bg-black/5 transition-colors"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Moon className="w-4 h-4 text-gray-400" />
      ) : (
        <Sun className="w-4 h-4 text-yellow-500" />
      )}
      {showLabel && (
        <span className="text-xs text-gray-400">
          {theme === 'dark' ? 'Dark' : 'Light'}
        </span>
      )}
    </button>
  );
}

interface ThemePickerProps {
  className?: string;
}

export function ThemePicker({ className }: ThemePickerProps) {
  const { theme, setTheme } = useThemeStore();

  const themes: { value: Theme; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ];

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
            theme === value
              ? 'bg-primary/20 text-primary'
              : 'text-gray-400 hover:text-white hover:bg-white/10'
          }`}
          title={`${label} mode`}
        >
          <Icon className="w-4 h-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
