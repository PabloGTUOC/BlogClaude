const { processUpload } = require('./sharp');

async function importGooglePhoto(baseUrl, originalName) {
  // Fetch the image from Google's baseUrl (baseUrl is a temp public URL)
  const response = await fetch(baseUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from Google Photos: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Send the buffer directly through our Sharp pipeline
  return processUpload(buffer, originalName || 'google_photo.jpg');
}

module.exports = {
  importGooglePhoto
};
