const { processUpload } = require('./sharp');

async function importGooglePhoto(baseUrl, originalName, creationTime, accessToken) {
  // Append =d to get the original full-resolution file with EXIF metadata intact
  const downloadUrl = baseUrl.endsWith('=d') ? baseUrl : `${baseUrl}=d`;

  // Picker API baseUrls require Authorization — Library API baseUrls are self-signed and don't
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  const response = await fetch(downloadUrl, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch image from Google Photos: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const result = await processUpload(buffer, originalName || 'google_photo.jpg');

  // If EXIF didn't come through (Google sometimes strips it), inject creationTime as DateTimeOriginal
  if (creationTime && (!result.exif_json || !JSON.parse(result.exif_json).DateTimeOriginal)) {
    const exif = result.exif_json ? JSON.parse(result.exif_json) : {};
    exif.DateTimeOriginal = new Date(creationTime).toISOString();
    result.exif_json = JSON.stringify(exif);
  }

  return result;
}

module.exports = {
  importGooglePhoto
};
