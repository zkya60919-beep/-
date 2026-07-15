// Cloudinary Frontend Upload Module
// Direct upload: Browser → Cloudinary CDN (أسرع بكثير)
// التوقيع يتم توليده عبر Edge Function (آمن)

const CLOUDINARY = {
  IMAGE_FN: 'image-upload',
  VIDEO_FN: 'video-upload',
  PDF_FN: 'pdf-upload',
  ATTACHMENT_FN: 'attachment-upload',
  DELETE_FN: 'delete-file' };

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
const ALLOWED_PDF_TYPES = ['application/pdf'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'];

const _sigCache = {};

function serializeCloudinaryParams(params, prefix) {
  const pairs = [];
  Object.keys(params).sort().forEach((key) => {
    const value = params[key];
    const paramKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === 'object') {
          pairs.push(...serializeCloudinaryParams(item, `${paramKey}[${index}]`));
        } else {
          pairs.push([`${paramKey}[${index}]`, String(item)]);
        }
      });
    } else if (value && typeof value === 'object') {
      pairs.push(...serializeCloudinaryParams(value, paramKey));
    } else if (value !== undefined && value !== null) {
      pairs.push([paramKey, String(value)]);
    }
  });
  return pairs;
}

function buildQueryString(params) {
  return serializeCloudinaryParams(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

async function getSignature(folder, extraParams = {}) {
  const targetParams = { folder, ...extraParams };
  const cacheKey = buildQueryString(targetParams) || 'default';
  const cached = _sigCache[cacheKey];
  if (cached && Date.now() - cached.fetchedAt < 60000) return cached;
  const query = buildQueryString(targetParams);
  const url = query ? `${CONFIG.SUPABASE.URL}/functions/v1/cloudinary-signature?${query}` : `${CONFIG.SUPABASE.URL}/functions/v1/cloudinary-signature`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { apikey: CONFIG.SUPABASE.ANON_KEY, Authorization: `Bearer ${CONFIG.SUPABASE.ANON_KEY}` }
  });
  if (!res.ok) throw new Error('فشل الاتصال بخادم التوقيع :( تحقق من اتصالك بالإنترنت');
  const data = await res.json();
  data.fetchedAt = Date.now();
  _sigCache[cacheKey] = data;
  return data;
}

function resourceType(file) {
  const t = file.type || '';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('image/')) return 'image';
  if (t === 'application/pdf') return 'image';
  return 'raw';
}

function chunkResourceType(file) {
  const t = file.type || '';
  if (t.startsWith('video/')) return 'video';
  return 'image';
}

function validateSize(file, maxMb) {
  if (file.size > maxMb * 1024 * 1024) throw new Error(`حجم الملف يتجاوز ${maxMb}MB`);
}

