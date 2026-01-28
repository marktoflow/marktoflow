/**
 * Platform detection utilities for cross-platform keyboard shortcuts
 */

/**
 * Detect if the user is on a Mac platform
 */
export const isMac = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  return navigator.platform.toUpperCase().includes('MAC');
};

/**
 * Get the appropriate modifier key display for the current platform
 * Returns '⌘' on Mac, 'Ctrl' on Windows/Linux
 */
export const getModKey = (): string => {
  return isMac() ? '⌘' : 'Ctrl';
};

/**
 * Convert a shortcut string to display the correct modifier for the platform
 * @param shortcut - The shortcut string (can contain ⌘, Cmd, or Ctrl)
 * @returns The shortcut with the correct platform modifier
 *
 * @example
 * getShortcutDisplay('⌘+S') // '⌘+S' on Mac, 'Ctrl+S' on Windows
 * getShortcutDisplay('Cmd+Z') // '⌘+Z' on Mac, 'Ctrl+Z' on Windows
 */
export const getShortcutDisplay = (shortcut: string): string => {
  const modKey = getModKey();

  return shortcut
    .replace(/⌘/g, modKey)
    .replace(/Cmd/g, modKey);
};

/**
 * Check if the modifier key is pressed in a keyboard event
 * Checks metaKey on Mac, ctrlKey on Windows/Linux
 */
export const isModKeyPressed = (event: KeyboardEvent | React.KeyboardEvent): boolean => {
  return isMac() ? event.metaKey : event.ctrlKey;
};
