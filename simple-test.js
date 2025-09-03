import http from 'http';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  if (req.url === '/api/deferred-payments') {
    res.end(JSON.stringify([]));
  } else {
    res.end(JSON.stringify({ message: 'Hello World', url: req.url }));
  }
});

server.listen(3001, () => {
  console.log('Simple test server running on port 3001');
});
