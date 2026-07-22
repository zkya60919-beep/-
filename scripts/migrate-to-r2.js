/**
 * Migration Script: Cloudinary + Supabase Storage → Cloudflare R2
 *
 * Uses supabase CLI for DB reads/writes (no service role key needed locally).
 *
 * Usage:
 *   node scripts/migrate-to-r2.js --scan              (scan DB, save scan.json)
 *   node scripts/migrate-to-r2.js --execute            (run migration using scan.json)
 *   node scripts/migrate-to-r2.js --execute --delete   (run + delete old Cloudinary files)
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { execSync } = require('child_process');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Configuration ────────────────────────────────────────────────────────────
const R2_CONFIG = {
  endpoint: process.env.R2_ENDPOINT || 'https://8bdf2127dca067d9de2a415c901339de.r2.cloudflarestorage.com',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  bucket: process.env.R2_BUCKET || 'albasit',
  publicUrl: process.env.R2_PUBLIC_URL || 'https://pub-0881561106d84dafbe8c2c34cb712534.r2.dev',
};

const CLOUDINARY = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'mgqjgjer',
  api_key: process.env.CLOUDINARY_API_KEY || '993147446468233',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'tsplN8l60SiW1_Iu5_OM2pB6XyM',
};

const ARGS = process.argv.slice(2);
const SCAN_MODE = ARGS.includes('--scan');
const EXECUTE_MODE = ARGS.includes('--execute');
const DO_DELETE = ARGS.includes('--delete');

const SCAN_FILE = path.join(__dirname, 'scan.json');

// ─── Utility Functions ────────────────────────────────────────────────────────
function log(emoji, msg) {
  console.log(`${emoji}  ${msg}`);
}

function runSQLFromFile(sqlFile) {
  const cmd = `supabase db query --linked -f "${sqlFile}"`;
  const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  const match = result.match(/\{[\s\S]*"rows"[\s\S]*\}/);
  if (!match) return [];
  const parsed = JSON.parse(match[0]);
  return parsed.rows || [];
}

function runUpdateSQL(sql) {
  const tmpFile = path.join(__dirname, '_tmp_update.sql');
  fs.writeFileSync(tmpFile, sql);
  try {
    const cmd = `supabase db query --linked -f "${tmpFile}"`;
    execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

function isCloudinaryUrl(url) {
  return url && url.includes('res.cloudinary.com');
}

function isSupabaseStorageUrl(url) {
  return url && url.includes('supabase.co/storage');
}

function isR2Url(url) {
  return url && (url.includes('cloudflarestorage.com') || url.includes('.r2.dev'));
}

function isYouTubeUrl(url) {
  return url && (url.includes('youtube.com') || url.includes('youtu.be'));
}

function extractCloudinaryPublicId(url) {
  try {
    const parts = url.split('/');
    const uploadIdx = parts.indexOf('upload');
    if (uploadIdx === -1) return null;
    const afterUpload = parts.slice(uploadIdx + 1);
    if (afterUpload[0] && afterUpload[0].startsWith('v')) afterUpload.shift();
    const lastPart = afterUpload.pop();
    const ext = path.extname(lastPart);
    const publicId = lastPart.slice(0, -ext.length) || lastPart;
    const folder = afterUpload.join('/');
    return folder ? `${folder}/${publicId}` : publicId;
  } catch {
    return null;
  }
}

function extractSupabaseStoragePath(url) {
  try {
    const match = url.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)$/);
    if (match) return { bucket: match[1], path: match[2] };
    return null;
  } catch {
    return null;
  }
}

function getR2Key(originalUrl, tableType) {
  const ts = Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
  let filename;
  try {
    const url = new URL(originalUrl);
    filename = path.basename(url.pathname);
  } catch {
    filename = 'file';
  }
  filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  const folderMap = {
    video: 'videos',
    image: 'images',
    pdf: 'pdfs',
    attachment: 'attachments',
  };
  const folder = folderMap[tableType] || 'misc';
  return `${folder}/${ts}_${filename}`;
}

function getContentTypeFromUrl(url) {
  const ext = path.extname(url.split('?')[0]).toLowerCase();
  const map = {
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.avi': 'video/x-msvideo',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  };
  return map[ext] || 'application/octet-stream';
}

function downloadFile(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, maxRedirects - 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ buffer, contentType: res.headers['content-type'] || getContentTypeFromUrl(url), size: buffer.length });
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

let s3Client = null;
function getS3() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: R2_CONFIG.endpoint,
      credentials: { accessKeyId: R2_CONFIG.accessKeyId, secretAccessKey: R2_CONFIG.secretAccessKey },
    });
  }
  return s3Client;
}

async function uploadToR2(key, buffer, contentType) {
  await getS3().send(new PutObjectCommand({
    Bucket: R2_CONFIG.bucket, Key: key, Body: buffer, ContentType: contentType,
  }));
  return `${R2_CONFIG.publicUrl}/${key}`;
}

async function deleteCloudinaryResource(publicId, resourceType) {
  if (!CLOUDINARY.api_secret) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const stringToSign = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY.api_secret}`;
  const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

  return new Promise((resolve, reject) => {
    const postData = `public_id=${encodeURIComponent(publicId)}&timestamp=${timestamp}&api_key=${CLOUDINARY.api_key}&signature=${signature}`;
    const req = https.request({
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${CLOUDINARY.cloud_name}/${resourceType}/destroy`,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({ body }); } });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ─── Scan Mode ────────────────────────────────────────────────────────────────
async function scan() {
  log('🔍', 'Scanning database for all file URLs...');

  const scanSqlFile = path.join(__dirname, 'scan.sql');
  if (!fs.existsSync(scanSqlFile)) {
    log('❌', 'scan.sql not found in scripts/');
    process.exit(1);
  }

  const rows = runSQLFromFile(scanSqlFile);
  const files = [];
  let cloudCount = 0;
  let r2Count = 0;
  let ytCount = 0;
  let otherCount = 0;

  for (const row of rows) {
    const url = row.url;
    if (isCloudinaryUrl(url)) { cloudCount++; files.push(row); }
    else if (isR2Url(url)) { r2Count++; }
    else if (isYouTubeUrl(url)) { ytCount++; }
    else { otherCount++; files.push(row); } // Supabase Storage etc.
  }

  fs.writeFileSync(SCAN_FILE, JSON.stringify(files, null, 2));

  console.log('\n' + '═'.repeat(60));
  log('📊', 'SCAN RESULTS');
  console.log('─'.repeat(60));
  log('☁️', `Cloudinary files: ${cloudCount}`);
  log('📦', `Already on R2: ${r2Count}`);
  log('▶️', `YouTube links: ${ytCount}`);
  log('🔗', `Other (Supabase Storage): ${otherCount}`);
  log('📥', `Files to migrate: ${files.length}`);
  console.log('═'.repeat(60));
  log('💾', `Scan saved to: ${SCAN_FILE}`);
  log('💡', 'Run: node scripts/migrate-to-r2.js --execute');
}

// ─── Execute Mode ─────────────────────────────────────────────────────────────
async function execute() {
  if (!fs.existsSync(SCAN_FILE)) {
    log('❌', 'scan.json not found. Run --scan first.');
    process.exit(1);
  }

  if (!R2_CONFIG.accessKeyId || !R2_CONFIG.secretAccessKey) {
    log('❌', 'Missing R2 credentials. Set env vars.');
    process.exit(1);
  }

  const files = JSON.parse(fs.readFileSync(SCAN_FILE, 'utf-8'));
  log('🚀', `Migrating ${files.length} files to R2...${DO_DELETE ? ' (will delete old files)' : ''}`);

  const results = { total: files.length, migrated: 0, failed: 0, errors: [] };

  for (const row of files) {
    const { tbl, id, col, url } = row;
    log('🔄', `[${tbl}] id=${id} .${col}: ${url.substring(0, 80)}...`);

    try {
      // Step 1: Download
      const dl = await downloadFile(url);
      log('📥', `  Downloaded: ${(dl.size / 1024 / 1024).toFixed(2)} MB`);

      // Step 2: Upload to R2
      const r2Key = getR2Key(url, 'misc');
      const newUrl = await uploadToR2(r2Key, dl.buffer, dl.contentType);
      log('✅', `  Uploaded: ${newUrl.substring(0, 80)}...`);

      // Step 3: Update database
      const updateSql = `UPDATE ${tbl} SET ${col} = '${newUrl}' WHERE id = ${id}`;
      runUpdateSQL(updateSql);
      log('💾', `  Database updated`);

      // Step 4: Delete old Cloudinary file
      if (DO_DELETE && isCloudinaryUrl(url)) {
        const publicId = extractCloudinaryPublicId(url);
        if (publicId) {
          const resType = tbl === 'course_videos' || tbl === 'videos' ? 'video' : 'image';
          const delResult = await deleteCloudinaryResource(publicId, resType);
          log('🗑️', `  Cloudinary: ${JSON.stringify(delResult?.result || 'unknown')}`);
        }
      }

      results.migrated++;
    } catch (err) {
      log('❌', `  Failed: ${err.message}`);
      results.failed++;
      results.errors.push({ tbl, id, col, error: err.message });
    }
  }

  console.log('\n' + '═'.repeat(60));
  log('📊', 'MIGRATION COMPLETE');
  console.log('─'.repeat(60));
  log('✅', `Migrated: ${results.migrated}/${results.total}`);
  log('❌', `Failed: ${results.failed}`);
  if (results.errors.length > 0) {
    console.log('\nFailed items:');
    results.errors.forEach((e) => console.log(`  - ${e.tbl}[${e.id}].${e.col}: ${e.error}`));
  }
  console.log('═'.repeat(60));
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (SCAN_MODE) {
    await scan();
  } else if (EXECUTE_MODE) {
    await execute();
  } else {
    log('💡', 'Usage:');
    log('  ', 'node scripts/migrate-to-r2.js --scan       (scan DB)');
    log('  ', 'node scripts/migrate-to-r2.js --execute     (migrate files)');
    log('  ', 'node scripts/migrate-to-r2.js --execute --delete  (migrate + delete old)');
  }
}

main().catch((err) => {
  log('💥', `Fatal: ${err.message}`);
  console.error(err);
  process.exit(1);
});
