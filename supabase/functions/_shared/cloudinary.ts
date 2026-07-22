// R2 Universal Upload Module
// يستخدم من Supabase Edge Functions فقط — لا يُستخدم مباشرة من المتصفح

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const ALLOWED_PDF_TYPES = ['application/pdf'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'];

const VIDEO_MAX_SIZE = 5 * 1024 * 1024 * 1024;
const IMAGE_MAX_SIZE = 10 * 1024 * 1024;
const PDF_MAX_SIZE = 50 * 1024 * 1024;
const ATTACHMENT_MAX_SIZE = 100 * 1024 * 1024;

async function hmacSha256(key: CryptoKey, data: string): Promise<ArrayBuffer> {
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
}

async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSigningKey(secret: string, date: string, region: string, service: string): Promise<CryptoKey> {
  const kDate = await hmacSha256(await crypto.subtle.importKey('raw', new TextEncoder().encode('AWS4' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), date);
  const kRegion = await hmacSha256(await crypto.subtle.importKey('raw', kDate, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), region);
  const kService = await hmacSha256(await crypto.subtle.importKey('raw', kRegion, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), service);
  return crypto.subtle.importKey('raw', await hmacSha256(await crypto.subtle.importKey('raw', kService, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), 'aws4_request'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

function getR2Key(folder: string, filename: string): string {
  const ts = Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${folder}/${ts}_${safe}`;
}

async function uploadToR2(file: any, folder: string, r2Config: { accessKey: string, secretKey: string, bucket: string, endpoint: string, publicUrl: string }) {
  const key = getR2Key(folder, file.name || 'file');
  const contentType = file.type || 'application/octet-stream';
  const host = new URL(r2Config.endpoint).host;
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').substring(0, 8);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').substring(0, 15) + 'Z';
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const canonicalUri = `/${encodeURIComponent(r2Config.bucket).replace(/%2F/g, '/')}/${key}`;
  const canonicalQueryString = [`X-Amz-Algorithm=AWS4-HMAC-SHA256`, `X-Amz-Credential=${encodeURIComponent(r2Config.accessKey + '/' + credentialScope)}`, `X-Amz-Date=${amzDate}`, `X-Amz-Expires=3600`, `X-Amz-SignedHeaders=${encodeURIComponent('content-type;host')}`].sort().join('&');
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const canonicalRequest = `PUT\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;
  const signingKey = await getSigningKey(r2Config.secretKey, dateStamp, 'auto', 's3');
  const signatureBytes = await hmacSha256(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBytes)).map(b => b.toString(16).padStart(2, '0')).join('');
  const uploadUrl = `${r2Config.endpoint}/${r2Config.bucket}/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(r2Config.accessKey + '/' + credentialScope)}&X-Amz-Date=${amzDate}&X-Amz-Expires=3600&X-Amz-SignedHeaders=${encodeURIComponent(signedHeaders)}&X-Amz-Signature=${signature}`;

  const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
  if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);

  const fileUrl = r2Config.publicUrl ? `${r2Config.publicUrl}/${key}` : '';
  return { secure_url: fileUrl, public_id: key, key, bytes: file.size || 0, format: (file.name || '').split('.').pop() || '' };
}

function getR2Config() {
  return {
    accessKey: Deno.env.get('R2_ACCESS_KEY_ID') || '',
    secretKey: Deno.env.get('R2_SECRET_ACCESS_KEY') || '',
    bucket: Deno.env.get('R2_BUCKET') || '',
    endpoint: Deno.env.get('R2_ENDPOINT') || '',
    publicUrl: Deno.env.get('R2_PUBLIC_URL') || '',
  };
}

function validateFile(file: any, allowedTypes: string[], maxSize: number, typeName: string) {
  if (!file) throw new Error('لم يتم اختيار ملف');
  if (!allowedTypes.includes(file.type)) throw new Error(`نوع الملف غير مدعوم لـ ${typeName}`);
  if (file.size > maxSize) throw new Error(`حجم الملف يتجاوز الحد المسموح (${Math.round(maxSize / (1024 * 1024))}MB)`);
}

function uploadVideo(file: any, folder: string) {
  validateFile(file, ALLOWED_VIDEO_TYPES, VIDEO_MAX_SIZE, 'الفيديو');
  return uploadToR2(file, folder || 'videos', getR2Config());
}

function uploadImage(file: any, folder: string) {
  validateFile(file, ALLOWED_IMAGE_TYPES, IMAGE_MAX_SIZE, 'الصور');
  return uploadToR2(file, folder || 'images', getR2Config());
}

function uploadPDF(file: any, folder: string) {
  validateFile(file, ALLOWED_PDF_TYPES, PDF_MAX_SIZE, 'PDF');
  return uploadToR2(file, folder || 'pdfs', getR2Config());
}

function uploadAttachment(file: any, folder: string) {
  const allAllowed = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_PDF_TYPES, ...ALLOWED_AUDIO_TYPES];
  validateFile(file, allAllowed, ATTACHMENT_MAX_SIZE, 'المرفقات');
  return uploadToR2(file, folder || 'attachments', getR2Config());
}

async function deleteFile(url: string) {
  const config = getR2Config();
  if (!url || !config.publicUrl) throw new Error('Missing url or R2 config');
  let key = '';
  if (url.startsWith(config.publicUrl)) {
    key = url.substring(config.publicUrl.length + 1);
  } else {
    try { const u = new URL(url); key = u.pathname.substring(1); } catch { key = url; }
  }
  if (!key) throw new Error('Could not extract key from url');
  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').substring(0, 8);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').substring(0, 15) + 'Z';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const host = new URL(config.endpoint).host;
  const canonicalUri = `/${encodeURIComponent(config.bucket).replace(/%2F/g, '/')}/${key}`;
  const canonicalQueryString = [`X-Amz-Algorithm=AWS4-HMAC-SHA256`, `X-Amz-Credential=${encodeURIComponent(config.accessKey + '/' + credentialScope)}`, `X-Amz-Date=${amzDate}`, `X-Amz-Expires=3600`, `X-Amz-SignedHeaders=${encodeURIComponent('host')}`].sort().join('&');
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';
  const canonicalRequest = `DELETE\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;
  const signingKey = await getSigningKey(config.secretKey, dateStamp, region, service);
  const signatureBytes = await hmacSha256(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBytes)).map(b => b.toString(16).padStart(2, '0')).join('');
  const deleteUrl = `${config.endpoint}/${config.bucket}/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(config.accessKey + '/' + credentialScope)}&X-Amz-Date=${amzDate}&X-Amz-Expires=3600&X-Amz-SignedHeaders=${encodeURIComponent(signedHeaders)}&X-Amz-Signature=${signature}`;
  const res = await fetch(deleteUrl, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(`R2 delete failed: ${res.status}`);
  return { success: true, key };
}

export { uploadVideo, uploadImage, uploadPDF, uploadAttachment, deleteFile };
