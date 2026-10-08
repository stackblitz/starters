// Vite content hashes are base64url, so they may themselves contain `-`.
// Anchor to the extension to strip the whole hash rather than its first segment.
export function removeFileHash(filename: string) {
  return filename.replace(/-[\w-]+(?=\.[^.]+$)/, '');
}
