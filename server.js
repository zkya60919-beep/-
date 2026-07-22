const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// Load .env file if it exists
try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
                const key = trimmed.substring(0, eqIdx).trim();
                const value = trimmed.substring(eqIdx + 1).trim();
                if (!process.env[key]) process.env[key] = value;
            }
        }
        console.log('📄 Loaded .env file');
    }
} catch (e) {
    console.warn('⚠️  لم يتم تحميل ملف .env:', e.message);
}

const PORT = 3000;
const ROOT = __dirname;

// Cloudflare R2 credentials (server-side only - loaded from env vars or .env)
const R2 = {
    ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
    ACCESS_KEY: process.env.R2_ACCESS_KEY_ID || '',
    SECRET_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
    BUCKET: process.env.R2_BUCKET || '',
    PUBLIC_URL: process.env.R2_PUBLIC_URL || ''
};

if (!R2.SECRET_KEY) {
    console.warn('⚠️  تحذير: R2_SECRET_ACCESS_KEY غير مُحدد. وظيفة /api/proxy للـ R2 ستتوقف.');
    console.warn('   الحل: انسخ ملف ".env.example" إلى ".env" وعدّل القيم.');
}

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.xml': 'application/xml',
    '.txt': 'text/plain; charset=utf-8',
    '.pdf': 'application/pdf',
    '.webp': 'image/webp',
};

http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathname = parsedUrl.pathname;

    // Download proxy: fetch remote URL and stream to client
    if (pathname === '/api/proxy') {
        const targetUrl = parsedUrl.searchParams.get('url');
        if (!targetUrl) {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Missing url parameter');
            return;
        }

        // 🚀 RANGE REQUESTS: Support Range headers for streaming
        const range = req.headers.range;
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Range',
            'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600', // 🚀 CACHE: Cache for 1 hour
            'Content-Disposition': 'inline'
        };

        // For R2 public URLs, proxy directly
        const isR2Url = R2.PUBLIC_URL && targetUrl.includes(R2.PUBLIC_URL);
        if (isR2Url) {
            proxyGenericFile(targetUrl, res, range, headers);
        } else {
            const proxyOptions = {
                rejectUnauthorized: false,
                headers: range ? { 'Range': range } : {}
            };

            const proxyReq = https.get(targetUrl, proxyOptions, (proxyRes) => {
                // 🚀 RANGE REQUESTS: Handle partial content
                if (range && proxyRes.statusCode === 206) {
                    headers['Content-Range'] = proxyRes.headers['content-range'];
                    headers['Content-Length'] = proxyRes.headers['content-length'];
                    res.writeHead(206, headers);
                } else {
                    headers['Content-Type'] = proxyRes.headers['content-type'] || 'application/octet-stream';
                    headers['Content-Length'] = proxyRes.headers['content-length'];
                    res.writeHead(proxyRes.statusCode, headers);
                }

                proxyRes.pipe(res);
            });

            proxyReq.on('error', () => {
                res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Failed to fetch remote file');
            });
        }
        return;
    }

    let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
    const ext = path.extname(filePath);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }
        const nonce = crypto.randomBytes(16).toString('base64');
        res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
        });
        res.end(data);
    });
}).listen(PORT, () => {
    console.log('Server running at http://localhost:' + PORT);
});

/**
 * Proxy a remote file asset (R2 or any URL) to the client.
 */
function proxyGenericFile(cdnUrl, res, range, headers) {
    const proxyOptions = {
        rejectUnauthorized: false,
        headers: range ? { 'Range': range } : {}
    };

    https.get(cdnUrl, proxyOptions, (proxyRes) => {
        if (range && proxyRes.statusCode === 206) {
            headers['Content-Range'] = proxyRes.headers['content-range'];
            headers['Content-Length'] = proxyRes.headers['content-length'];
            res.writeHead(206, headers);
        } else {
            headers['Content-Type'] = proxyRes.headers['content-type'] || 'application/octet-stream';
            headers['Content-Length'] = proxyRes.headers['content-length'];
            res.writeHead(proxyRes.statusCode, headers);
        }
        proxyRes.pipe(res);
    }).on('error', () => {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Failed to fetch remote file');
    });
}
