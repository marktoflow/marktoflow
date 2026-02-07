import { Router, type Router as RouterType } from 'express';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  DEFAULT_SETTINGS,
  deepMergeSettings,
  type UserSettings,
  type SettingsCategory,
} from '../../shared/settings.js';

let settingsDir = join(homedir(), '.marktoflow');

/**
 * Override the settings directory (used for testing).
 */
export function setSettingsDir(dir: string): void {
  settingsDir = dir;
}

function getSettingsFile(): string {
  return join(settingsDir, 'settings.json');
}

async function ensureSettingsDir(): Promise<void> {
  if (!existsSync(settingsDir)) {
    await mkdir(settingsDir, { recursive: true });
  }
}

async function readSettings(): Promise<UserSettings> {
  await ensureSettingsDir();

  try {
    const raw = await readFile(getSettingsFile(), 'utf-8');
    const saved = JSON.parse(raw);
    return deepMergeSettings(DEFAULT_SETTINGS, saved);
  } catch {
    // File doesn't exist or is invalid — write defaults and return them
    await writeFile(getSettingsFile(), JSON.stringify(DEFAULT_SETTINGS, null, 2));
    return { ...DEFAULT_SETTINGS };
  }
}

async function writeSettings(settings: UserSettings): Promise<void> {
  await ensureSettingsDir();
  await writeFile(getSettingsFile(), JSON.stringify(settings, null, 2));
}

const router: RouterType = Router();

// GET /api/settings — return full settings (merged with defaults)
router.get('/', async (_req, res) => {
  try {
    const settings = await readSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to read settings',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// PUT /api/settings — full replace (used for reset-all)
router.put('/', async (req, res) => {
  try {
    const settings = deepMergeSettings(DEFAULT_SETTINGS, req.body);
    await writeSettings(settings);
    res.json(settings);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to write settings',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// PATCH /api/settings/:category — partial update of one category
router.patch('/:category', async (req, res) => {
  try {
    const category = req.params.category as SettingsCategory;

    if (!(category in DEFAULT_SETTINGS)) {
      return res.status(400).json({ error: `Unknown settings category: ${category}` });
    }

    const settings = await readSettings();
    const current = settings[category];
    const merged = { ...current, ...req.body };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (settings as any)[category] = merged;

    await writeSettings(settings);
    res.json(settings);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update settings',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as settingsRoutes };
