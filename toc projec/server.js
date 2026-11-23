/**
 * Zero-dependency local development server
 * Uses Node.js standard built-in 'http', 'fs', and 'path' modules.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqUrl;
  try {
    reqUrl = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('400 Bad Request');
    return;
  }
  if (reqUrl === '/api/ip') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ip: getLocalIP(), port: PORT }));
    return;
  }
  if (reqUrl === '/') reqUrl = '/index.html';

  // Resolve and verify the requested path remains inside the project directory.
  const filePath = path.resolve(__dirname, `.${reqUrl}`);
  const relativePath = path.relative(__dirname, filePath);

  // Security: prevent path traversal (including sibling-prefix paths).
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + reqUrl);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

function getLocalIP() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    // Skip virtual host-only adapters like VirtualBox / VMware / vEthernet
    const lower = name.toLowerCase();
    const isVirtual = lower.includes('virtual') || lower.includes('vethernet') || lower.includes('pseudo');
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        if (!isVirtual) {
          ips.unshift(net.address); // Prioritize real physical/Wi-Fi adapters
        } else {
          ips.push(net.address);
        }
      }
    }
  }
  return ips[0] || 'localhost';
}

server.listen(PORT, HOST, () => {
  const localIP = getLocalIP();
  console.log(`\n======================================================`);
  console.log(`🚀 TOC REGEX TO DFA WEB APP IS RUNNING!`);
  console.log(`💻 PC Browser:     http://localhost:${PORT}`);
  console.log(`📱 Mobile Browser: http://${localIP}:${PORT}`);
  console.log(`======================================================\n`);
});
