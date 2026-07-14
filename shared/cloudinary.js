// Cloudinary Universal Upload Module
// يستخدم من Supabase Edge Functions فقط — لا يُستخدم مباشرة من المتصفح

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const ALLOWED_PDF_TYPES = ['application/pdf'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'];

const VIDEO_MAX_SIZE = 500 * 1024 * 1024; // 500MB
const IMAGE_MAX_SIZE = 10 * 1024 * 1024;  // 10MB
const PDF_MAX_SIZE = 50 * 1024 * 1024;    // 50MB
const ATTACHMENT_MAX_SIZE = 100 * 1024 * 1024; // 100MB

async function sha1Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function cloudinaryUploadUrl(cloudName, resourceType) {
  return `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
}

async function uploadToCloudinary(file, resourceType, folder, cloudName, apiKey, apiSecret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder, timestamp: String(timestamp) };
  const sortedKeys = Object.keys(params).sort();
  const sigStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&') + apiSecret;
  const signature = await sha1Hex(sigStr);

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('signature', signature);

  const res = await fetch(cloudinaryUploadUrl(cloudName, resourceType), { method: 'POST', body: form });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message || `Cloudinary upload failed: ${res.status}`);
  }

  return {
    secure_url: data.secure_url,
    public_id: data.public_id,
    resource_type: data.resource_type,
    bytes: data.bytes,
    duration: data.duration || null,
    width: data.width || null,
    height: data.height || null,
    format: data.format
  };
}

function validateFile(file, allowedTypes, maxSize, typeName) {
  if (!file) throw new Error('لم يتم اختيار ملف');
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`نوع الملف غير مدعوم لـ ${typeName}. الأنواع المسموحة: ${allowedTypes.join(', ')}`);
  }
  if (file.size > maxSize) {
    const maxMb = Math.round(maxSize / (1024 * 1024));
    throw new Error(`حجم الملف يتجاوز الحد المسموح (${maxMb}MB)`);
  }
}

async function uploadVideo(file, folder, cloudName, apiKey, apiSecret) {
  validateFile(file, ALLOWED_VIDEO_TYPES, VIDEO_MAX_SIZE, 'الفيديو');
  return uploadToCloudinary(file, 'video', folder || 'videos', cloudName, apiKey, apiSecret);
}

async function uploadImage(file, folder, cloudName, apiKey, apiSecret) {
  validateFile(file, ALLOWED_IMAGE_TYPES, IMAGE_MAX_SIZE, 'الصور');
  return uploadToCloudinary(file, 'image', folder || 'images', cloudName, apiKey, apiSecret);
}

async function uploadPDF(file, folder, cloudName, apiKey, apiSecret) {
  validateFile(file, ALLOWED_PDF_TYPES, PDF_MAX_SIZE, 'PDF');
  return uploadToCloudinary(file, 'image', folder || 'pdfs', cloudName, apiKey, apiSecret);
}

async function uploadAttachment(file, folder, cloudName, apiKey, apiSecret) {
  const allAllowed = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_PDF_TYPES, ...ALLOWED_AUDIO_TYPES];
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const resourceType = isImage ? 'image' : 'auto';
  validateFile(file, allAllowed, ATTACHMENT_MAX_SIZE, 'المرفقات');
  return uploadToCloudinary(file, resourceType, folder || 'attachments', cloudName, apiKey, apiSecret);
}

async function deleteFile(publicId, resourceType, cloudName, apiKey, apiSecret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { public_id: publicId, timestamp: String(timestamp) };
  const sortedKeys = Object.keys(params).sort();
  const sigStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&') + apiSecret;
  const signature = await sha1Hex(sigStr);

  const form = new FormData();
  form.append('public_id', publicId);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, { method: 'POST', body: form });
  const data = await res.json();

  if (!res.ok || data.result !== 'ok') {
    throw new Error(data.error?.message || 'فشل حذف الملف من Cloudinary');
  }

  return data;
}

export { uploadVideo, uploadImage, uploadPDF, uploadAttachment, deleteFile };