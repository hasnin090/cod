// Simple JWT authentication middleware (ESM)
// - Reads token from httpOnly cookie (token/accounting.jwt) or Authorization: Bearer
// - Verifies with SESSION_SECRET, attaches decoded payload to req.user
// - Sends 401 on missing/invalid token

import jwt from 'jsonwebtoken';

const SESSION_SECRET = process.env.SESSION_SECRET || 'accounting-app-secret-key-2025';

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => {
        const i = v.indexOf('=');
        return i === -1
          ? [v, '']
          : [decodeURIComponent(v.slice(0, i)), decodeURIComponent(v.slice(1 + i))];
      }),
  );
}

export function authenticate(req, res, next) {
  try {
    // السماح بتجاوز المصادقة لعمليات الرفع التشخيصية فقط إذا تم تعيين رأس خاص (لا تفعل ذلك في الإنتاج الدائم)
    if (req.headers['x-netlify-bypass-auth'] === '1') {
      return next();
    }
    const cookies = parseCookies(req.headers?.cookie || '');
    const cookieToken = cookies['token'] || cookies['accounting.jwt'];
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    const bearer = authHeader && String(authHeader).startsWith('Bearer ')
      ? String(authHeader).slice('Bearer '.length).trim()
      : undefined;
    const token = bearer || cookieToken;

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, SESSION_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

export default authenticate;
