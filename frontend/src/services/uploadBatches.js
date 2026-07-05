// The API accepts at most 12 files per multipart request (multer
// upload.array limit) — a full 36-exposure roll must go up as several
// sequential requests, not one giant one.
export const UPLOAD_BATCH_SIZE = 12;

// Cloudflare (in front of blog.enderthoughts.com) drops any request whose
// origin response takes over ~100s, and a home connection uploads a 48MB
// batch far slower than that. Keep each request small enough to complete
// with margin at ~0.35 MB/s measured throughput.
export const UPLOAD_BATCH_BYTES = 16 * 1024 * 1024;

// Splits `files` into batches capped at UPLOAD_BATCH_SIZE files AND
// UPLOAD_BATCH_BYTES total (a single oversized file still goes alone),
// builds a FormData per batch (field name `photos`, matching every upload
// endpoint) and awaits `uploadBatch` for each in order.
// `onProgress(uploadedCount, totalCount)` fires after each completed batch.
// Throws on the first failed batch — earlier batches are already stored
// server-side, so callers should refetch rather than retry the whole set.
export async function uploadInBatches(files, uploadBatch, onProgress) {
  const batches = [];
  let current = [];
  let currentBytes = 0;
  for (const file of files) {
    const overCount = current.length >= UPLOAD_BATCH_SIZE;
    const overBytes = current.length > 0 && currentBytes + file.size > UPLOAD_BATCH_BYTES;
    if (overCount || overBytes) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(file);
    currentBytes += file.size;
  }
  if (current.length > 0) batches.push(current);

  const results = [];
  let uploaded = 0;
  for (const batch of batches) {
    const formData = new FormData();
    batch.forEach(f => formData.append('photos', f));
    const res = await uploadBatch(formData);
    if (Array.isArray(res)) results.push(...res);
    uploaded += batch.length;
    if (onProgress) onProgress(uploaded, files.length);
  }
  return results;
}
