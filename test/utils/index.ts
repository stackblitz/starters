import { commands, type Locator } from 'vitest/browser';

declare module 'vitest/browser' {
  interface BrowserCommands {
    waitForVisible: (selector: string, timeout: number) => Promise<void>;
  }
}

// Vite content hashes are base64url, so they may themselves contain `-`.
// Anchor to the extension to strip the whole hash rather than its first segment.
export function removeFileHash(filename: string) {
  return filename.replace(/-[\w-]+(?=\.[^.]+$)/, '');
}

// The WebContainer preview is a cross-origin iframe, so in-page queries such as
// `expect.element()` can't see into it. Playwright can, so wait from its side.
export async function waitForVisible(
  locator: Locator,
  { timeout = 30_000 } = {}
) {
  await commands.waitForVisible(locator.selector, timeout);
}
