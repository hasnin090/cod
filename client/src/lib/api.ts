export function getApiBase(): string {
  try {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isNetlify = /\.netlify\.app$/i.test(host) || /netlify\.app$/i.test(host);
    if (isNetlify) return '/.netlify/functions/api';
  } catch {}
  return '/api';
}
