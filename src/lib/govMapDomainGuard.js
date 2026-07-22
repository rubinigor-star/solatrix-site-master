const GOVMAP_ALLOWED_HOST = 'www.solatrix.energy';
const APEX_HOST = 'solatrix.energy';

if (
  typeof window !== 'undefined' &&
  window.location.hostname === APEX_HOST &&
  window.location.pathname.includes('/roof-check/')
) {
  const target = new URL(window.location.href);
  target.hostname = GOVMAP_ALLOWED_HOST;
  window.location.replace(target.toString());
}
