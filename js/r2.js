// R2 Frontend Upload Module
// Direct upload: Browser → Cloudflare R2 (via presigned URL from Edge Function)

const R2 = {
  SIGN_FN: 'r2-sign',
  DELETE_FN: 'r2-delete'
};

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
const ALLOWED_PDF_TYPES = ['application/pdf'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'];

function getR2Key(folder, filename) {
  const ts = Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${folder}/${ts}_${safe}`;
}

function r2ContentType(file) {
  return file.type || 'application/octet-stream';
}

async function r2Sign(key, contentType, action) {
  const res = await fetch(`${CONFIG.SUPABASE.URL}/functions/v1/${R2.SIGN_FN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: CONFIG.SUPABASE.ANON_KEY, Authorization: `Bearer ${CONFIG.SUPABASE.ANON_KEY}` },
    body: JSON.stringify({ key, content_type: contentType, action: action || 'upload' })
  });
  if (!res.ok) throw new Error('فشل الحصول على توقيع الرفع');
  return res.json();
}

function uploadDirect(file, folder, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      const t = file.type || '';
      if (t.startsWith('video/') && file.size > 5 * 1024 * 1024 * 1024) {
        throw new Error('حجم الفيديو يتجاوز 5 جيجابايت');
      }
      if (t.startsWith('image/') && file.size > 20 * 1024 * 1024) {
        throw new Error('حجم الصورة يتجاوز 20 ميجابايت');
      }
      if (t === 'application/pdf' && file.size > 50 * 1024 * 1024) {
        throw new Error('حجم PDF يتجاوز 50 ميجابايت');
      }

      const uploadFolder = folder || 'uploads';
      const key = getR2Key(uploadFolder, file.name);
      const ct = r2ContentType(file);
      const sig = await r2Sign(key, ct, 'upload');

      const xhr = new XMLHttpRequest();
      xhr.open('PUT', sig.upload_url);
      xhr.setRequestHeader('Content-Type', ct);

      let isAborted = false;
      xhr.onabort = () => { isAborted = true; reject(new Error('تم إلغاء التحميل.')); };

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct, `رفع ${pct}%`);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (onProgress) onProgress(100, 'تم الرفع 100%');
          resolve({
            secure_url: sig.file_url,
            public_id: sig.key,
            key: sig.key,
            bytes: file.size,
            format: file.name.split('.').pop()
          });
        } else {
          reject(new Error(`خطأ في الرفع (كود ${xhr.status})`));
        }
      };

      xhr.onerror = () => {
        if (isAborted) return;
        reject(new Error('انقطع الاتصال. تأكد من جودة الإنترنت.'));
      };

      xhr.ontimeout = () => {
        if (isAborted) return;
        reject(new Error('انتهت مهلة الرفع.'));
      };

      xhr.timeout = 600000;
      xhr.send(file);
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

async function deleteCloudinaryFile(fileUrl) {
  const publicId = fileUrl.replace(CONFIG.SUPABASE.URL + '/functions/v1/' + R2.SIGN_FN, '').trim();
  const key = fileUrl.replace('https://pub-0881561106d84dafbe8c2c34cb712534.r2.dev/', '').trim();
  const deleteSig = await r2Sign(key, '', 'delete');
  const res = await fetch(deleteSig.delete_url, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error('فشل حذف الملف');
  return { success: true };
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
window.R2 = R2;
