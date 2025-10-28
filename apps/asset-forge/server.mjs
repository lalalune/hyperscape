import { createServer } from 'http';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 8080;
const DIST_DIR = join(__dirname, 'dist');

console.log('='.repeat(60));
console.log('Asset Forge Frontend Server - Starting');
console.log('='.repeat(60));
console.log('Environment PORT:', process.env.PORT);
console.log('Using PORT:', PORT);
console.log('Current directory:', __dirname);
console.log('Dist directory:', DIST_DIR);
console.log('Node version:', process.version);
console.log('='.repeat(60));

// Verify dist directory exists
if (!existsSync(DIST_DIR)) {
  console.error('❌ CRITICAL: dist directory does not exist!');
  console.error('Expected path:', DIST_DIR);
  console.error('This usually means the build step failed.');
  process.exit(1);
}

// Verify index.html exists
const indexPath = join(DIST_DIR, 'index.html');
if (!existsSync(indexPath)) {
  console.error('❌ CRITICAL: index.html not found in dist directory!');
  console.error('Expected path:', indexPath);
  console.error('Available files:', readdirSync(DIST_DIR));
  process.exit(1);
}

console.log('✅ Dist directory verified');
console.log('✅ index.html found');
console.log('='.repeat(60));

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.br': 'application/octet-stream',
  '.gz': 'application/gzip',
};

const server = createServer((req, res) => {
  let filePath = join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);

  // Security: prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Check if file exists
  if (!existsSync(filePath)) {
    // SPA fallback: serve index.html for client-side routing
    filePath = join(DIST_DIR, 'index.html');
  }

  // Check if it's a directory
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }

  // Read and serve file
  try {
    const content = readFileSync(filePath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
    });
    res.end(content);
  } catch (error) {
    console.error('[Server] Error serving file:', {
      requestedPath: req.url,
      resolvedPath: filePath,
      error: error.message,
      stack: error.stack
    });
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

// Handle server errors
server.on('error', (error) => {
  console.error('='.repeat(60));
  console.error('❌ SERVER ERROR');
  console.error('='.repeat(60));
  console.error('Error:', error.message);
  console.error('Code:', error.code);
  console.error('Stack:', error.stack);
  console.error('='.repeat(60));

  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    console.error('This usually means another process is using this port');
  }

  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log('✅ SERVER STARTED SUCCESSFULLY');
  console.log('='.repeat(60));
  console.log(`🌐 Server running on: http://0.0.0.0:${PORT}`);
  console.log(`📁 Serving files from: ${DIST_DIR}`);
  console.log(`🕒 Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  console.log('Waiting for connections...');
  console.log('='.repeat(60));
});
