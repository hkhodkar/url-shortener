// Same rules as backend/app/codes.py
export const ALIAS_MIN_LENGTH = 3;
export const ALIAS_MAX_LENGTH = 32;
export const ALIAS_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$/;

export const RESERVED_WORDS: ReadonlySet<string> = new Set([
  'about',
  'admin',
  'api',
  'app',
  'assets',
  'dashboard',
  'docs',
  'health',
  'help',
  'links',
  'login',
  'logout',
  'new',
  'openapi',
  'r',
  'redoc',
  'settings',
  'static',
  'stats',
]);

/** Why an alias can't be used, or null when it is fine. */
export function aliasProblem(alias: string): string | null {
  if (alias.length < ALIAS_MIN_LENGTH) {
    return `Use at least ${ALIAS_MIN_LENGTH} characters`;
  }
  if (alias.length > ALIAS_MAX_LENGTH) {
    return `Use at most ${ALIAS_MAX_LENGTH} characters`;
  }
  if (!ALIAS_PATTERN.test(alias)) {
    return 'Use letters, numbers, - and _ only, starting and ending with a letter or number';
  }
  if (RESERVED_WORDS.has(alias.toLowerCase())) {
    return 'This word is reserved';
  }
  return null;
}
