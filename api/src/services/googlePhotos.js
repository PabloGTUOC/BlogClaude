const { processUpload } = require('./sharp');
const { processVideo } = require('./video');

// Downloads the raw bytes of a Google Photos Picker media item.
// Photos use the `=d` suffix (full-res original); videos use `=dv` (download video).
async function fetchGoogleMediaBuffer(baseUrl, accessToken, isVideo) {
  const suffix = isVideo ? '=dv' : '=d';
  const downloadUrl = baseUrl.endsWith(suffix) ? baseUrl : `${baseUrl}${suffix}`;

  // Picker API baseUrls require Authorization — Library API baseUrls are self-signed and don't
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  const response = await fetch(downloadUrl, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${isVideo ? 'video' : 'image'} from Google Photos: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function importGooglePhoto(baseUrl, originalName, creationTime, accessToken) {
  const buffer = await fetchGoogleMediaBuffer(baseUrl, accessToken, false);

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
  const buffer = await fetchGoogleMediaBuffer(baseUrl, accessToken, true);
  return processVideo(buffer, originalName || 'google_video.mp4');
}

module.exports = {
  importGooglePhoto,
  importGoogleVideo
};
