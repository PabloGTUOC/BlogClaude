const sharp = require('sharp');
const exifr = require('exifr');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');

// Ensure directories exist
const fullDir = path.join(uploadPath, 'full');
const thumbsDir = path.join(uploadPath, 'thumbs');
const smallDir = path.join(uploadPath, 'small');

fs.mkdirSync(fullDir, { recursive: true });
fs.mkdirSync(thumbsDir, { recursive: true });
fs.mkdirSync(smallDir, { recursive: true });

// `input` may be a file path (disk-based multer uploads) or a Buffer
// (Google Photos imports) — sharp and exifr accept both natively.
async function processUpload(input, _originalName) {
  // 1. Extract EXIF
  let exif = null;
  try {
    exif = await exifr.parse(input, {
      tiff: true,
      xmp: true,
      gps: true,
      exif: true
    });
  } catch (err) {
    console.warn('Could not parse EXIF data:', err.message);
  }

  // Random filename: uploads are served statically, so names must be unguessable
  // (timestamp + original name was enumerable). Also removes collision risk.
  const filenameBase = `${crypto.randomBytes(16).toString('hex')}.jpg`;

  const fullPath = path.join(fullDir, filenameBase);
  const thumbPath = path.join(thumbsDir, filenameBase);
  const smallPath = path.join(smallDir, filenameBase);

  // Get image dimensions & orientation
  const image = sharp(input);
  const metadata = await image.metadata();

  // If orientation is 5-8 (rotated 90 or 270 deg), width/height are swapped
  const isRotated = metadata.orientation && metadata.orientation >= 5 && metadata.orientation <= 8;
  const originalWidth = isRotated ? metadata.height : metadata.width;
  const originalHeight = isRotated ? metadata.width : metadata.height;

  // Process Full Image: max 5000px on long edge, keep aspect ratio
  let fullPipeline = sharp(input).rotate(); // auto-rotate
  if (originalWidth > 5000 || originalHeight > 5000) {
    if (originalWidth >= originalHeight) {
      fullPipeline = fullPipeline.resize({ width: 5000 });
    } else {
      fullPipeline = fullPipeline.resize({ height: 5000 });
    }
  }

  const fullInfo = await fullPipeline
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toFile(fullPath);

  // Process Thumbnail: max 900px on long edge, keep aspect ratio
  let thumbPipeline = sharp(input).rotate(); // auto-rotate
  if (originalWidth > 900 || originalHeight > 900) {
    if (originalWidth >= originalHeight) {
      thumbPipeline = thumbPipeline.resize({ width: 900 });
    } else {
      thumbPipeline = thumbPipeline.resize({ height: 900 });
    }
  }

  await thumbPipeline
    .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
    .toFile(thumbPath);

  // Small variant (max 320px long edge) — the srcset entry for phone-width cards
  let smallPipeline = sharp(input).rotate();
  if (originalWidth > 320 || originalHeight > 320) {
    smallPipeline = originalWidth >= originalHeight
      ? smallPipeline.resize({ width: 320 })
      : smallPipeline.resize({ height: 320 });
  }
  await smallPipeline
    .jpeg({ quality: 82 })
    .toFile(smallPath);

  return {
    filename: `full/${filenameBase}`,
    thumbnail: `thumbs/${filenameBase}`,
    thumbnail_small: `small/${filenameBase}`,
    width: fullInfo.width,
    height: fullInfo.height,
    duration: null,
    media_type: 'image',
    exif_json: exif ? JSON.stringify(exif) : null
  };
}

module.exports = {
  processUpload
};
