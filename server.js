// Vercel's Express entrypoint. `npm run build:vercel` bundles the TypeScript
// application into one ES module, so a cold start loads a single prebuilt file
// instead of transpiling every server module at runtime.
import express from 'express';

// Keep framework detection explicit while the actual application is loaded below.
void express;

const application = await import('./build/vercel/application.mjs');

export const ready = application.ready;
export default application.default;
