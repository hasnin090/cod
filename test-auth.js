import jwt from 'jsonwebtoken';

const SESSION_SECRET = process.env.SESSION_SECRET || 'accounting-app-secret-key-2025';
const testToken = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, SESSION_SECRET);

console.log('Test token:', testToken);
