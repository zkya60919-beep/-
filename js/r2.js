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

async function r2SignBatch(items) {
  const res = await fetch(`${CONFIG.SUPABASE.URL}/functions/v1/${R2.SIGN_FN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: CONFIG.SUPABASE.ANON_KEY, Authorization: `Bearer ${CONFIG.SUPABASE.ANON_KEY}` },
    body: JSON.stringify({ items })
  });
  if (!res.ok) throw new Error('فشل الحصول على توقيعات الرفع');
  return res.json();
}

const MULTIPART_THRESHOLD = 100 * 1024 * 1024;
const PART_SIZE = 5 * 1024 * 1024;
const MULTIPART_CONCURRENCY = 5;

function r2EfPost(body) {
  return fetch(`${CONFIG.SUPABASE.URL}/functions/v1/${R2.SIGN_FN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: CONFIG.SUPABASE.ANON_KEY, Authorization: `Bearer ${CONFIG.SUPABASE.ANON_KEY}` },
    body: JSON.stringify(body)
  });
}

async function r2MultipartInit(key, contentType) {
  const res = await r2EfPost({ action: 'multipart-create', key, content_type: contentType });
  if (!res.ok) throw new Error('فشل بدء الرفع المتعدد');
  const d = await res.json();
  return d.upload_id;
}

async function r2MultipartSignParts(key, contentType, uploadId, partCount) {
  const res = await r2EfPost({ action: 'multipart-sign', key, content_type: contentType, upload_id: uploadId, part_count: partCount, part_size: PART_SIZE });
  if (!res.ok) throw new Error('فشل توقيع الأجزاء');
  const d = await res.json();
  return d.parts;
}

async function r2MultipartComplete(key, uploadId, parts) {
  const res = await r2EfPost({ action: 'multipart-complete', key, upload_id: uploadId, parts });
  if (!res.ok) throw new Error('فشل إنهاء الرفع المتعدد');
  return res.json();
}

async function uploadPart(partUrl, blob, partNum, ct) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', partUrl);
    xhr.setRequestHeader('Content-Type', ct);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag');
        resolve({ PartNumber: partNum, ETag: etag });
      } else {
        reject(new Error(`خطأ رفع الجزء ${partNum}: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('انقطع الاتصال أثناء رفع جزء'));
    xhr.timeout = 300000;
    xhr.send(blob);
  });
}

async function uploadDirect(file, folder, onProgress, preSignedUrl) {
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

      const ct = r2ContentType(file);
      let upload_url, file_url, key;

      if (preSignedUrl) {
        upload_url = preSignedUrl.upload_url;
        file_url = preSignedUrl.file_url;
        key = preSignedUrl.key;
      } else {
        const uploadFolder = folder || 'uploads';
        const k = getR2Key(uploadFolder, file.name);
        const sig = await r2Sign(k, ct, 'upload');
        upload_url = sig.upload_url;
        file_url = sig.file_url;
        key = sig.key;
      }

      if (file.size > MULTIPART_THRESHOLD) {
        const totalParts = Math.ceil(file.size / PART_SIZE);
        if (onProgress) onProgress(0, 'جاري بدء الرفع المتعدد...');

        const uploadId = await r2MultipartInit(key, ct);
        const partsMeta = await r2MultipartSignParts(key, ct, uploadId, totalParts);
        const completedParts = [];
        let uploadedBytes = 0;

        let partIdx = 0;
        async function partWorker() {
          while (partIdx < totalParts) {
            const p = partIdx++;
            const start = p * PART_SIZE;
            const end = Math.min(start + PART_SIZE, file.size);
            const blob = file.slice(start, end);
            const result = await uploadPart(partsMeta[p].url, blob, p + 1, ct);
            completedParts.push(result);
            uploadedBytes += end - start;
            if (onProgress) {
              const pct = Math.round((uploadedBytes / file.size) * 100);
              onProgress(pct, `رفع ${pct}%`);
            }
          }
        }

        const workers = [];
        for (let w = 0; w < Math.min(MULTIPART_CONCURRENCY, totalParts); w++) workers.push(partWorker());
        await Promise.all(workers);

        const final = await r2MultipartComplete(key, uploadId, completedParts);
        if (onProgress) onProgress(100, 'تم الرفع 100%');
        resolve({
          secure_url: final.file_url || file_url,
          public_id: key,
          key: key,
          bytes: file.size,
          format: file.name.split('.').pop()
        });
        return;
      }

      const xhr = new XMLHttpRequest();
      xhr.open('PUT', upload_url);
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
            secure_url: file_url,
            public_id: key,
            key: key,
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

async function preSignFile(folder, filename, contentType) {
  const key = getR2Key(folder, filename);
  const sig = await r2Sign(key, contentType, 'upload');
  return { upload_url: sig.upload_url, file_url: sig.file_url, key: sig.key };
}

async function preSignBatch(files) {
  const batchItems = files.map(f => ({
    key: getR2Key(f.folder || 'uploads', f.file.name),
    content_type: r2ContentType(f.file),
    action: 'upload'
  }));
  const res = await r2SignBatch(batchItems);
  return (res.results || []).map((r, i) => ({
    upload_url: r.upload_url,
    file_url: r.file_url,
    key: r.key
  }));
}

async function uploadFilesParallel(items, concurrency) {
  concurrency = concurrency || 5;
  let idx = 0;
  const results = [];
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      const item = items[i];
      try {
        results[i] = await uploadDirect(item.file, item.folder, item.onProgress, item._preSigned);
      } catch (err) {
        results[i] = { error: err };
      }
    }
  }
  const workers = [];
  for (let w = 0; w < Math.min(concurrency, items.length); w++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

window.uploadImage = uploadImage;
window.uploadVideo = uploadVideo;
window.uploadPDF = uploadPDF;
window.uploadAttachment = uploadAttachment;
window.uploadFile = uploadFile;
window.uploadFilesParallel = uploadFilesParallel;
window.preSignFile = preSignFile;
window.preSignBatch = preSignBatch;
window.deleteCloudinaryFile = deleteCloudinaryFile;
window.R2 = R2;
