export function getApiBase(): string {
  try {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isNetlify = /\.netlify\.app$/i.test(host) || /netlify\.app$/i.test(host);
    // نستخدم مسار /api للاستفادة من إعادة التوجيه في netlify.toml بدلاً من المنفذ المباشر
    if (isNetlify) return '/api';
  } catch {}
  return '/api';
}
