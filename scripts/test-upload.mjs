import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';

async function testUpload() {
  const token = jwt.sign({ id: 1, role: 'admin', email: 'admin@example.com' }, 'accounting-app-secret-key-2025');
  const filePath = path.resolve('delete_test.txt');
  if (!fs.existsSync(filePath)) {
    console.error('Test file not found at', filePath);
    process.exit(1);
  }

  const form = new FormData();
  const file = new File([fs.readFileSync(filePath)], path.basename(filePath), { type: 'text/plain' });
  form.append('file', file);
  form.append('name', 'Test Doc');
  form.append('description', 'CLI upload');
  form.append('projectId', 'all');
  form.append('isManagerDocument', 'false');

  const urls = ['http://localhost:3000/api/upload-document', 'http://localhost:3001/api/upload-document'];
  let lastErr;
  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const text = await resp.text();
      console.log('URL:', url);
      console.log('Status:', resp.status);
      console.log('x-degraded-mode:', resp.headers.get('x-degraded-mode'));
      console.log('Body:', text);
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  console.error('All attempts failed:', lastErr?.message || lastErr);
  process.exit(1);
}

testUpload();
