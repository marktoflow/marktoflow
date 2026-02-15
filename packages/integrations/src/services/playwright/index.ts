/**
 * Playwright integration — re-exports for backward compatibility.
 */

export * from './types.js';
export { PlaywrightClient } from './client.js';
export { PlaywrightInitializer, createPlaywrightClient, scrape, screenshotUrl, pdfUrl } from './initializer.js';
