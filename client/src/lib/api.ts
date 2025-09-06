export function getApiBase(): string {
  try {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isNetlify = /\.netlify\.app$/i.test(host) || /netlify\.app$/i.test(host);
    // نستخدم مسار /api للاستفادة من إعادة التوجيه في netlify.toml بدلاً من المنفذ المباشر
    const base = isNetlify ? '/api' : '/api';
    console.log('[DEBUG] getApiBase() returning:', base, 'for host:', host);
    return base;
  } catch (err) {
    console.log('[DEBUG] getApiBase() fallback to /api, error:', err);
    return '/api';
  }
}
