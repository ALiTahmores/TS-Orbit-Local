import React from 'react';

const reloadKey = 'orbit_chunk_reload_at';

// After a new release the hashed chunk names change; a tab still running the old
// release then fails to fetch a view. Reload once to pick up the new release, but
// never loop if the failure persists (offline, server down).
function reloadForNewRelease(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (!/dynamically imported module|Importing a module script failed|Failed to fetch/i.test(message)) return false;
  try {
    const last = Number(sessionStorage.getItem(reloadKey) || 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(reloadKey, String(Date.now()));
  } catch { return false; }
  window.location.reload();
  return true;
}

// React.lazy for modules with named exports. `preload` starts the download early
// (idle time, hover) so the first visit to a view does not wait on the network.
export function lazyNamed<M extends Record<K, React.ComponentType<any>>, K extends keyof M>(loader: () => Promise<M>, name: K) {
  let pending: Promise<M> | undefined;
  const load = () => (pending ??= loader().catch(error => { pending = undefined; throw error; }));
  const component = React.lazy(() => load().then(module => ({ default: module[name] }), error => {
    // Keep the fallback on screen while the page reloads instead of flashing an error.
    if (reloadForNewRelease(error)) return new Promise<never>(() => {});
    throw error;
  }));
  return Object.assign(component, { preload: load });
}

// Warm the given lazy views once the browser is idle, one at a time.
export function preloadWhenIdle(views: { preload: () => Promise<unknown> }[]) {
  // Safari has no requestIdleCallback; fall back to a short delay.
  const idle = (callback: () => void) => typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(callback, { timeout: 4000 }) : setTimeout(callback, 1500);
  let cancelled = false;
  const next = (index: number) => {
    if (cancelled || index >= views.length) return;
    idle(() => { if (!cancelled) views[index].preload().catch(() => undefined).finally(() => next(index + 1)); });
  };
  next(0);
  return () => { cancelled = true; };
}
