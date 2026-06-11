// Hosts configurados em next.config.ts → images.remotePatterns.
// next/image só otimiza esses; para qualquer outro (ex: thumbnail manual de
// IG/TikTok colada pelo admin) caímos em `unoptimized` para não quebrar.
const CONFIGURED_IMAGE_HOSTS = new Set([
  "img.youtube.com",
  "i.ytimg.com",
  "www.guppydelinhagem.com.br",
  "utfs.io",
]);

export function isConfiguredImageHost(url: string): boolean {
  try {
    return CONFIGURED_IMAGE_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}
