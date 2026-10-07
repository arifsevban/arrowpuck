import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];

  // Route root to demo/index.html
  if (reqPath === '/' || reqPath === '/index.html') {
    const indexPath = path.join(__dirname, 'index.html');
    return serveFile(indexPath, res);
  }

  // Check demo directory first
  const demoPath = path.join(__dirname, reqPath);
  if (fs.existsSync(demoPath) && fs.statSync(demoPath).isFile()) {
    return serveFile(demoPath, res);
  }

  // Check project root (e.g. /dist/arrowpuck.min.js, /assets/...)
  const rootPath = path.join(rootDir, reqPath);
  if (fs.existsSync(rootPath) && fs.statSync(rootPath).isFile()) {
    return serveFile(rootPath, res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

server.listen(PORT, () => {
  console.log(`ArrowPuck demo server listening on http://localhost:${PORT}`);
});
