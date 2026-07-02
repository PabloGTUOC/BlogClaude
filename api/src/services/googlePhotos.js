const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { processUpload } = require('./sharp');
const { processVideo } = require('./video');

const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');
const tmpDir = path.join(uploadPath, 'tmp');
fs.mkdirSync(tmpDir, { recursive: true });

// Builds the authorized download request for a Google Photos Picker media item.
// Photos use the `=d` suffix (full-res original); videos use `=dv` (download video).
async function fetchGoogleMedia(baseUrl, accessToken, isVideo) {
  const suffix = isVideo ? '=dv' : '=d';
  const downloadUrl = baseUrl.endsWith(suffix) ? baseUrl : `${baseUrl}${suffix}`;

  // Picker API baseUrls require Authorization — Library API baseUrls are self-signed and don't
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  const response = await fetch(downloadUrl, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${isVideo ? 'video' : 'image'} from Google Photos: ${response.statusText}`);
  }
  return response;
}

// Photos are small enough to buffer.
async function fetchGoogleMediaBuffer(baseUrl, accessToken) {
  const response = await fetchGoogleMedia(baseUrl, accessToken, false);
  return Buffer.from(await response.arrayBuffer());
}

// Videos (up to hundreds of MB) are streamed straight to a temp file so they
// never sit in the Node heap. Returns the temp path; processVideo consumes it.
async function fetchGoogleMediaToFile(baseUrl, accessToken, originalName) {
  const response = await fetchGoogleMedia(baseUrl, accessToken, true);
  const ext = (path.extname(originalName || '').replace(/[^a-zA-Z0-9.]/g, '') || '.mp4').toLowerCase();
  const tempPath = path.join(tmpDir, `${crypto.randomBytes(16).toString('hex')}${ext}`);
  try {
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(tempPath));
  } catch (err) {
    fs.rm(tempPath, { force: true }, () => {});
    throw err;
  }
  return tempPath;
}

async function importGooglePhoto(baseUrl, originalName, creationTime, accessToken) {
  const buffer = await fetchGoogleMediaBuffer(baseUrl, accessToken);

  const result = await processUpload(buffer, originalName || 'google_photo.jpg');

  // If EXIF didn't come through (Google sometimes strips it), inject creationTime as DateTimeOriginal
  if (creationTime && (!result.exif_json || !JSON.parse(result.exif_json).DateTimeOriginal)) {
    const exif = result.exif_json ? JSON.parse(result.exif_json) : {};
    exif.DateTimeOriginal = new Date(creationTime).toISOString();
    result.exif_json = JSON.stringify(exif);
  }

  return result;
}

async function importGoogleVideo(baseUrl, originalName, accessToken) {
  const tempPath = await fetchGoogleMediaToFile(baseUrl, accessToken, originalName);
  return processVideo(tempPath, originalName || 'google_video.mp4');
}

module.exports = {
  importGooglePhoto,
  importGoogleVideo
};
