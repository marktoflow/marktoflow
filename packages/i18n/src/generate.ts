#!/usr/bin/env tsx
/**
 * Translation generator script.
 * Uses the Claude API to translate English locale files to target languages.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... pnpm --filter @marktoflow/i18n generate
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { LANGUAGES } from './languages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOCALES_DIR = join(__dirname, '..', 'locales');

const TARGET_LANGUAGES = LANGUAGES.filter((l) => l.code !== 'en');

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  const enDir = join(LOCALES_DIR, 'en');
  const namespaceFiles = readdirSync(enDir).filter((f) => f.endsWith('.json'));

  for (const nsFile of namespaceFiles) {
    const enContent = readFileSync(join(enDir, nsFile), 'utf-8');
    const enJson = JSON.parse(enContent);
    const namespace = nsFile.replace('.json', '');

    console.log(`\nTranslating ${nsFile}...`);

    for (const lang of TARGET_LANGUAGES) {
      console.log(`  → ${lang.name} (${lang.code})...`);

      const prompt = `Translate the following JSON object from English to ${lang.name} (${lang.nativeName}).
This is a UI localization file for a workflow automation tool called "marktoflow".
The namespace is "${namespace}" which contains ${namespace === 'common' ? 'shared UI strings (buttons, statuses, common terms)' : namespace === 'gui' ? 'visual workflow designer strings (toolbar, sidebar, settings, canvas, panels)' : 'command-line interface strings (command descriptions, error messages, prompts)'}.

Rules:
- Preserve all JSON keys exactly as-is (do not translate keys)
- Preserve all interpolation placeholders like {{count}}, {{name}}, {{duration}} exactly
- Preserve all technical terms like "YAML", "SDK", "OAuth", "WebSocket", "API", "MCP"
- Keep brand names like "marktoflow", "Slack", "GitHub", "Claude" untranslated
- Keep keyboard shortcuts like "⌘,", "⌫", "N", "E", "Y" untranslated
- For ${lang.direction === 'rtl' ? 'RTL language: ensure text reads naturally right-to-left' : 'LTR language: ensure text reads naturally left-to-right'}
- Return ONLY the translated JSON object, no explanation

English source:
${enContent}`;

      try {
        const response = await client.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 8192,
          messages: [{ role: 'user', content: prompt }],
        });

        const text =
          response.content[0].type === 'text' ? response.content[0].text : '';
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [
          null,
          text,
        ];
        const translatedJson = JSON.parse(jsonMatch[1]!.trim());

        // Validate all keys match
        const enKeys = Object.keys(flattenKeys(enJson));
        const trKeys = Object.keys(flattenKeys(translatedJson));
        const missing = enKeys.filter((k) => !trKeys.includes(k));
        if (missing.length > 0) {
          console.warn(
            `    ⚠ Missing keys in ${lang.code}/${nsFile}: ${missing.join(', ')}`
          );
        }

        const outPath = join(LOCALES_DIR, lang.code, nsFile);
        writeFileSync(outPath, JSON.stringify(translatedJson, null, 2) + '\n');
        console.log(`    ✓ Written ${lang.code}/${nsFile}`);
      } catch (err) {
        console.error(
          `    ✗ Failed: ${err instanceof Error ? err.message : err}`
        );
      }
    }
  }

  console.log('\nDone!');
}

function flattenKeys(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(
        result,
        flattenKeys(value as Record<string, unknown>, fullKey)
      );
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

main().catch(console.error);
