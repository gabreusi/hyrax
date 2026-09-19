// Must FAIL to compile under tsconfig.core.json: the core has no DOM lib.
export const width = window.innerWidth;
export const el = document.body;
