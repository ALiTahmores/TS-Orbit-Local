/** Local, deterministic profile images; no remote image service is required. */
export function localAvatar(seed: string = 'TS Orbit'): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  const initials = seed.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] || '').join('').toUpperCase();
  const escaped = initials.replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="64" fill="hsl(${hue},55%,35%)"/><text x="64" y="72" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="sans-serif" font-size="42">${escaped || 'TS'}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function localImageSource(source: string | undefined): string | undefined {
  if (!source) return source;
  try {
    const url = new URL(source, 'http://localhost');
    if (['api.dicebear.com', 'images.unsplash.com'].includes(url.hostname) || url.hostname.endsWith('.googleusercontent.com')) {
      return localAvatar(url.searchParams.get('seed') || url.pathname.split('/').pop() || 'TS Orbit');
    }
  } catch { /* Let the browser handle user-provided local sources. */ }
  return source;
}
