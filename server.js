// Vercel transpiles only the detected Express entrypoint. Register the full
// TypeScript loader before importing the application so runtime modules can use
// TypeScript syntax that Node's strip-only mode does not support.
import 'tsx/esm';
import express from 'express';

// Keep framework detection explicit while the actual application is loaded below.
void express;

const application = await import('./application.ts');

export const ready = application.ready;
export default application.default;
