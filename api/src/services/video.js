const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

// Use bundled static binaries so no system ffmpeg install is required
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');
const fullDir = path.join(uploadPath, 'full');
const thumbsDir = path.join(uploadPath, 'thumbs');

fs.mkdirSync(fullDir, { recursive: true });
fs.mkdirSync(thumbsDir, { recursive: true });

function probe(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

// Processes a video upload: stores the video file as-is and extracts a poster-frame thumbnail.
async function processVideo(fileBuffer, originalName) {
  // Random filename: uploads are served statically, so names must be unguessable
  // (timestamp + original name was enumerable). Only the extension survives.
  const token = crypto.randomBytes(16).toString('hex');
  const ext = (path.extname(originalName).replace(/[^a-zA-Z0-9.]/g, '') || '.mp4').toLowerCase();

  const videoFilename = `${token}${ext}`;
  const thumbFilename = `${token}.jpg`;

  const videoFullPath = path.join(fullDir, videoFilename);
  const thumbFullPath = path.join(thumbsDir, thumbFilename);

  // Store the original video file
  fs.writeFileSync(videoFullPath, fileBuffer);

  // Probe for dimensions and duration
  let width = null;
  let height = null;
  let duration = null;
  try {
    const meta = await probe(videoFullPath);
    const videoStream = (meta.streams || []).find(s => s.codec_type === 'video');
    if (videoStream) {
      width = videoStream.width || null;
      height = videoStream.height || null;
    }
    if (meta.format && meta.format.duration) {
      duration = Math.round(parseFloat(meta.format.duration));
    }
  } catch (err) {
    console.warn('Could not probe video metadata:', err.message);
  }

  // Extract a poster frame (~1s in, or the very start for very short clips)
  const seekTime = duration && duration < 1 ? 0 : 1;
  await new Promise((resolve, reject) => {
    ffmpeg(videoFullPath)
      .on('end', resolve)
      .on('error', reject)
      .screenshots({
        timestamps: [seekTime],
        filename: thumbFilename,
        folder: thumbsDir,
        size: '900x?'
      });
  });

  // Sanity check the thumbnail actually got written
  if (!fs.existsSync(thumbFullPath)) {
    console.warn('Poster frame was not generated for', videoFilename);
  }

  return {
    filename: `full/${videoFilename}`,
    thumbnail: `thumbs/${thumbFilename}`,
    width,
    height,
    duration,
    media_type: 'video',
    exif_json: null
  };
}

module.exports = {
  processVideo
};