function uploadDirect(file, folder, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      const t = file.type || '';

      // Validate file size with specific limits
      if (t.startsWith('video/')) {
        if (file.size > 2000 * 1024 * 1024) throw new Error('حجم الفيديو يتجاوز 2 جيجابايت - استخدم ملفاً أصغر');
        validateSize(file, 2000); // Increased limit due to chunked upload
      } else if (t.startsWith('image/')) {
        validateSize(file, 20);
      } else if (t === 'application/pdf') {
        validateSize(file, 20);
      } else {
        validateSize(file, 20);
      }

      const uploadFolder = folder || 'uploads';
      const sig = await getSignature(uploadFolder);
      const endpoint = `https://api.cloudinary.com/v1_1/${sig.cloud_name}/${resourceType(file)}/upload`;
      // Use chunked upload for files > 8MB (free plan limit is 10MB for direct upload)
      const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks
      if (file.size > CHUNK_SIZE) {
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const uploadId = Date.now().toString(36) + '_' + Math.random().toString(36).substring(2);
        let currentChunk = 0;
        let isAborted = false;
        const chunkEndpoint = `https://api.cloudinary.com/v1_1/${sig.cloud_name}/${chunkResourceType(file)}/upload`;

        const uploadNextChunk = () => {
          if (isAborted) return;
          const start = currentChunk * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);

          const formData = new FormData();
          formData.append('file', chunk);
          formData.append('api_key', sig.api_key);
          formData.append('timestamp', String(sig.timestamp));
          formData.append('folder', uploadFolder);
          formData.append('signature', sig.signature);
          // Removed eager transformations (quality, fetch_format) to radically speed up upload completion time

          const xhr = new XMLHttpRequest();
          xhr.open('POST', chunkEndpoint);
          
          xhr.setRequestHeader('X-Unique-Upload-Id', uploadId);
          xhr.setRequestHeader('Content-Range', `bytes ${start}-${end - 1}/${file.size}`);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
              const overallLoaded = start + e.loaded;
              const pct = Math.round((overallLoaded / file.size) * 100);
              onProgress(Math.min(pct, 99), `رفع ${Math.min(pct, 99)}%`);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              currentChunk++;
              if (currentChunk < totalChunks) {
                uploadNextChunk();
              } else {
                try {
                  const data = JSON.parse(xhr.responseText);
                  if (onProgress) onProgress(100, 'تم الرفع 100%');
                  resolve({
                    secure_url: data.secure_url,
                    public_id: data.public_id,
                    resource_type: data.resource_type,
                    bytes: data.bytes,
                    duration: data.duration || null,
                    width: data.width || null,
                    height: data.height || null,
                    format: data.format });
                } catch (e) {
                  reject(new Error('خطأ في قراءة استجابة الخادم عند الانتهاء.'));
                }
              }
            } else {
              try {
                const errData = JSON.parse(xhr.responseText);
                const errMsg = errData.error?.message || '';
                if (errMsg.includes('File size too large') && errMsg.includes('Maximum is 104857600')) {
                  reject(new Error('حجم الفيديو يتجاوز 100 ميجابايت! الخطة المجانية في حساب Cloudinary الخاص بك لا تسمح برفع فيديوهات أكبر من 100 ميجابايت. يرجى ضغط الفيديو أو ترقية حساب Cloudinary.'));
                } else if (errMsg.includes('File size too large')) {
                  reject(new Error(`حجم الفيديو كبير جداً بالنسبة لخطة Cloudinary الخاصة بك: ${errMsg}`));
                } else {
                  reject(new Error(`خطأ في الرفع (كود ${xhr.status}): ${errMsg}`));
                }
              } catch (e) {
                reject(new Error(`خطأ في الرفع (كود ${xhr.status}) - ${xhr.responseText}`));
              }
            }
          };

          xhr.onerror = () => {
            if (isAborted) return;
            reject(new Error('انقطع الاتصال. تأكد من جودة الإنترنت وعدم وجود إضافات تمنع الرفع (AdBlock).'));
          };

          xhr.ontimeout = () => {
            if (isAborted) return;
            reject(new Error('انتهت مهلة رفع الجزء. الإنترنت بطيء جداً.'));
          };

          xhr.timeout = 300000; // 5 minutes per chunk
          xhr.send(formData);
        };

        uploadNextChunk();
      } else {
        // Standard upload for small files
        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', sig.api_key);
        formData.append('timestamp', String(sig.timestamp));
        formData.append('folder', uploadFolder);
        formData.append('signature', sig.signature);
        // Removed eager transformations to radically speed up upload completion time

        const xhr = new XMLHttpRequest();
        xhr.open('POST', endpoint);
        
        let isAborted = false;
        xhr.onabort = () => {
          isAborted = true;
          reject(new Error('تم إلغاء التحميل.'));
        };

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            const pct = Math.round((e.loaded / e.total) * 100);
            onProgress(pct, `رفع ${pct}%`);
          }
        };

        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve({
                secure_url: data.secure_url,
                public_id: data.public_id,
                resource_type: data.resource_type,
                bytes: data.bytes,
                duration: data.duration || null,
                width: data.width || null,
                height: data.height || null,
                format: data.format });
            } else {
              reject(new Error(data.error?.message || `خطأ في الرفع (كود ${xhr.status})`));
            }
          } catch { reject(new Error('خطأ في استجابة الخادم.')); }
        };

        xhr.onerror = () => {
          if (isAborted) return;
          reject(new Error('تعذر الاتصال بالخادم. تحقق من الإنترنت.'));
        };

        xhr.ontimeout = () => {
          if (isAborted) return;
          reject(new Error('انتهت مهلة الرفع.'));
        };
        
        xhr.timeout = 600000; // 10 minutes
        xhr.send(formData);
      }
    } catch (err) { reject(err); }
  });
}

async function uploadImage(file, folder, onProgress) {
  if (!file.type.startsWith('image/')) throw new Error('نوع الملف غير مدعوم');
  return uploadDirect(file, folder || 'images', onProgress);
}

async function uploadVideo(file, folder, onProgress) {
  if (!file.type.startsWith('video/')) throw new Error('نوع الملف غير مدعوم');
  return uploadDirect(file, folder || 'videos', onProgress);
}

async function uploadPDF(file, folder, onProgress) {
  if (file.type !== 'application/pdf') throw new Error('نوع الملف غير مدعوم');
  return uploadDirect(file, folder || 'pdfs', onProgress);
}

async function uploadAttachment(file, folder, onProgress) {
  return uploadDirect(file, folder || 'attachments', onProgress);
}

async function deleteCloudinaryFile(publicId, resourceType) {
  const res = await fetch(`${CONFIG.SUPABASE.URL}/functions/v1/${CLOUDINARY.DELETE_FN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: CONFIG.SUPABASE.ANON_KEY, Authorization: `Bearer ${CONFIG.SUPABASE.ANON_KEY}` },
    body: JSON.stringify({ public_id: publicId, resource_type: resourceType }) });
  if (!res.ok) throw new Error('فشل حذف الملف');
  return res.json();
}

async function uploadFile(file, folder, onProgress) {
  const type = file.type || '';
  if (type.startsWith('video/')) return uploadVideo(file, folder, onProgress);
  if (type.startsWith('image/')) return uploadImage(file, folder, onProgress);
  if (type === 'application/pdf') return uploadPDF(file, folder, onProgress);
  return uploadAttachment(file, folder, onProgress);
}

window.uploadImage = uploadImage;
window.uploadVideo = uploadVideo;
window.uploadPDF = uploadPDF;
window.uploadAttachment = uploadAttachment;
window.uploadFile = uploadFile;
window.deleteCloudinaryFile = deleteCloudinaryFile;
window.CLOUDINARY = CLOUDINARY;